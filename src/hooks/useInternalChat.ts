import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TeamMember } from './useTeamMembers';

export interface InternalConversation {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  participants: {
    user_id: string;
    last_read_at: string | null;
    profile?: TeamMember;
  }[];
  last_message?: {
    content: string | null;
    message_type: string;
    created_at: string;
    sender_id: string;
  };
  unread_count: number;
}

export const useInternalChat = () => {
  const [conversations, setConversations] = useState<InternalConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationsRef = useRef<InternalConversation[]>([]);
  const isLoadingRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initializedRef = useRef(false);
  const activeConversationIdRef = useRef<string | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    // Evitar inicialização duplicada
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    initializeChat();
    
    return () => {
      // Cleanup on unmount
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const initializeChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      
      setCurrentUserId(user.id);

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userRole?.company_id) {
        setCompanyId(userRole.company_id);
        await loadConversations(user.id);
        setupRealtimeSubscription(user.id);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async (userId: string): Promise<InternalConversation[]> => {
    // Prevenir carregamentos simultâneos que causam flickering
    if (isLoadingRef.current) {
      console.log('⏳ [InternalChat] Load already in progress, skipping...');
      return conversationsRef.current;
    }
    
    isLoadingRef.current = true;
    
    try {
      // Get conversations where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (partError) {
        console.error('Error loading participations:', partError);
        return [];
      }

      if (!participations || participations.length === 0) {
        setConversations([]);
        return [];
      }

      const conversationIds = participations.map(p => p.conversation_id);
      const lastReadMap = new Map(participations.map(p => [p.conversation_id, p.last_read_at]));

      // Get conversation details
      const { data: convos, error: convosError } = await supabase
        .from('internal_conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (convosError) {
        console.error('Error loading conversations:', convosError);
        return [];
      }

      if (!convos || convos.length === 0) {
        setConversations([]);
        return [];
      }

      // Get all participants for these conversations
      const { data: allParticipants } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id, user_id, last_read_at')
        .in('conversation_id', conversationIds);

      // Get profiles
      const userIds = [...new Set(allParticipants?.map(p => p.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Get last message for each conversation - otimizado para buscar apenas 1 por conversa
      const { data: lastMessages } = await supabase
        .from('internal_messages')
        .select('conversation_id, content, message_type, created_at, sender_id')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      const lastMessageMap = new Map<string, typeof lastMessages[0]>();
      lastMessages?.forEach(msg => {
        if (!lastMessageMap.has(msg.conversation_id)) {
          lastMessageMap.set(msg.conversation_id, msg);
        }
      });

      // Calcular unread counts de forma otimizada (uma única query)
      // Em vez de fazer N queries para N conversas
      // Se a conversa está ativa, não conta como não lida
      const unreadCounts = new Map<string, number>();
      
      // Buscar todas as mensagens não lidas de uma vez
      for (const convoId of conversationIds) {
        // Se é a conversa ativa, unread é 0
        if (convoId === activeConversationIdRef.current) {
          unreadCounts.set(convoId, 0);
          continue;
        }
        
        const lastRead = lastReadMap.get(convoId);
        const messagesAfterLastRead = lastMessages?.filter(msg => 
          msg.conversation_id === convoId &&
          msg.sender_id !== userId &&
          (!lastRead || new Date(msg.created_at) > new Date(lastRead))
        ) || [];
        
        unreadCounts.set(convoId, messagesAfterLastRead.length);
      }

      // Build conversation objects
      const enrichedConvos: InternalConversation[] = convos.map(convo => ({
        ...convo,
        participants: (allParticipants || [])
          .filter(p => p.conversation_id === convo.id)
          .map(p => ({
            user_id: p.user_id,
            last_read_at: p.last_read_at,
            profile: profileMap.get(p.user_id)
          })),
        last_message: lastMessageMap.get(convo.id),
        unread_count: unreadCounts.get(convo.id) || 0
      }));

      // Só atualizar estado se houver diferenças reais
      const currentJson = JSON.stringify(conversationsRef.current.map(c => ({ id: c.id, unread: c.unread_count, lastMsg: c.last_message?.created_at })));
      const newJson = JSON.stringify(enrichedConvos.map(c => ({ id: c.id, unread: c.unread_count, lastMsg: c.last_message?.created_at })));
      
      if (currentJson !== newJson) {
        setConversations(enrichedConvos);
      }
      
      return enrichedConvos;
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    } finally {
      isLoadingRef.current = false;
    }
  };

  const setupRealtimeSubscription = (userId: string) => {
    // Cleanup existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Usar um debounce para evitar múltiplos reloads em sequência
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const debouncedReload = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        loadConversations(userId);
      }, 500); // 500ms debounce
    };

    const channel = supabase
      .channel(`internal-chat-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages'
        },
        () => {
          debouncedReload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_conversation_participants'
        },
        () => {
          debouncedReload();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'internal_conversation_participants'
        },
        () => {
          debouncedReload();
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const createConversation = async (
    participantIds: string[],
    isGroup: boolean,
    name?: string
  ): Promise<string | null> => {
    if (!currentUserId || !companyId) return null;

    try {
      // For individual chats, check if conversation already exists
      if (!isGroup && participantIds.length === 1) {
        const existingConvo = conversationsRef.current.find(c => 
          !c.is_group &&
          c.participants.length === 2 &&
          c.participants.some(p => p.user_id === participantIds[0])
        );
        if (existingConvo) return existingConvo.id;
      }

      // Create new conversation
      const { data: newConvo, error: convoError } = await supabase
        .from('internal_conversations')
        .insert({
          company_id: companyId,
          name: isGroup ? name : null,
          is_group: isGroup,
          created_by: currentUserId
        })
        .select()
        .single();

      if (convoError) throw convoError;

      // Add participants (including current user)
      const allParticipants = [...new Set([currentUserId, ...participantIds])];
      const { error: partError } = await supabase
        .from('internal_conversation_participants')
        .insert(
          allParticipants.map(userId => ({
            conversation_id: newConvo.id,
            user_id: userId
          }))
        );

      if (partError) throw partError;

      // Refresh conversations and return the new ID
      await loadConversations(currentUserId);
      return newConvo.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const markAsRead = useCallback(async (conversationId: string) => {
    if (!currentUserId) return;

    try {
      // Primeiro atualizar o estado local para feedback imediato
      const currentConvo = conversationsRef.current.find(c => c.id === conversationId);
      const unreadBefore = currentConvo?.unread_count || 0;

      await supabase
        .from('internal_conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      // Atualizar localmente sem recarregar tudo
      setConversations(prev => 
        prev.map(c => 
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );

      console.log(`💬 [InternalChat] Marked as read: ${conversationId}, was ${unreadBefore} unread`);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [currentUserId]);

  const updateGroupName = async (conversationId: string, name: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('internal_conversations')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (error) throw error;

      setConversations(prev =>
        prev.map(c =>
          c.id === conversationId ? { ...c, name } : c
        )
      );
      return true;
    } catch (error) {
      console.error('Error updating group name:', error);
      return false;
    }
  };

  const addParticipants = async (conversationId: string, userIds: string[]): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('internal_conversation_participants')
        .insert(
          userIds.map(userId => ({
            conversation_id: conversationId,
            user_id: userId
          }))
        );

      if (error) throw error;

      if (currentUserId) {
        await loadConversations(currentUserId);
      }
      return true;
    } catch (error) {
      console.error('Error adding participants:', error);
      return false;
    }
  };

  const removeParticipant = async (conversationId: string, userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('internal_conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;

      if (currentUserId) {
        await loadConversations(currentUserId);
      }
      return true;
    } catch (error) {
      console.error('Error removing participant:', error);
      return false;
    }
  };

  const getTotalUnread = useCallback(() => {
    return conversations.reduce((sum, c) => sum + c.unread_count, 0);
  }, [conversations]);

  const getConversationDisplayName = useCallback((conversation: InternalConversation): string => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    
    const otherParticipant = conversation.participants.find(
      p => p.user_id !== currentUserId
    );
    
    return otherParticipant?.profile?.full_name || 'Usuário';
  }, [currentUserId]);

  const getConversationById = useCallback((id: string): InternalConversation | undefined => {
    return conversationsRef.current.find(c => c.id === id);
  }, []);

  const refresh = useCallback(async () => {
    if (currentUserId) {
      return await loadConversations(currentUserId);
    }
    return [];
  }, [currentUserId]);

  return {
    conversations,
    loading,
    currentUserId,
    companyId,
    createConversation,
    markAsRead,
    updateGroupName,
    addParticipants,
    removeParticipant,
    getTotalUnread,
    getConversationDisplayName,
    getConversationById,
    refresh,
    setActiveConversationId
  };
};
