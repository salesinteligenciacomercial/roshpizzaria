import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Notification {
  id: string;
  usuario_id: string;
  company_id: string | null;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  referencia_id: string | null;
  referencia_tipo: string | null;
  lida: boolean;
  created_at: string;
}

export interface AggregatedNotification {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  referencia_id?: string;
  referencia_tipo?: string;
  created_at: string;
  lida: boolean;
  severity?: 'high' | 'medium' | 'low';
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AggregatedNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification(titulo, {
              body: mensagem,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: tag,
            });
          }
        });
      }
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('ℹ️ [NOTIFICAÇÕES] Usuário não autenticado');
        setLoading(false);
        return;
      }

      // Get user's company_id from user_roles
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const companyId = userRole?.company_id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const aggregatedNotifications: AggregatedNotification[] = [];

      // 1. Load stored notifications from database
      const { data: storedNotifications } = await supabase
        .from('notificacoes')
        .select('*')
        .eq('usuario_id', user.id)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (storedNotifications) {
        storedNotifications.forEach((n: Notification) => {
          aggregatedNotifications.push({
            id: n.id,
            tipo: n.tipo,
            titulo: n.titulo,
            mensagem: n.mensagem || '',
            referencia_id: n.referencia_id || undefined,
            referencia_tipo: n.referencia_tipo || undefined,
            created_at: n.created_at,
            lida: n.lida,
          });
        });
      }

      // 2. Load tasks for today (from tasks table)
      if (companyId) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, due_date, status')
          .eq('company_id', companyId)
          .gte('due_date', today.toISOString())
          .lt('due_date', tomorrow.toISOString())
          .neq('status', 'done');

        if (tasks) {
          tasks.forEach(task => {
            const exists = aggregatedNotifications.some(
              n => n.referencia_id === task.id && n.tipo === 'tarefa_hoje'
            );
            if (!exists) {
              aggregatedNotifications.push({
                id: `task-${task.id}`,
                tipo: 'tarefa_hoje',
                titulo: task.title,
                mensagem: `Tarefa vence hoje`,
                referencia_id: task.id,
                referencia_tipo: 'tasks',
                created_at: new Date().toISOString(),
                lida: false,
              });
            }
          });
        }

        // 3. Load overdue tasks
        const { data: overdueTasks } = await supabase
          .from('tasks')
          .select('id, title, due_date, status')
          .eq('company_id', companyId)
          .lt('due_date', today.toISOString())
          .neq('status', 'done');

        if (overdueTasks) {
          overdueTasks.forEach(task => {
            const exists = aggregatedNotifications.some(
              n => n.referencia_id === task.id && n.tipo === 'tarefa_atrasada'
            );
            if (!exists) {
              const dueDate = new Date(task.due_date);
              aggregatedNotifications.push({
                id: `task-overdue-${task.id}`,
                tipo: 'tarefa_atrasada',
                titulo: task.title,
                mensagem: `Venceu em ${dueDate.toLocaleDateString('pt-BR')}`,
                referencia_id: task.id,
                referencia_tipo: 'tasks',
                created_at: new Date().toISOString(),
                lida: false,
              });
            }
          });
        }

        // 4. Load today's appointments (compromissos)
        const { data: compromissos } = await supabase
          .from('compromissos')
          .select('id, titulo, tipo_servico, data_hora_inicio, paciente')
          .eq('company_id', companyId)
          .gte('data_hora_inicio', today.toISOString())
          .lt('data_hora_inicio', tomorrow.toISOString())
          .neq('status', 'cancelado');

        if (compromissos) {
          compromissos.forEach(comp => {
            const exists = aggregatedNotifications.some(
              n => n.referencia_id === comp.id && n.tipo === 'compromisso_hoje'
            );
            if (!exists) {
              const hora = new Date(comp.data_hora_inicio).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              aggregatedNotifications.push({
                id: `compromisso-${comp.id}`,
                tipo: 'compromisso_hoje',
                titulo: comp.titulo || comp.tipo_servico,
                mensagem: `${comp.paciente ? `${comp.paciente} - ` : ''}Hoje às ${hora}`,
                referencia_id: comp.id,
                referencia_tipo: 'compromissos',
                created_at: new Date().toISOString(),
                lida: false,
              });
            }
          });
        }

        // 5. Load pending reminders (lembretes)
        const { data: lembretes } = await supabase
          .from('lembretes')
          .select('id, mensagem, data_hora_envio, status_envio, compromisso_id')
          .eq('company_id', companyId)
          .eq('status_envio', 'pendente')
          .gte('data_hora_envio', today.toISOString())
          .lt('data_hora_envio', tomorrow.toISOString());

        if (lembretes) {
          lembretes.forEach(lembrete => {
            const exists = aggregatedNotifications.some(
              n => n.referencia_id === lembrete.id && n.tipo === 'lembrete_pendente'
            );
            if (!exists) {
              const hora = lembrete.data_hora_envio 
                ? new Date(lembrete.data_hora_envio).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '';
              aggregatedNotifications.push({
                id: `lembrete-${lembrete.id}`,
                tipo: 'lembrete_pendente',
                titulo: 'Lembrete pendente',
                mensagem: hora ? `Enviar às ${hora}` : (lembrete.mensagem || 'Lembrete agendado'),
                referencia_id: lembrete.id,
                referencia_tipo: 'lembretes',
                created_at: new Date().toISOString(),
                lida: false,
              });
            }
          });
        }
      }

      // Sort by created_at descending
      aggregatedNotifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setNotifications(aggregatedNotifications);
      setUnreadCount(aggregatedNotifications.filter(n => !n.lida).length);
      console.log('🔔 [NOTIFICAÇÕES] Carregadas:', aggregatedNotifications.length);
    } catch (error) {
      console.error('❌ [NOTIFICAÇÕES] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      // Check if it's a database notification (UUID format)
      const isDbNotification = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isDbNotification) {
        await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('id', id);
      }

      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, lida: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('❌ [NOTIFICAÇÕES] Erro ao marcar como lida:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('notificacoes')
          .update({ lida: true })
          .eq('usuario_id', user.id)
          .eq('lida', false);
      }

      setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
      setUnreadCount(0);
      
      toast({
        title: "Notificações",
        description: "Todas as notificações foram marcadas como lidas",
      });
    } catch (error) {
      console.error('❌ [NOTIFICAÇÕES] Erro ao marcar todas como lidas:', error);
    }
  }, [toast]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const isDbNotification = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isDbNotification) {
        await supabase
          .from('notificacoes')
          .delete()
          .eq('id', id);
      }

      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.lida) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('❌ [NOTIFICAÇÕES] Erro ao deletar:', error);
    }
  }, [notifications]);

  // Setup realtime subscription
  useEffect(() => {
    loadNotifications();

    const channel = supabase
      .channel('notificacoes-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificacoes',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: loadNotifications,
    sendBrowserNotification,
  };
}
