import { useState, useCallback } from 'react';

interface Notification {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  compromisso_id?: string;
  company_id?: string;
  lida: boolean;
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const sendBrowserNotification = useCallback((titulo: string, mensagem: string, tag?: string) => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(titulo, {
          body: mensagem,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: tag,
          requireInteraction: false,
        });
        console.log('🔔 [NOTIFICAÇÕES] Notificação push enviada:', titulo);
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(titulo, {
              body: mensagem,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: tag,
            });
            console.log('🔔 [NOTIFICAÇÕES] Permissão concedida e notificação enviada');
          }
        });
      }
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    // Desabilitado - tabela notificacoes não existe no banco
    console.log('ℹ️ [NOTIFICAÇÕES] Sistema de notificações desabilitado temporariamente');
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    console.log('ℹ️ [NOTIFICAÇÕES] markAsRead desabilitado');
  }, []);

  const markAllAsRead = useCallback(async () => {
    console.log('ℹ️ [NOTIFICAÇÕES] markAllAsRead desabilitado');
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    console.log('ℹ️ [NOTIFICAÇÕES] deleteNotification desabilitado');
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
  };
}
