import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Store global para notificações de conversas WhatsApp
let globalUnreadCount = 0;
const listeners = new Set<(count: number) => void>();

const notifyListeners = (count: number) => {
  globalUnreadCount = count;
  listeners.forEach(listener => listener(count));
};

export const useConversasNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(globalUnreadCount);
  const [companyId, setCompanyId] = useState<string | null>(null);
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
      
      // Obter company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;
      
      setCompanyId(userRole.company_id);
      await loadUnreadCount(userRole.company_id);
      setupRealtimeSubscription(userRole.company_id);
    } catch (error) {
      console.error('Error initializing conversas notifications:', error);
    }
  };

  const loadUnreadCount = async (companyId: string) => {
    try {
      // Contar mensagens não lidas (fromme = false significa mensagem recebida do cliente)
      // Agrupamos por número único para contar conversas, não mensagens individuais
      const { data: conversas } = await supabase
        .from('conversas')
        .select('telefone_formatado, read')
        .eq('company_id', companyId)
        .eq('fromme', false) // Apenas mensagens recebidas
        .eq('read', false); // Apenas não lidas

      if (!conversas) {
        notifyListeners(0);
        return;
      }

      // Contar conversas únicas com mensagens não lidas
      const uniqueConversations = new Set(conversas.map(c => c.telefone_formatado));
      const count = uniqueConversations.size;

      console.log('📱 [ConversasNotifications] Conversas não lidas:', count);
      notifyListeners(count);
    } catch (error) {
      console.error('Error loading conversas unread count:', error);
    }
  };

  const setupRealtimeSubscription = (companyId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`conversas-notifications-${companyId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversas',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Se é mensagem recebida (não enviada pelo CRM)
          if (newMessage.fromme === false) {
            console.log('📱 [ConversasNotifications] Nova mensagem recebida, recarregando contagem');
            loadUnreadCount(companyId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversas',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          const oldMessage = payload.old as any;
          
          // Se o campo read foi alterado
          if (oldMessage.read !== updatedMessage.read) {
            console.log('📱 [ConversasNotifications] Status de leitura alterado, recarregando contagem');
            loadUnreadCount(companyId);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const refreshCount = async () => {
    if (companyId) {
      await loadUnreadCount(companyId);
    }
  };

  return {
    unreadCount,
    refreshCount
  };
};
