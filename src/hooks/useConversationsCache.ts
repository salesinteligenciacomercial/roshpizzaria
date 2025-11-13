import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * ✨ MELHORIA 100%: Hook para cache persistente de conversas
 * 
 * Funcionalidades:
 * - Cache em localStorage com TTL de 30 minutos
 * - Carregamento instantâneo do cache + sincronização em segundo plano
 * - Histórico completo (até 2000 mensagens)
 * - Isolamento por empresa (company_id)
 */

export interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  mediaUrl?: string;
  fileName?: string;
}

export interface Conversation {
  id: string;
  contactName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  status: "waiting" | "answered" | "resolved";
  lastMessage: string;
  unread: number;
  messages: Message[];
  tags: string[];
  phoneNumber?: string;
  isGroup?: boolean;
  avatarUrl?: string; // ⚡ Foto de perfil
}

interface CacheData {
  timestamp: number;
  conversations: Conversation[];
  companyId: string;
}

const CACHE_KEY = 'conversas_cache_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

export const useConversationsCache = (companyId: string | null) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number>(0);

  // ⚡ FASE 1: Carregar imediatamente do cache quando companyId estiver disponível
  useEffect(() => {
    if (!companyId) {
      setIsLoading(false);
      return;
    }

    console.log('⚡ [CACHE] Company ID disponível, carregando cache:', companyId);
    const cached = loadFromCache();
    
    if (cached && cached.length > 0) {
      console.log(`💾 [CACHE] ${cached.length} conversas carregadas instantaneamente`);
      setConversations(cached);
      setLastSync(Date.now());
    }
    
    setIsLoading(false);
  }, [companyId]);

  // ⚡ FASE 2.2: Carregar do cache persistente
  const loadFromCache = useCallback((): Conversation[] | null => {
    if (!companyId) return null;

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const data: CacheData = JSON.parse(cached);
      
      // Validar empresa
      if (data.companyId !== companyId) {
        console.log('⚠️ [CACHE] Cache de outra empresa, ignorando');
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      // Validar TTL
      const age = Date.now() - data.timestamp;
      if (age > CACHE_TTL) {
        console.log('⏰ [CACHE] Cache expirado, removendo');
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      console.log(`💾 [CACHE] Cache válido (idade: ${Math.round(age / 1000)}s)`);
      
      // Converter timestamps
      const conversationsWithDates = data.conversations.map(conv => ({
        ...conv,
        messages: conv.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));

      return conversationsWithDates;
    } catch (error) {
      console.error('❌ [CACHE] Erro ao carregar:', error);
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
  }, [companyId]);

  // 💾 Salvar no cache
  const saveToCache = useCallback((convs: Conversation[]) => {
    if (!companyId) return;

    try {
      const data: CacheData = {
        timestamp: Date.now(),
        conversations: convs,
        companyId
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log(`💾 [CACHE] ${convs.length} conversas salvas`);
    } catch (error) {
      console.error('❌ [CACHE] Erro ao salvar:', error);
      localStorage.removeItem(CACHE_KEY);
    }
  }, [companyId]);

  // 📡 FASE 2.1: Carregar do banco (otimizado)
  const loadFromDatabase = useCallback(async (): Promise<Conversation[]> => {
    if (!companyId) return [];

    try {
      console.log('📡 [DATABASE] Carregando histórico...');

      // ⚡ OTIMIZADO: Buscar apenas campos essenciais sem mídia pesada (500 mensagens recentes)
      const { data: conversasData, error } = await supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, fromme')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      console.log(`📊 [DATABASE] ${conversasData?.length || 0} mensagens carregadas`);

      // Validar e filtrar
      const validConversas = (conversasData || []).filter(conv => 
        conv.numero && !conv.numero.includes('{{') &&
        conv.mensagem && !conv.mensagem.includes('{{') &&
        conv.nome_contato // ✅ Garantir que tem nome (trigger já preencheu)
      );

      console.log(`✅ [DATABASE] ${validConversas.length} mensagens válidas`);

      // ⚡ FASE 2.3: Agrupar APENAS por telefone (ignorar nome)
      const conversasMap = new Map<string, any[]>();
      validConversas.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const key = isGroup ? conv.numero : (conv.telefone_formatado || conv.numero.replace(/[^0-9]/g, ''));
        
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        conversasMap.get(key)!.push(conv);
      });

      console.log(`📊 [DATABASE] ${conversasMap.size} conversas únicas`);

      // Converter para formato Conversation
      const conversations: Conversation[] = Array.from(conversasMap.entries()).map(([telefone, mensagens]) => {
        // ⚡ Últimas 100 mensagens por conversa (otimização)
        const mensagensOrdenadas = mensagens
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        const mensagensRecentes = mensagensOrdenadas.slice(-100);
        
        const messagensFormatadas: Message[] = mensagensRecentes
          .map(m => ({
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            content: m.mensagem || '',
            type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
            sender: (m.fromme === true || m.status === 'Enviada') ? "user" : "contact",
            timestamp: new Date(m.created_at || Date.now()),
            delivered: true,
            read: m.status !== 'Recebida',
          }));

        // ⚡ Pegar primeiro nome_contato disponível (já está garantido pelo trigger)
        const contactName = mensagens.find(m => m.nome_contato)?.nome_contato || telefone;
        
        const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
        
        let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
        const temMensagemResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
        if (temMensagemResolvida) {
          statusConversa = "resolved";
        } else if (ultimaMensagem?.sender === 'user') {
          statusConversa = "answered";
        }

        const isGroup = mensagens[0]?.is_group || /@g\.us$/.test(telefone);

        // ⚡ Avatar placeholder - será carregado assincronamente
        const avatarUrl = isGroup 
          ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=10b981&color=fff`
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName)}&background=0ea5e9&color=fff`;

        return {
          id: telefone,
          contactName,
          channel: "whatsapp" as const,
          status: statusConversa,
          lastMessage: ultimaMensagem?.content || '',
          unread: 0,
          messages: messagensFormatadas,
          tags: [],
          phoneNumber: telefone,
          isGroup,
          avatarUrl, // ⚡ Incluir avatar
        };
      });

      return conversations;
    } catch (error: any) {
      console.error('❌ [DATABASE] Erro:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      
      // Não mostrar toast se for erro de JSON parsing (dados corrompidos)
      if (!error?.message?.includes('JSON')) {
        toast.error('Erro ao carregar conversas');
      }
      
      return [];
    }
  }, [companyId]);

  // 🔄 Sincronizar: cache → banco (background)
  const syncConversations = useCallback(async (forceRefresh: boolean = false) => {
    if (!companyId) {
      console.log('⏳ [SYNC] Aguardando companyId...');
      return;
    }

    setIsLoading(true);

    try {
      // 1️⃣ Tentar cache primeiro (carregamento instantâneo)
      if (!forceRefresh) {
        const cached = loadFromCache();
        if (cached && cached.length > 0) {
          console.log(`✅ [SYNC] ${cached.length} conversas do cache (instantâneo)`);
          setConversations(cached);
          setIsLoading(false);
          setLastSync(Date.now());
          
          // 2️⃣ Atualizar em segundo plano
          setTimeout(async () => {
            console.log('🔄 [SYNC] Atualizando em segundo plano...');
            const fresh = await loadFromDatabase();
            if (fresh.length > 0) {
              console.log(`✅ [SYNC] ${fresh.length} conversas atualizadas`);
              setConversations(fresh);
              saveToCache(fresh);
            }
          }, 1000);
          
          return;
        }
      }

      // 3️⃣ Sem cache ou forçou refresh: buscar do banco
      console.log('📡 [SYNC] Carregando do banco...');
      const fresh = await loadFromDatabase();
      console.log(`✅ [SYNC] ${fresh.length} conversas carregadas`);
      setConversations(fresh);
      saveToCache(fresh);
      setLastSync(Date.now());
    } catch (error) {
      console.error('❌ [SYNC] Erro:', error);
      toast.error('Erro ao sincronizar conversas');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, loadFromCache, loadFromDatabase, saveToCache]);

  // 🚀 Auto-sync quando companyId muda
  useEffect(() => {
    if (companyId) {
      console.log('🚀 [CACHE] Iniciando sync para company:', companyId);
      syncConversations();
    }
  }, [companyId]);

  // 🔄 Atualizar conversa específica
  const updateConversation = useCallback((updatedConv: Conversation) => {
    setConversations(prev => {
      const newConvs = prev.map(c => c.id === updatedConv.id ? updatedConv : c);
      saveToCache(newConvs);
      return newConvs;
    });
  }, [saveToCache]);

  // ➕ Adicionar mensagem
  const addMessage = useCallback((conversationId: string, message: Message) => {
    setConversations(prev => {
      const newConvs = prev.map(conv => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            messages: [...conv.messages, message],
            lastMessage: message.content,
          };
        }
        return conv;
      });
      saveToCache(newConvs);
      return newConvs;
    });
  }, [saveToCache]);

  // 🗑️ Limpar cache
  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    console.log('🗑️ [CACHE] Cache limpo');
  }, []);

  return {
    conversations,
    isLoading,
    lastSync,
    syncConversations,
    updateConversation,
    addMessage,
    clearCache,
  };
};
