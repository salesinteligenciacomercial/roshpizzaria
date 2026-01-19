import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Store global para notificações do chat interno
let globalUnreadCount = 0;
const listeners = new Set<(count: number) => void>();

const notifyListeners = (count: number) => {
  globalUnreadCount = count;
  listeners.forEach(listener => listener(count));
};

export const useInternalChatNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(globalUnreadCount);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initializedRef = useRef(false);

  // Sincronizar com store global
  useEffect(() => {
    const listener = (count: number) => {
      setUnreadCount(count);
    };
    
    listeners.add(listener);
    setUnreadCount(globalUnreadCount);
    
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Inicializar contagem
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    initializeNotifications();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const initializeNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);
      await loadUnreadCount(user.id);
      setupRealtimeSubscription(user.id);
    } catch (error) {
      console.error('Error initializing chat notifications:', error);
    }
  };

  const loadUnreadCount = async (userId: string) => {
    try {
      // Get participations for user
      const { data: participations } = await supabase
        .from('internal_conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (!participations || participations.length === 0) {
        notifyListeners(0);
        return;
      }

      const conversationIds = participations.map(p => p.conversation_id);
      const lastReadMap = new Map(participations.map(p => [p.conversation_id, p.last_read_at]));

      // Get messages after last_read for each conversation
      let totalUnread = 0;

      for (const convoId of conversationIds) {
        const lastRead = lastReadMap.get(convoId);
        
        let query = supabase
          .from('internal_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', convoId)
          .neq('sender_id', userId);

        if (lastRead) {
          query = query.gt('created_at', lastRead);
        }

        const { count } = await query;
        totalUnread += count || 0;
      }

      console.log('💬 [ChatNotifications] Total unread:', totalUnread);
      notifyListeners(totalUnread);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const setupRealtimeSubscription = (userId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`chat-notifications-${userId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_messages'
        },
        async (payload) => {
          const newMessage = payload.new as any;
          
          // Se a mensagem não é do usuário atual, incrementar contador
          if (newMessage.sender_id !== userId) {
            // Verificar se o usuário é participante desta conversa
            const { data: participation } = await supabase
              .from('internal_conversation_participants')
              .select('id')
              .eq('conversation_id', newMessage.conversation_id)
              .eq('user_id', userId)
              .maybeSingle();

            if (participation) {
              console.log('💬 [ChatNotifications] New message received, incrementing count');
              notifyListeners(globalUnreadCount + 1);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'internal_conversation_participants',
          filter: `user_id=eq.${userId}`
        },
        () => {
          // Quando last_read_at é atualizado, recarregar contagem
          console.log('💬 [ChatNotifications] Participant updated, reloading count');
          loadUnreadCount(userId);
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const refreshCount = useCallback(async () => {
    if (currentUserId) {
      await loadUnreadCount(currentUserId);
    }
  }, [currentUserId]);

  // Função para decrementar manualmente (quando marcar como lido)
  const decrementCount = useCallback((amount: number) => {
    const newCount = Math.max(0, globalUnreadCount - amount);
    notifyListeners(newCount);
  }, []);

  // Função para forçar atualização quando marcar conversa como lida
  const markConversationAsRead = useCallback(async () => {
    if (currentUserId) {
      // Pequeno delay para dar tempo do update no banco
      setTimeout(() => {
        loadUnreadCount(currentUserId);
      }, 300);
    }
  }, [currentUserId]);

  return {
    unreadCount,
    refreshCount,
    decrementCount,
    markConversationAsRead
  };
};
