import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Phone,
  Mail,
  Building2,
  Calendar,
  MessageSquare,
  CheckSquare,
  TrendingUp,
  Clock,
  Target,
  DollarSign,
  Activity,
  Users,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { formatPhoneNumber } from "@/utils/phoneFormatter";

interface ClienteOverviewProps {
  leadId: string;
  onClose?: () => void;
}

interface LeadData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  value: number;
  stage: string;
  status: string;
  created_at: string;
  updated_at: string;
  notes: string | null;
  tags: string[];
  funil_id: string | null;
  etapa_id: string | null;
  servico: string | null;
  segmentacao: string | null;
}

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  assigned_to: string | null;
}

interface MeetingData {
  id: string;
  title: string;
  description: string | null;
  date: string;
  duration: number;
  status: string;
  location: string | null;
  created_at: string;
}

interface ConversationData {
  id: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: string;
}

export default function ClienteOverview({ leadId, onClose }: ClienteOverviewProps) {
  const [lead, setLead] = useState<LeadData | null>(null);
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [meetings, setMeetings] = useState<MeetingData[]>([]);
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Hook para sincronização global
  useGlobalSync({
    callbacks: {
      onLeadUpdated: (data) => {
        if (data.id === leadId) {
          console.log('📊 [ClienteOverview] Lead atualizado via sync:', data);
          setLead(prev => prev ? { ...prev, ...data } : null);
        }
      },
      onTaskCreated: (data) => {
        if (data.lead_id === leadId) {
          console.log('📊 [ClienteOverview] Nova tarefa criada:', data);
          setTasks(prev => [data, ...prev]);
        }
      },
      onTaskUpdated: (data) => {
        setTasks(prev => prev.map(task =>
          task.id === data.id ? data : task
        ));
      },
      onMeetingScheduled: (data) => {
        if (data.lead_id === leadId) {
          console.log('📊 [ClienteOverview] Reunião agendada:', data);
          setMeetings(prev => [data, ...prev]);
        }
      },
      onMeetingUpdated: (data) => {
        setMeetings(prev => prev.map(meeting =>
          meeting.id === data.id ? data : meeting
        ));
      }
    },
    showNotifications: false
  });

  useEffect(() => {
    loadClienteData();
  }, [leadId]);

  const loadClienteData = async () => {
    try {
      setLoading(true);

      // Carregar dados do lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      // Carregar tarefas vinculadas
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!tasksError) {
        setTasks(tasksData || []);
      }

      // Carregar reuniões vinculadas
      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*')
        .eq('lead_id', leadId)
        .order('date', { ascending: false })
        .limit(10);

      if (!meetingsError) {
        setMeetings(meetingsData || []);
      }

      // Carregar conversas (simplificado - baseado em telefone)
      if (leadData?.phone) {
        const { data: conversationsData, error: conversationsError } = await supabase
          .from('conversations')
          .select('*')
          .eq('phoneNumber', leadData.phone)
          .order('lastMessageTime', { ascending: false })
          .limit(5);

        if (!conversationsError) {
          setConversations(conversationsData || []);
        }
      }

    } catch (error) {
      console.error('Erro ao carregar dados do cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  // Métricas calculadas
  const metrics = useMemo(() => {
    if (!lead) return null;

    const pendingTasks = tasks.filter(t => t.status !== 'completed').length;
    const upcomingMeetings = meetings.filter(m =>
      new Date(m.date) > new Date() && m.status !== 'cancelled'
    ).length;
    const activeConversations = conversations.filter(c => c.status === 'active').length;
    const daysSinceLastUpdate = lead.updated_at ?
      Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      pendingTasks,
      upcomingMeetings,
      activeConversations,
      daysSinceLastUpdate,
      totalValue: lead.value || 0,
      engagementScore: Math.min(100, (activeConversations * 20) + (upcomingMeetings * 15) + (pendingTasks * 5))
    };
  }, [lead, tasks, meetings, conversations]);

  // Timeline de atividades
  const timelineActivities = useMemo(() => {
    const activities: Array<{
      id: string;
      type: 'task' | 'meeting' | 'conversation' | 'stage_change';
      title: string;
      description: string;
      timestamp: string;
      status?: string;
    }> = [];

    // Adicionar tarefas
    tasks.forEach(task => {
      activities.push({
        id: `task-${task.id}`,
        type: 'task',
        title: `Tarefa: ${task.title}`,
        description: task.description || '',
        timestamp: task.created_at,
        status: task.status
      });
    });

    // Adicionar reuniões
    meetings.forEach(meeting => {
      activities.push({
        id: `meeting-${meeting.id}`,
        type: 'meeting',
        title: `Reunião: ${meeting.title}`,
        description: meeting.description || '',
        timestamp: meeting.created_at,
        status: meeting.status
      });
    });

    // Adicionar conversas
    conversations.forEach(conv => {
      activities.push({
        id: `conv-${conv.id}`,
        type: 'conversation',
        title: `Conversa com ${conv.contactName}`,
        description: conv.lastMessage,
        timestamp: conv.lastMessageTime
      });
    });

    // Ordenar por timestamp (mais recente primeiro)
    return activities.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [tasks, meetings, conversations]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'conversation': return <MessageSquare className="h-4 w-4" />;
      case 'stage_change': return <TrendingUp className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'pending': return 'bg-yellow-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-muted-foreground">Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-500 mb-4">Cliente não encontrado</p>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header com informações básicas */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg">
                  {lead.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-2xl">{lead.name}</CardTitle>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  {lead.company && (
                    <div className="flex items-center space-x-1">
                      <Building2 className="h-4 w-4" />
                      <span>{lead.company}</span>
                    </div>
                  )}
                  <Badge variant={lead.stage === 'closed_won' ? 'default' : 'secondary'}>
                    {lead.stage}
                  </Badge>
                  <Badge variant="outline">
                    R$ {lead.value?.toLocaleString('pt-BR') || '0'}
                  </Badge>
                </div>
              </div>
            </div>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Contato */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">CONTATO</h4>
              {lead.email && (
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatPhoneNumber(lead.phone)}</span>
                </div>
              )}
            </div>

            {/* Métricas Rápidas */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">MÉTRICAS</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>Tarefas pendentes</span>
                  <Badge variant="secondary">{metrics?.pendingTasks || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Reuniões agendadas</span>
                  <Badge variant="secondary">{metrics?.upcomingMeetings || 0}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Conversas ativas</span>
                  <Badge variant="secondary">{metrics?.activeConversations || 0}</Badge>
                </div>
              </div>
            </div>

            {/* Última Atividade */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">ATIVIDADE</h4>
              <div className="text-sm">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Última atualização: {metrics?.daysSinceLastUpdate || 0} dias atrás</span>
                </div>
                <div className="flex items-center space-x-1 mt-1">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span>Engajamento: {metrics?.engagementScore || 0}%</span>
                </div>
              </div>
            </div>

            {/* Valor e Status */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-muted-foreground">NEGÓCIO</h4>
              <div className="space-y-1">
                <div className="flex items-center space-x-1 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">R$ {lead.value?.toLocaleString('pt-BR') || '0'}</span>
                </div>
                <Badge variant={lead.status === 'active' ? 'default' : 'secondary'}>
                  {lead.status}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs com detalhes */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="meetings">Agenda ({meetings.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Resumo de Atividades Recentes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Atividades Recentes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {timelineActivities.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{activity.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      {activity.status && (
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(activity.status)}`} />
                      )}
                    </div>
                  ))}
                  {timelineActivities.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma atividade recente
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Informações Detalhadas */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span>Informações Detalhadas</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lead.servico && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Serviço</label>
                    <p className="text-sm">{lead.servico}</p>
                  </div>
                )}
                {lead.segmentacao && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Segmentação</label>
                    <p className="text-sm">{lead.segmentacao}</p>
                  </div>
                )}
                {lead.tags && lead.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tags</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {lead.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {lead.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Anotações</label>
                    <p className="text-sm mt-1">{lead.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckSquare className="h-5 w-5" />
                <span>Tarefas Vinculadas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{task.title}</h4>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                            {task.status}
                          </Badge>
                          {task.priority && (
                            <Badge variant="outline">{task.priority}</Badge>
                          )}
                          {task.due_date && (
                            <span className="text-xs text-muted-foreground">
                              Vence em: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma tarefa vinculada a este cliente
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Reuniões Agendadas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {meetings.length > 0 ? (
                <div className="space-y-3">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="flex items-start justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{meeting.title}</h4>
                        {meeting.description && (
                          <p className="text-sm text-muted-foreground mt-1">{meeting.description}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge variant={meeting.status === 'confirmed' ? 'default' : 'secondary'}>
                            {meeting.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(meeting.date).toLocaleString('pt-BR')} ({meeting.duration}min)
                          </span>
                          {meeting.location && (
                            <span className="text-xs text-muted-foreground">• {meeting.location}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma reunião agendada para este cliente
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Timeline Completo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timelineActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="w-0.5 h-8 bg-border mt-2"></div>
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{activity.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                      )}
                      {activity.status && (
                        <Badge variant="outline" className="mt-2">
                          {activity.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {timelineActivities.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma atividade registrada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

