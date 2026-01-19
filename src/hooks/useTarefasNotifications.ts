import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Store global para notificações de tarefas
let globalTaskAlertCount = 0;
const listeners = new Set<(count: number) => void>();

const notifyListeners = (count: number) => {
  globalTaskAlertCount = count;
  listeners.forEach(listener => listener(count));
};

export const useTarefasNotifications = () => {
  const [alertCount, setAlertCount] = useState(globalTaskAlertCount);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const initializedRef = useRef(false);

  // Sincronizar com store global
  useEffect(() => {
    const listener = (count: number) => {
      setAlertCount(count);
    };
    
    listeners.add(listener);
    setAlertCount(globalTaskAlertCount);
    
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
      await loadAlertCount(userRole.company_id, user.id);
      setupRealtimeSubscription(userRole.company_id, user.id);
    } catch (error) {
      console.error('Error initializing tarefas notifications:', error);
    }
  };

  const loadAlertCount = async (companyId: string, userId: string) => {
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999);

      // Buscar tarefas não concluídas que estão vencidas ou vencem em até 24h
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date, status')
        .eq('company_id', companyId)
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .lte('due_date', tomorrow.toISOString());

      if (!tasks) {
        notifyListeners(0);
        return;
      }

      // Contar tarefas vencidas (due_date < now) + prestes a vencer (due_date <= tomorrow)
      const alertTasks = tasks.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate <= tomorrow;
      });

      const count = alertTasks.length;
      console.log('📋 [TarefasNotifications] Tarefas com alerta:', count);
      notifyListeners(count);
    } catch (error) {
      console.error('Error loading tarefas alert count:', error);
    }
  };

  const setupRealtimeSubscription = (companyId: string, userId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`tarefas-notifications-${companyId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `company_id=eq.${companyId}`
        },
        () => {
          console.log('📋 [TarefasNotifications] Tarefa alterada, recarregando contagem');
          loadAlertCount(companyId, userId);
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const refreshCount = async () => {
    if (companyId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await loadAlertCount(companyId, user.id);
      }
    }
  };

  return {
    alertCount,
    refreshCount
  };
};
