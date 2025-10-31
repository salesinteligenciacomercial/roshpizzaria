import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Filter,
  MessageSquare,
  Calendar,
  CheckSquare,
  TrendingUp,
  Clock,
  AlertTriangle,
  Info,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
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

interface NotificationCenterProps {
  userId?: string;
  companyId?: string;
  onNotificationClick?: (notification: Notification) => void;
  onClose?: () => void;
}

export default function NotificationCenter({
  userId,
  companyId,
  onNotificationClick,
  onClose
}: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'urgent'>('all');
  const [filterType, setFilterType] = useState<string>('all');

  // Carregar notificações
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Filtros
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setNotifications(data || []);

    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, companyId]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Sistema de eventos globais para receber novas notificações
  useGlobalSync({
    callbacks: {
      onLeadUpdated: (data) => {
        createNotification({
          type: 'lead',
          title: 'Lead atualizado',
          message: `Lead ${data.name} foi atualizado`,
          priority: 'low',
          metadata: { leadId: data.id }
        });
      },
      onTaskCreated: (data) => {
        createNotification({
          type: 'task',
          title: 'Nova tarefa criada',
          message: `Tarefa "${data.title}" foi criada`,
          priority: data.priority === 'high' ? 'high' : 'medium',
          action_url: `/tarefas/${data.id}`,
          action_label: 'Ver tarefa',
          metadata: { taskId: data.id }
        });
      },
      onTaskUpdated: (data) => {
        if (data.status === 'completed') {
          createNotification({
            type: 'task',
            title: 'Tarefa concluída',
            message: `Tarefa "${data.title}" foi marcada como concluída`,
            priority: 'low',
            metadata: { taskId: data.id }
          });
        }
      },
      onMeetingScheduled: (data) => {
        createNotification({
          type: 'meeting',
          title: 'Reunião agendada',
          message: `Reunião "${data.title}" foi agendada para ${new Date(data.date).toLocaleString('pt-BR')}`,
          priority: 'medium',
          action_url: `/agenda/${data.id}`,
          action_label: 'Ver reunião',
          metadata: { meetingId: data.id }
        });
      },
      onMeetingUpdated: (data) => {
        if (data.status === 'completed') {
          createNotification({
            type: 'meeting',
            title: 'Reunião concluída',
            message: `Reunião "${data.title}" foi concluída`,
            priority: 'low',
            metadata: { meetingId: data.id }
          });
        }
      },
      onConversationStarted: (data) => {
        createNotification({
          type: 'conversation',
          title: 'Nova conversa',
          message: `Nova conversa iniciada com ${data.contactName}`,
          priority: 'medium',
          action_url: `/conversas/${data.id}`,
          action_label: 'Ver conversa',
          metadata: { conversationId: data.id }
        });
      },
      onFunnelStageChanged: (data) => {
        createNotification({
          type: 'lead',
          title: 'Lead movido no funil',
          message: `Lead ${data.leadName} movido de ${data.oldStage} para ${data.newStage}`,
          priority: 'low',
          metadata: { leadId: data.leadId, stageChange: data }
        });
      },
      onAppointmentReminder: (data) => {
        createNotification({
          type: 'meeting',
          title: 'Lembrete de compromisso',
          message: data.title,
          priority: 'urgent',
          action_url: `/agenda/${data.id}`,
          action_label: 'Ver compromisso',
          metadata: { meetingId: data.id }
        });
      }
    },
    showNotifications: false
  });

  // Criar nova notificação
  const createNotification = useCallback(async (notificationData: Omit<Notification, 'id' | 'read' | 'created_at'>) => {
    try {
      const notification: Omit<Notification, 'id'> = {
        ...notificationData,
        read: false,
        created_at: new Date().toISOString(),
        user_id: userId,
        company_id: companyId
      };

      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      if (error) throw error;

      // Adicionar à lista local
      setNotifications(prev => [data, ...prev]);

      // Notificar usuário (se suporte estiver disponível)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }

    } catch (error) {
      console.error('Erro ao criar notificação:', error);
    }
  }, [userId, companyId]);

  // Marcar notificação como lida
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
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

      setNotifications(prev =>
        prev.map(notif => ({ ...notif, read: true }))
      );
    } catch (error) {
      console.error('Erro ao marcar todas notificações como lidas:', error);
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

      setNotifications(prev => prev.filter(notif => notif.id !== notificationId));
    } catch (error) {
      console.error('Erro ao deletar notificação:', error);
    }
  }, []);

  // Filtrar notificações
  const filteredNotifications = notifications.filter(notification => {
    // Filtro por aba
    switch (activeTab) {
      case 'unread':
        if (notification.read) return false;
        break;
      case 'urgent':
        if (notification.priority !== 'urgent' && notification.priority !== 'high') return false;
        break;
    }

    // Filtro por tipo
    if (filterType !== 'all' && notification.type !== filterType) return false;

    return true;
  });

  // Contadores
  const unreadCount = notifications.filter(n => !n.read).length;
  const urgentCount = notifications.filter(n => n.priority === 'urgent' || n.priority === 'high').length;

  // Ícones por tipo
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lead': return <TrendingUp className="h-4 w-4" />;
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'conversation': return <MessageSquare className="h-4 w-4" />;
      case 'system': return <Info className="h-4 w-4" />;
      case 'workflow': return <Settings className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  // Cores por prioridade
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Solicitar permissão para notificações do browser
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Permissão para notificações concedida');
      }
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  return (
    <Card className="w-full max-w-2xl h-[600px] flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center space-x-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Notificações</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Filtros */}
        <div className="px-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <Tabs value={activeTab} onValueChange={(value: any) => setActiveTab(value)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all" className="text-xs">
                  Todas ({notifications.length})
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs">
                  Não lidas {unreadCount > 0 && `(${unreadCount})`}
                </TabsTrigger>
                <TabsTrigger value="urgent" className="text-xs">
                  Urgentes {urgentCount > 0 && `(${urgentCount})`}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center space-x-2 ml-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="all">Todos os tipos</option>
                <option value="lead">Leads</option>
                <option value="task">Tarefas</option>
                <option value="meeting">Reuniões</option>
                <option value="conversation">Conversas</option>
                <option value="system">Sistema</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de notificações */}
        <ScrollArea className="flex-1 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                <p className="text-sm text-muted-foreground">Carregando notificações...</p>
              </div>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                {activeTab === 'unread' ? 'Nenhuma notificação não lida' :
                 activeTab === 'urgent' ? 'Nenhuma notificação urgente' :
                 'Nenhuma notificação encontrada'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-4">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-accent/50 ${
                    !notification.read ? 'bg-blue-50/50 border-blue-200' : ''
                  }`}
                  onClick={() => {
                    if (!notification.read) {
                      markAsRead(notification.id);
                    }
                    if (onNotificationClick) {
                      onNotificationClick(notification);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className={`p-2 rounded-full ${getPriorityColor(notification.priority)}`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-sm truncate">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {notification.priority === 'urgent' ? 'Urgente' :
                             notification.priority === 'high' ? 'Alta' :
                             notification.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                        </div>
                        {notification.action_label && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Implementar navegação para action_url
                              console.log('Navegar para:', notification.action_url);
                            }}
                          >
                            {notification.action_label}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

