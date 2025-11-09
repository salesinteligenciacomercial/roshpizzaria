import { useCallback, useRef } from 'react';

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
  mimeType?: string;
  transcricao?: string;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error";
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
  sentBy?: string;
  contactData?: {
    name: string;
    phone: string;
  };
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
  funnelStage?: string;
  responsavel?: string;
  produto?: string;
  valor?: string;
  anotacoes?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  isGroup?: boolean;
}

/**
 * Hook para gerenciar cache de conversas e mensagens
 * Otimiza carregamento e reduz chamadas ao banco
 */
export const useConversationsCache = () => {
  const conversationsCacheRef = useRef<Map<string, Conversation>>(new Map());
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map());
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const inflightAvatarPromisesRef = useRef<Map<string, Promise<string | undefined>>>(new Map());

  const updateConversationCache = useCallback((conversation: Conversation) => {
    conversationsCacheRef.current.set(conversation.id, conversation);
    
    if (conversation.messages && conversation.messages.length > 0) {
      messagesCacheRef.current.set(conversation.id, conversation.messages);
    }
    
    // Limitar tamanho do cache (manter apenas últimas 100 conversas)
    if (conversationsCacheRef.current.size > 100) {
      const firstKey = conversationsCacheRef.current.keys().next().value;
      conversationsCacheRef.current.delete(firstKey);
      messagesCacheRef.current.delete(firstKey);
    }
    
    console.log(`💾 [CACHE] Conversa atualizada: ${conversation.id}`);
  }, []);

  const getConversationFromCache = useCallback((conversationId: string): Conversation | null => {
    const cached = conversationsCacheRef.current.get(conversationId);
    if (cached) {
      console.log(`💾 [CACHE] Conversa recuperada: ${conversationId}`);
      return cached;
    }
    return null;
  }, []);

  const getAvatarFromCache = useCallback((key: string): string | undefined => {
    return avatarCacheRef.current.get(key);
  }, []);

  const setAvatarInCache = useCallback((key: string, url: string) => {
    avatarCacheRef.current.set(key, url);
  }, []);

  const getInflightAvatarPromise = useCallback((key: string) => {
    return inflightAvatarPromisesRef.current.get(key);
  }, []);

  const setInflightAvatarPromise = useCallback((key: string, promise: Promise<string | undefined>) => {
    inflightAvatarPromisesRef.current.set(key, promise);
  }, []);

  const deleteInflightAvatarPromise = useCallback((key: string) => {
    inflightAvatarPromisesRef.current.delete(key);
  }, []);

  return {
    conversationsCacheRef,
    messagesCacheRef,
    avatarCacheRef,
    updateConversationCache,
    getConversationFromCache,
    getAvatarFromCache,
    setAvatarInCache,
    getInflightAvatarPromise,
    setInflightAvatarPromise,
    deleteInflightAvatarPromise,
  };
};
