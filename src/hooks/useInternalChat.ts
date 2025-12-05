import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    initializeChat();
  }, []);

  const initializeChat = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

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

  const loadConversations = async (userId: string) => {
    try {
      // Get conversations where user is a participant
      const { data: participations } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (!participations || participations.length === 0) {
        setConversations([]);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);
      const lastReadMap = new Map(participations.map(p => [p.conversation_id, p.last_read_at]));

      // Get conversation details
      const { data: convos } = await supabase
        .from('internal_conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (!convos) return;

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

      // Get last message for each conversation
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

      // Get unread counts
      const unreadCounts = new Map<string, number>();
      for (const convoId of conversationIds) {
        const lastRead = lastReadMap.get(convoId);
        const { count } = await supabase
          .from('internal_messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convoId)
          .neq('sender_id', userId)
          .gt('created_at', lastRead || '1970-01-01');
        
        unreadCounts.set(convoId, count || 0);
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

      setConversations(enrichedConvos);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const setupRealtimeSubscription = (userId: string) => {
    const channel = supabase
      .channel('internal-chat-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages'
        },
        () => {
          loadConversations(userId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_conversation_participants'
        },
        () => {
          loadConversations(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        const existingConvo = conversations.find(c => 
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

      await loadConversations(currentUserId);
      return newConvo.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
  };

  const markAsRead = async (conversationId: string) => {
    if (!currentUserId) return;

    try {
      await supabase
        .from('internal_conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      setConversations(prev => 
        prev.map(c => 
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const getTotalUnread = useCallback(() => {
    return conversations.reduce((sum, c) => sum + c.unread_count, 0);
  }, [conversations]);

  const getConversationDisplayName = (conversation: InternalConversation): string => {
    if (conversation.is_group && conversation.name) {
      return conversation.name;
    }
    
    const otherParticipant = conversation.participants.find(
      p => p.user_id !== currentUserId
    );
    
    return otherParticipant?.profile?.full_name || 'Usuário';
  };

  return {
    conversations,
    loading,
    currentUserId,
    companyId,
    createConversation,
    markAsRead,
    getTotalUnread,
    getConversationDisplayName,
    refresh: () => currentUserId && loadConversations(currentUserId)
  };
};
