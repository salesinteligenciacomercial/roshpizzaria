import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AIInsight {
  id: string;
  type: 'conversation' | 'agenda' | 'task' | 'funnel' | 'general';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  actionType: 'bottleneck' | 'opportunity' | 'alert' | 'suggestion';
  data: Record<string, any>;
  createdAt: string;
  seen: boolean;
}

interface AIWatcherState {
  insights: AIInsight[];
  unseenCount: number;
  loading: boolean;
}

export function useAIWatcher() {
  const [state, setState] = useState<AIWatcherState>({
    insights: [],
    unseenCount: 0,
    loading: true
  });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();
  const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAnalysisRef = useRef<number>(0);
  
  // Debounce analysis to avoid too many calls
  const ANALYSIS_DEBOUNCE_MS = 5000; // 5 seconds minimum between analyses

  // Get company ID on mount
  useEffect(() => {
    const getCompanyId = async () => {
      const { data } = await supabase.rpc('get_my_company_id');
      if (data) setCompanyId(data);
    };
    getCompanyId();
  }, []);

  // Analyze conversations for bottlenecks and opportunities
  const analyzeConversations = useCallback(async () => {
    if (!companyId) return [];
    const insights: AIInsight[] = [];

    try {
      // Find conversations without response for more than 1 hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: unansweredConversations } = await supabase
        .from('conversas')
        .select('numero, nome_contato, created_at, lead_id')
        .eq('company_id', companyId)
        .eq('fromme', false)
        .eq('status', 'received')
        .lt('created_at', oneHourAgo)
        .order('created_at', { ascending: true })
        .limit(10);

      if (unansweredConversations && unansweredConversations.length > 0) {
        insights.push({
          id: `conv-unanswered-${Date.now()}`,
          type: 'conversation',
          severity: unansweredConversations.length > 5 ? 'high' : 'medium',
          title: `${unansweredConversations.length} conversas aguardando resposta`,
          description: `Há conversas sem resposta há mais de 1 hora. Leads podem esfriar.`,
          actionType: 'alert',
          data: { count: unansweredConversations.length, conversations: unansweredConversations },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Find conversations with potential sales opportunities (keywords)
      const { data: recentMessages } = await supabase
        .from('conversas')
        .select('id, mensagem, nome_contato, numero')
        .eq('company_id', companyId)
        .eq('fromme', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(50);

      const buyingKeywords = ['preço', 'valor', 'quanto', 'comprar', 'quero', 'interesse', 'agendar', 'marcar', 'disponibilidade'];
      const opportunities = recentMessages?.filter(msg => 
        buyingKeywords.some(keyword => msg.mensagem?.toLowerCase().includes(keyword))
      ) || [];

      if (opportunities.length > 0) {
        insights.push({
          id: `conv-opportunity-${Date.now()}`,
          type: 'conversation',
          severity: 'medium',
          title: `${opportunities.length} oportunidades de venda detectadas`,
          description: `Mensagens com intenção de compra/agendamento identificadas`,
          actionType: 'opportunity',
          data: { opportunities },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }
    } catch (error) {
      console.error('Error analyzing conversations:', error);
    }

    return insights;
  }, [companyId]);

  // Analyze agenda for issues
  const analyzeAgenda = useCallback(async () => {
    if (!companyId) return [];
    const insights: AIInsight[] = [];

    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find missed appointments (past, not canceled, not confirmed)
      const { data: missedAppointments } = await supabase
        .from('compromissos')
        .select('id, titulo, paciente, data_hora_inicio, status')
        .eq('company_id', companyId)
        .lt('data_hora_inicio', now.toISOString())
        .gte('data_hora_inicio', today.toISOString())
        .not('status', 'in', '(cancelado,confirmado,realizado)')
        .limit(10);

      if (missedAppointments && missedAppointments.length > 0) {
        insights.push({
          id: `agenda-missed-${Date.now()}`,
          type: 'agenda',
          severity: 'high',
          title: `${missedAppointments.length} compromissos não confirmados`,
          description: `Compromissos de hoje que passaram do horário sem confirmação`,
          actionType: 'alert',
          data: { appointments: missedAppointments },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Find upcoming appointments without reminder
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const { data: upcomingNoReminder } = await supabase
        .from('compromissos')
        .select('id, titulo, paciente, data_hora_inicio, lembrete_enviado')
        .eq('company_id', companyId)
        .gte('data_hora_inicio', now.toISOString())
        .lt('data_hora_inicio', oneHourFromNow.toISOString())
        .eq('lembrete_enviado', false)
        .limit(5);

      if (upcomingNoReminder && upcomingNoReminder.length > 0) {
        insights.push({
          id: `agenda-no-reminder-${Date.now()}`,
          type: 'agenda',
          severity: 'medium',
          title: `${upcomingNoReminder.length} compromissos sem lembrete`,
          description: `Compromissos em menos de 1 hora sem lembrete enviado`,
          actionType: 'suggestion',
          data: { appointments: upcomingNoReminder },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Check for idle time slots today
      const { data: todayAppointments } = await supabase
        .from('compromissos')
        .select('data_hora_inicio, data_hora_fim')
        .eq('company_id', companyId)
        .gte('data_hora_inicio', today.toISOString())
        .lt('data_hora_inicio', tomorrow.toISOString())
        .order('data_hora_inicio');

      // Simple gap detection (more than 2 hours between appointments)
      if (todayAppointments && todayAppointments.length >= 2) {
        let hasLargeGap = false;
        for (let i = 0; i < todayAppointments.length - 1; i++) {
          const currentEnd = new Date(todayAppointments[i].data_hora_fim);
          const nextStart = new Date(todayAppointments[i + 1].data_hora_inicio);
          const gapHours = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);
          if (gapHours > 2) {
            hasLargeGap = true;
            break;
          }
        }
        if (hasLargeGap) {
          insights.push({
            id: `agenda-gap-${Date.now()}`,
            type: 'agenda',
            severity: 'low',
            title: 'Horários ociosos detectados',
            description: 'Há janelas de mais de 2 horas entre compromissos hoje',
            actionType: 'opportunity',
            data: {},
            createdAt: new Date().toISOString(),
            seen: false
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing agenda:', error);
    }

    return insights;
  }, [companyId]);

  // Analyze tasks for bottlenecks
  const analyzeTasks = useCallback(async () => {
    if (!companyId) return [];
    const insights: AIInsight[] = [];

    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Overdue tasks
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, status, assigned_to')
        .eq('company_id', companyId)
        .lt('due_date', today.toISOString())
        .neq('status', 'done')
        .limit(20);

      if (overdueTasks && overdueTasks.length > 0) {
        insights.push({
          id: `task-overdue-${Date.now()}`,
          type: 'task',
          severity: overdueTasks.length > 5 ? 'high' : 'medium',
          title: `${overdueTasks.length} tarefas atrasadas`,
          description: 'Tarefas que passaram da data de vencimento',
          actionType: 'bottleneck',
          data: { tasks: overdueTasks },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Tasks without assignee
      const { data: unassignedTasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, status')
        .eq('company_id', companyId)
        .is('assigned_to', null)
        .neq('status', 'done')
        .limit(10);

      if (unassignedTasks && unassignedTasks.length > 0) {
        insights.push({
          id: `task-unassigned-${Date.now()}`,
          type: 'task',
          severity: 'low',
          title: `${unassignedTasks.length} tarefas sem responsável`,
          description: 'Tarefas que não têm responsável atribuído',
          actionType: 'alert',
          data: { tasks: unassignedTasks },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Blocked tasks (status = blocked or similar)
      const { data: blockedTasks } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('company_id', companyId)
        .eq('status', 'blocked')
        .limit(10);

      if (blockedTasks && blockedTasks.length > 0) {
        insights.push({
          id: `task-blocked-${Date.now()}`,
          type: 'task',
          severity: 'high',
          title: `${blockedTasks.length} tarefas bloqueadas`,
          description: 'Tarefas que estão travadas e precisam de ação',
          actionType: 'bottleneck',
          data: { tasks: blockedTasks },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }
    } catch (error) {
      console.error('Error analyzing tasks:', error);
    }

    return insights;
  }, [companyId]);

  // Analyze funnel for bottlenecks
  const analyzeFunnel = useCallback(async () => {
    if (!companyId) return [];
    const insights: AIInsight[] = [];

    try {
      // Find leads stuck in same stage for more than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: stuckLeads } = await supabase
        .from('leads')
        .select('id, name, etapa_id, updated_at, funil_id')
        .eq('company_id', companyId)
        .lt('updated_at', sevenDaysAgo)
        .not('status', 'in', '(convertido,perdido,won,lost)')
        .limit(20);

      if (stuckLeads && stuckLeads.length > 0) {
        // Get stage names
        const etapaIds = [...new Set(stuckLeads.map(l => l.etapa_id).filter(Boolean))];
        const { data: etapas } = await supabase
          .from('etapas')
          .select('id, nome')
          .in('id', etapaIds);

        const etapaMap = Object.fromEntries((etapas || []).map(e => [e.id, e.nome]));

        insights.push({
          id: `funnel-stuck-${Date.now()}`,
          type: 'funnel',
          severity: stuckLeads.length > 10 ? 'high' : 'medium',
          title: `${stuckLeads.length} leads parados há mais de 7 dias`,
          description: 'Leads que não avançaram no funil recentemente',
          actionType: 'bottleneck',
          data: { leads: stuckLeads, etapas: etapaMap },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Find leads without responsavel
      const { data: orphanLeads } = await supabase
        .from('leads')
        .select('id, name')
        .eq('company_id', companyId)
        .is('responsavel_id', null)
        .not('status', 'in', '(convertido,perdido)')
        .limit(10);

      if (orphanLeads && orphanLeads.length > 0) {
        insights.push({
          id: `funnel-orphan-${Date.now()}`,
          type: 'funnel',
          severity: 'medium',
          title: `${orphanLeads.length} leads sem responsável`,
          description: 'Leads que não têm vendedor atribuído',
          actionType: 'alert',
          data: { leads: orphanLeads },
          createdAt: new Date().toISOString(),
          seen: false
        });
      }

      // Calculate conversion rate drop (simple check)
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const lastMonth = new Date(thisMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const { count: thisMonthConverted } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('conversion_timestamp', thisMonth.toISOString())
        .not('status', 'is', null);

      const { count: lastMonthConverted } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('conversion_timestamp', lastMonth.toISOString())
        .lt('conversion_timestamp', thisMonth.toISOString())
        .not('status', 'is', null);

      if (lastMonthConverted && thisMonthConverted !== null && lastMonthConverted > 0) {
        const conversionDrop = ((lastMonthConverted - thisMonthConverted) / lastMonthConverted) * 100;
        if (conversionDrop > 20) {
          insights.push({
            id: `funnel-conversion-drop-${Date.now()}`,
            type: 'funnel',
            severity: 'high',
            title: 'Queda na taxa de conversão',
            description: `Conversões caíram ${conversionDrop.toFixed(0)}% em relação ao mês anterior`,
            actionType: 'alert',
            data: { thisMonth: thisMonthConverted, lastMonth: lastMonthConverted, dropPercent: conversionDrop },
            createdAt: new Date().toISOString(),
            seen: false
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing funnel:', error);
    }

    return insights;
  }, [companyId]);

  // Run full analysis
  const runAnalysis = useCallback(async (showToast = false) => {
    if (!companyId) return;
    
    // Debounce
    const now = Date.now();
    if (now - lastAnalysisRef.current < ANALYSIS_DEBOUNCE_MS) {
      return;
    }
    lastAnalysisRef.current = now;

    setState(prev => ({ ...prev, loading: true }));

    try {
      const [convInsights, agendaInsights, taskInsights, funnelInsights] = await Promise.all([
        analyzeConversations(),
        analyzeAgenda(),
        analyzeTasks(),
        analyzeFunnel()
      ]);

      const allInsights = [...convInsights, ...agendaInsights, ...taskInsights, ...funnelInsights];
      
      // Sort by severity
      const severityOrder = { high: 0, medium: 1, low: 2 };
      allInsights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      const newHighSeverity = allInsights.filter(i => i.severity === 'high' && !i.seen).length;
      
      setState({
        insights: allInsights,
        unseenCount: allInsights.filter(i => !i.seen).length,
        loading: false
      });

      // Show toast for critical insights
      if (showToast && newHighSeverity > 0) {
        toast({
          title: '🚨 Alerta da IA',
          description: `${newHighSeverity} problema(s) crítico(s) detectado(s)`,
          variant: 'destructive'
        });
      }

      // Save suggestions to database
      for (const insight of allInsights.filter(i => i.severity === 'high')) {
        const { data: existing } = await supabase
          .from('ai_process_suggestions')
          .select('id')
          .eq('company_id', companyId)
          .eq('title', insight.title)
          .eq('status', 'pending')
          .maybeSingle();

        if (!existing) {
          await supabase.from('ai_process_suggestions').insert({
            company_id: companyId,
            title: insight.title,
            suggestion_type: 'melhoria',
            status: 'pending',
            details: {
              description: insight.description,
              type: insight.type,
              actionType: insight.actionType,
              severity: insight.severity,
              data: insight.data,
              generatedBy: 'ai_watcher_realtime'
            }
          });
        }
      }

      // Create notification for critical insights
      if (newHighSeverity > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('notificacoes').insert({
            usuario_id: user.id,
            company_id: companyId,
            tipo: 'ia_insight',
            titulo: `IA detectou ${newHighSeverity} problema(s) crítico(s)`,
            mensagem: allInsights.filter(i => i.severity === 'high').map(i => i.title).join(', '),
            referencia_tipo: 'ai_insights'
          });
        }
      }
    } catch (error) {
      console.error('Error running AI analysis:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [companyId, analyzeConversations, analyzeAgenda, analyzeTasks, analyzeFunnel, toast]);

  // Mark insight as seen
  const markAsSeen = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      insights: prev.insights.map(i => i.id === id ? { ...i, seen: true } : i),
      unseenCount: Math.max(0, prev.unseenCount - 1)
    }));
  }, []);

  // Mark all as seen
  const markAllAsSeen = useCallback(() => {
    setState(prev => ({
      ...prev,
      insights: prev.insights.map(i => ({ ...i, seen: true })),
      unseenCount: 0
    }));
  }, []);

  // Schedule analysis with debounce
  const scheduleAnalysis = useCallback(() => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }
    analysisTimeoutRef.current = setTimeout(() => {
      runAnalysis(true);
    }, ANALYSIS_DEBOUNCE_MS);
  }, [runAnalysis]);

  // Setup realtime subscriptions
  useEffect(() => {
    if (!companyId) return;

    // Initial analysis
    runAnalysis();

    // Subscribe to changes
    const conversasChannel = supabase
      .channel('ai-watcher-conversas')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversas' }, scheduleAnalysis)
      .subscribe();

    const compromissosChannel = supabase
      .channel('ai-watcher-compromissos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compromissos' }, scheduleAnalysis)
      .subscribe();

    const tasksChannel = supabase
      .channel('ai-watcher-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleAnalysis)
      .subscribe();

    const leadsChannel = supabase
      .channel('ai-watcher-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, scheduleAnalysis)
      .subscribe();

    // Periodic refresh every 5 minutes
    const intervalId = setInterval(() => {
      runAnalysis();
    }, 5 * 60 * 1000);

    return () => {
      supabase.removeChannel(conversasChannel);
      supabase.removeChannel(compromissosChannel);
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(leadsChannel);
      clearInterval(intervalId);
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [companyId, runAnalysis, scheduleAnalysis]);

  return {
    insights: state.insights,
    unseenCount: state.unseenCount,
    loading: state.loading,
    refresh: runAnalysis,
    markAsSeen,
    markAllAsSeen
  };
}
