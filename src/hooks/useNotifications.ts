import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NotificationData {
  id: string;
  type: 'lead' | 'task' | 'meeting' | 'conversation' | 'system' | 'workflow';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  read: boolean;
  action_url?: string;
  action_label?: string;
  metadata?: Record<string, any>;
  created_at: string;
  user_id?: string;
  company_id?: string;
}

/**
 * Hook para gerenciar notificações do usuário
 * Permite criar, ler, marcar como lida e excluir notificações
 */
export const useNotifications = ({
  userId,
  companyId,
  autoLoad = true
}: {
  userId?: string;
  companyId?: string;
  autoLoad?: boolean;
} = {}) => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Carregar notificações
  const loadNotifications = useCallback(async () => {
    if (!autoLoad) return;

    setLoading(true);
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const notificationsData = data || [];
      setNotifications(notificationsData);
      setUnreadCount(notificationsData.filter(n => !n.read).length);

    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, companyId, autoLoad]);

  // Carregar notificações na inicialização
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Inscrever-se para atualizações em tempo real
  useEffect(() => {
    if (!autoLoad) return;

    const channel = supabase
      .channel('notifications_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: companyId ? `company_id=eq.${companyId}` : undefined
        },
        (payload) => {
          console.log('📡 [Notifications] Mudança detectada:', payload);

          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as NotificationData, ...prev]);
            setUnreadCount(prev => prev + 1);
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev =>
              prev.map(n => n.id === payload.new.id ? payload.new as NotificationData : n)
            );
            // Recalcular unread count
            loadNotifications();
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
            setUnreadCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, autoLoad, loadNotifications]);

  // Criar notificação
  const createNotification = useCallback(async (
    notification: Omit<NotificationData, 'id' | 'read' | 'created_at'>
  ) => {
    try {
      const notificationData: Omit<NotificationData, 'id'> = {
        ...notification,
        read: false,
        created_at: new Date().toISOString(),
        user_id: userId,
        company_id: companyId
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(notificationData)
        .select()
        .single();

      if (error) throw error;

      // Notificar usuário via browser notification se disponível
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
          tag: notification.type
        });
      }

      return data;
    } catch (error) {
      console.error('Erro ao criar notificação:', error);
      throw error;
    }
  }, [userId, companyId]);

  // Marcar como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      throw error;
    }
  }, []);

  // Marcar todas como lidas
  const markAllAsRead = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false)
        .eq('company_id', companyId);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);

    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
      throw error;
    }
  }, [companyId]);

  // Deletar notificação
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      const wasUnread = notifications.find(n => n.id === notificationId)?.read === false;
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
      throw error;
    }
  }, [notifications]);

  // Limpar todas as notificações
  const clearAllNotifications = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('company_id', companyId);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);

    } catch (error) {
      console.error('Erro ao limpar notificações:', error);
      throw error;
    }
  }, [companyId]);

  return {
    notifications,
    unreadCount,
    loading,
    createNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    reloadNotifications: loadNotifications
  };
};

