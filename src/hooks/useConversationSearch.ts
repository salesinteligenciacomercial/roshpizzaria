import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Conversation, Message } from './useConversationsCache';

/**
 * Hook para busca de conversas diretamente no banco de dados
 * Resolve o problema de não encontrar conversas antigas que não estão carregadas
 */
export const useConversationSearch = (companyId: string | null) => {
  const [searchResults, setSearchResults] = useState<Conversation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  /**
   * Busca conversas no banco de dados por nome, telefone ou número
   */
  const searchConversations = useCallback(async (query: string): Promise<Conversation[]> => {
    if (!companyId || !query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return [];
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchLower = query.toLowerCase().trim();
      const searchDigits = query.replace(/[^0-9]/g, '');

      console.log('🔍 [SEARCH] Buscando no banco:', { query, searchLower, searchDigits });

      // Buscar mensagens que correspondem à busca (por nome_contato ou número)
      // Usar ILIKE para busca case-insensitive
      let searchQuery = supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, company_id, sent_by, owner_id, midia_url, origem_api')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      // Buscar por nome OU telefone
      if (searchDigits.length >= 4) {
        // Se tem dígitos suficientes, buscar por telefone
        searchQuery = searchQuery.or(`nome_contato.ilike.%${searchLower}%,telefone_formatado.ilike.%${searchDigits}%,numero.ilike.%${searchDigits}%`);
      } else {
        // Caso contrário, buscar só por nome
        searchQuery = searchQuery.ilike('nome_contato', `%${searchLower}%`);
      }

      // Limitar a 500 resultados para performance
      const { data: conversasResult, error } = await searchQuery.limit(500);

      if (error) {
        console.error('❌ [SEARCH] Erro na busca:', error);
        setIsSearching(false);
        return [];
      }

      const conversasData = conversasResult || [];
      console.log(`📊 [SEARCH] ${conversasData.length} mensagens encontradas`);

      if (conversasData.length === 0) {
        setSearchResults([]);
        setIsSearching(false);
        return [];
      }

      // Agrupar por telefone para formar conversas
      const conversasMap = new Map<string, any[]>();
      conversasData.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const key = isGroup 
          ? conv.numero 
          : (conv.telefone_formatado?.replace(/[^0-9]/g, '') || conv.numero?.replace(/[^0-9]/g, '') || '');
        
        if (!key) return;
        
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        conversasMap.get(key)!.push(conv);
      });

      console.log(`📊 [SEARCH] ${conversasMap.size} conversas únicas encontradas`);

      // Converter para formato Conversation
      const results: Conversation[] = Array.from(conversasMap.entries()).map(([telefone, mensagens]) => {
        const isGroup = mensagens[0]?.is_group || /@g\.us$/.test(telefone);
        
        // Ordenar mensagens por data
        const mensagensOrdenadas = mensagens
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const messagensFormatadas: Message[] = mensagensOrdenadas.slice(-50).map(m => {
          const isFromMe = m.fromme === true || String(m.fromme) === 'true';
          return {
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            content: m.mensagem || '',
            type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
            sender: isFromMe ? "user" : "contact",
            timestamp: new Date(m.created_at || Date.now()),
            delivered: true,
            read: m.status !== 'Recebida',
            mediaUrl: m.midia_url,
            sentBy: m.sent_by || undefined,
          };
        });

        const contactName = mensagens.find(m => m.nome_contato)?.nome_contato || telefone;
        const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
        
        let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
        const temResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
        if (temResolvida) {
          statusConversa = "resolved";
        } else if (ultimaMensagem?.sender === 'user') {
          statusConversa = "answered";
        }

        const origemApi = mensagens.find(m => m.origem_api)?.origem_api || 'evolution';

        return {
          id: `conv-${telefone}`,
          contactName,
          channel: "whatsapp" as const,
          status: statusConversa,
          lastMessage: ultimaMensagem?.content || '',
          unread: 0,
          messages: messagensFormatadas,
          tags: [],
          phoneNumber: telefone,
          isGroup,
          origemApi: origemApi as "evolution" | "meta",
        };
      });

      // Ordenar por última mensagem
      results.sort((a, b) => {
        const aTime = a.messages[a.messages.length - 1]?.timestamp?.getTime() || 0;
        const bTime = b.messages[b.messages.length - 1]?.timestamp?.getTime() || 0;
        return bTime - aTime;
      });

      console.log(`✅ [SEARCH] ${results.length} conversas retornadas`);
      setSearchResults(results);
      setIsSearching(false);
      return results;
    } catch (error) {
      console.error('❌ [SEARCH] Erro:', error);
      setIsSearching(false);
      return [];
    }
  }, [companyId]);

  /**
   * Limpar resultados da busca
   */
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setHasSearched(false);
  }, []);

  return {
    searchResults,
    isSearching,
    hasSearched,
    searchConversations,
    clearSearch,
  };
};

/**
 * Função para carregar todas as conversas únicas (otimizado)
 * Carrega apenas última mensagem de cada conversa para listar
 */
export const loadAllUniqueConversations = async (companyId: string): Promise<Conversation[]> => {
  if (!companyId) return [];

  try {
    console.log('📊 [LOAD-ALL] Carregando todas as conversas únicas...');

    // Estratégia: Buscar mensagens ordenadas por data DESC e agrupar por telefone
    // Isso garante que pegamos a mensagem mais recente de cada conversa
    const { data: conversasResult, error } = await supabase
      .from('conversas')
      .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme, company_id, sent_by, midia_url, origem_api')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5000); // Limite alto para pegar todas as conversas

    if (error) {
      console.error('❌ [LOAD-ALL] Erro:', error);
      return [];
    }

    const conversasData = conversasResult || [];
    console.log(`📊 [LOAD-ALL] ${conversasData.length} mensagens carregadas`);

    // Validar e filtrar
    const validConversas = conversasData.filter(conv => {
      if (!conv.numero || conv.numero.includes('{{')) return false;
      if (!conv.mensagem || conv.mensagem.includes('{{')) return false;
      
      // Validar tamanho do telefone (11-13 dígitos)
      const telefoneNorm = conv.telefone_formatado?.replace(/[^0-9]/g, '') || conv.numero?.replace(/[^0-9]/g, '') || '';
      if (telefoneNorm.length > 0 && (telefoneNorm.length < 11 || telefoneNorm.length > 15)) {
        return false;
      }
      
      return true;
    });

    // Agrupar por telefone - pegar apenas a PRIMEIRA (mais recente) de cada
    const conversasMap = new Map<string, any>();
    validConversas.forEach(conv => {
      const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
      const key = isGroup 
        ? conv.numero 
        : (conv.telefone_formatado?.replace(/[^0-9]/g, '') || conv.numero?.replace(/[^0-9]/g, '') || '');
      
      if (!key) return;
      
      // Só adicionar se ainda não existe (primeiro = mais recente porque ordenamos DESC)
      if (!conversasMap.has(key)) {
        conversasMap.set(key, conv);
      }
    });

    console.log(`📊 [LOAD-ALL] ${conversasMap.size} conversas únicas identificadas`);

    // ⚡ CORREÇÃO CRÍTICA: Buscar assignments (assignedUser) para manter filtro "Transferidos"
    const telefonesParaBuscar = Array.from(conversasMap.keys()).map(tel => tel.replace(/[^0-9]/g, '')).filter(tel => tel.length >= 10);
    const assignmentsMap = new Map<string, { id: string; name: string }>();
    
    if (telefonesParaBuscar.length > 0) {
      // Buscar em lotes de 100 para evitar limite do Supabase
      const BATCH_SIZE = 100;
      let allAssignments: any[] = [];
      
      for (let i = 0; i < telefonesParaBuscar.length; i += BATCH_SIZE) {
        const batch = telefonesParaBuscar.slice(i, i + BATCH_SIZE);
        const { data: assignmentsData } = await supabase
          .from('conversation_assignments')
          .select('telefone_formatado, assigned_user_id')
          .eq('company_id', companyId)
          .in('telefone_formatado', batch);
        
        if (assignmentsData) {
          allAssignments = [...allAssignments, ...assignmentsData];
        }
      }

      // Buscar nomes dos usuários atribuídos
      const assignedUserIds = [...new Set(allAssignments.map(a => a.assigned_user_id).filter(Boolean))];
      const userNamesMap = new Map<string, string>();
      
      if (assignedUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', assignedUserIds);
        
        if (profiles) {
          profiles.forEach(p => userNamesMap.set(p.id, p.full_name || p.email || 'Usuário'));
        }
      }

      // Mapear assignments
      allAssignments.forEach((assignment: any) => {
        const telKey = assignment.telefone_formatado?.replace(/[^0-9]/g, '') || '';
        if (telKey && assignment.assigned_user_id) {
          const userName = userNamesMap.get(assignment.assigned_user_id) || 'Usuário';
          assignmentsMap.set(telKey, { id: assignment.assigned_user_id, name: userName });
        }
      });
      
      console.log(`👥 [LOAD-ALL] ${assignmentsMap.size} responsáveis carregados`);
    }

    // Converter para formato Conversation (com apenas 1 mensagem inicial)
    const conversations: Conversation[] = Array.from(conversasMap.entries()).map(([telefone, conv]) => {
      const isGroup = conv.is_group || /@g\.us$/.test(telefone);
      const isFromMe = conv.fromme === true || String(conv.fromme) === 'true';
      
      const message: Message = {
        id: conv.id || `msg-${Date.now()}-${Math.random()}`,
        content: conv.mensagem || '',
        type: (conv.tipo_mensagem === 'texto' ? 'text' : conv.tipo_mensagem || 'text') as any,
        sender: isFromMe ? "user" : "contact",
        timestamp: new Date(conv.created_at || Date.now()),
        delivered: true,
        read: conv.status !== 'Recebida',
        mediaUrl: conv.midia_url,
        sentBy: conv.sent_by || undefined,
      };

      const contactName = conv.nome_contato || telefone;
      
      let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
      if (conv.status === 'Resolvida' || conv.status === 'Finalizada') {
        statusConversa = "resolved";
      } else if (isFromMe) {
        statusConversa = "answered";
      }

      const origemApi = conv.origem_api || 'evolution';
      
      // ⚡ CRÍTICO: Incluir assignedUser do banco para manter filtro "Transferidos"
      const telKey = telefone.replace(/[^0-9]/g, '');
      const assignedUserData = assignmentsMap.get(telKey);

      return {
        id: `conv-${telefone}`,
        contactName,
        channel: "whatsapp" as const,
        status: statusConversa,
        lastMessage: message.content,
        unread: 0,
        messages: [message], // Apenas última mensagem inicialmente
        tags: [],
        phoneNumber: telefone,
        isGroup,
        origemApi: origemApi as "evolution" | "meta",
        // ⚡ CORREÇÃO: Incluir assignedUser para filtro "Transferidos" funcionar
        responsavel: assignedUserData?.id,
        assignedUser: assignedUserData ? { id: assignedUserData.id, name: assignedUserData.name } : undefined,
      };
    });

    // Ordenar por última mensagem
    conversations.sort((a, b) => {
      const aTime = a.messages[0]?.timestamp?.getTime() || 0;
      const bTime = b.messages[0]?.timestamp?.getTime() || 0;
      return bTime - aTime;
    });

    console.log(`✅ [LOAD-ALL] ${conversations.length} conversas únicas retornadas`);
    return conversations;
  } catch (error) {
    console.error('❌ [LOAD-ALL] Erro:', error);
    return [];
  }
};
