import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Conversation, Message } from './useConversationsCache';

/**
 * Hook para carregar conversas com paginação e otimização
 * Implementa lazy loading e cache
 */
export const useConversationsLoader = () => {
  const [conversationsLimit, setConversationsLimit] = useState(30);
  const [conversationsOffset, setConversationsOffset] = useState(0);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const loadInitialConversations = useCallback(async (
    userCompanyId: string,
    conversations: Conversation[],
    append: boolean = false
  ) => {
    try {
      setLoadingConversations(true);

      if (!userCompanyId) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error('Você precisa estar logado');
          setLoadingConversations(false);
          return [];
        }
        
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.company_id) {
          toast.error('Erro: Usuário sem empresa associada');
          setLoadingConversations(false);
          return [];
        }

        userCompanyId = userRole.company_id;
      }
      
      const INITIAL_LIMIT = 30;
      const MESSAGES_PER_CONVERSATION = 3;
      const MESSAGES_TO_FETCH = append ? 100 : INITIAL_LIMIT * 2;
      
      let query = supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, midia_url, fromme')
        .eq('company_id', userCompanyId)
        .order('created_at', { ascending: false });
      
      if (append && conversations.length > 0) {
        const todasMensagens = conversations.flatMap(c => c.messages);
        if (todasMensagens.length > 0) {
          const dataMaisAntiga = todasMensagens
            .map(m => m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp))
            .sort((a, b) => a.getTime() - b.getTime())[0];
          
          query = query.lt('created_at', dataMaisAntiga.toISOString());
        }
      }
      
      query = query.limit(MESSAGES_TO_FETCH);
      
      const { data: conversasResult, error: conversasError } = await query;

      if (conversasError) {
        toast.error('Erro ao carregar conversas');
        setLoadingConversations(false);
        return [];
      }

      const conversasData = conversasResult || [];
      
      const validConversas = conversasData.filter(conv => 
        conv.numero && !conv.numero.includes('{{') &&
        conv.mensagem && !conv.mensagem.includes('{{')
      );

      // Agrupar conversas por telefone
      const conversasMap = new Map<string, any[]>();
      validConversas.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const key = isGroup ? conv.numero : (conv.telefone_formatado || conv.numero.replace(/[^0-9]/g, ''));
        
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        const mensagens = conversasMap.get(key)!;
        mensagens.push(conv);
        if (mensagens.length > MESSAGES_PER_CONVERSATION) {
          mensagens.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          mensagens.splice(MESSAGES_PER_CONVERSATION);
        }
      });

      // Buscar leads
      const telefonesUnicos = Array.from(conversasMap.keys())
        .map(tel => tel.replace(/[^0-9]/g, ''))
        .filter(tel => tel.length >= 10)
        .slice(0, 30);
      
      let leadsData: any[] = [];
      if (telefonesUnicos.length > 0) {
        const leadsResult = await supabase
          .from('leads')
          .select('id, phone, name, telefone')
          .eq('company_id', userCompanyId)
          .limit(50);
        
        if (!leadsResult.error && leadsResult.data) {
          leadsData = leadsResult.data.filter(lead => {
            const phoneRaw = lead.phone || lead.telefone;
            if (!phoneRaw) return false;
            const phoneKey = phoneRaw.replace(/[^0-9]/g, '');
            return telefonesUnicos.some(tel => phoneKey.includes(tel) || tel.includes(phoneKey));
          });
        }
      }
      
      console.log(`📊 [LOAD] ${conversasData.length} mensagens, ${conversasMap.size} conversas, ${leadsData.length} leads`);
      
      const leadsMap = new Map<string, { name: string; leadId: string }>();
      leadsData.forEach(lead => {
        const phoneRaw = lead.phone || lead.telefone;
        if (!phoneRaw) return;
        
        const phoneKey = phoneRaw.replace(/[^0-9]/g, '');
        if (phoneKey) {
          leadsMap.set(phoneKey, {
            name: lead.name || phoneKey,
            leadId: lead.id
          });
        }
      });

      // Criar conversas
      const novasConversas: Conversation[] = Array.from(conversasMap.entries())
        .slice(0, INITIAL_LIMIT)
        .map(([telefone, mensagens]) => {
          const leadInfo = leadsMap.get(telefone);
          
          let contactName = leadInfo?.name;
          
          const nomesProibidos = [
            'jeohvah lima', 
            'jeohvah i.a', 
            'jeova costa de lima',
            'jeo',
            telefone
          ];
          
          if (!contactName || contactName === telefone) {
            const nomeMensagem = mensagens.find(m => {
              const nomeMsg = m.nome_contato?.trim().toLowerCase();
              return nomeMsg && 
                     nomeMsg !== telefone && 
                     !nomesProibidos.includes(nomeMsg);
            })?.nome_contato;
            
            if (nomeMensagem) {
              contactName = nomeMensagem;
            }
          }
          
          if (!contactName || contactName.trim() === '') {
            contactName = telefone;
          }
          
          const messagensFormatadas: Message[] = mensagens
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .slice(-MESSAGES_PER_CONVERSATION)
            .map(m => ({
              id: m.id || `msg-${Date.now()}-${Math.random()}`,
              content: m.mensagem || '',
              type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
              sender: (m.fromme === true || m.status === 'Enviada') ? "user" : "contact",
              timestamp: new Date(m.created_at || Date.now()),
              delivered: true,
              read: m.status !== 'Recebida',
              mediaUrl: m.midia_url,
            }));

          const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
          let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
          
          const temMensagemResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
          if (temMensagemResolvida) {
            statusConversa = "resolved";
          } else if (ultimaMensagem) {
            if (ultimaMensagem.sender === 'user') {
              statusConversa = "answered";
            }
          }

          const isGroup = mensagens[0]?.is_group || /@g\.us$/.test(telefone);

          return {
            id: leadInfo?.leadId || `conv-${telefone}`,
            contactName,
            channel: "whatsapp" as const,
            status: statusConversa,
            lastMessage: ultimaMensagem?.content || '',
            unread: 0,
            messages: messagensFormatadas,
            tags: [],
            phoneNumber: telefone,
            isGroup,
          };
        });

      setLoadingConversations(false);
      setHasMoreConversations(conversasMap.size > INITIAL_LIMIT);
      
      return novasConversas;
    } catch (error) {
      console.error('❌ Erro ao carregar conversas:', error);
      setLoadingConversations(false);
      return [];
    }
  }, []);

  return {
    conversationsLimit,
    conversationsOffset,
    hasMoreConversations,
    loadingMore,
    loadingConversations,
    setConversationsLimit,
    setConversationsOffset,
    setHasMoreConversations,
    setLoadingMore,
    loadInitialConversations,
  };
};
