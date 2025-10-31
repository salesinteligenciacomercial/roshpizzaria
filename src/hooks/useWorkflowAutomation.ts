import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalSync, GlobalEventType } from "./useGlobalSync";
import { toast } from "sonner";

// Tipos de condições para triggers
export type TriggerCondition =
  | 'lead-stage-changed'
  | 'lead-created'
  | 'task-completed'
  | 'meeting-completed'
  | 'conversation-started'
  | 'time-based';

// Tipos de ações automatizadas
export type WorkflowAction =
  | 'create-task'
  | 'schedule-meeting'
  | 'send-notification'
  | 'update-lead-stage'
  | 'assign-responsible'
  | 'send-email';

// Interface para trigger de workflow
export interface WorkflowTrigger {
  id: string;
  name: string;
  description: string;
  condition: TriggerCondition;
  conditionParams?: Record<string, any>;
  actions: WorkflowActionConfig[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  company_id?: string;
}

// Interface para configuração de ação
export interface WorkflowActionConfig {
  type: WorkflowAction;
  params: Record<string, any>;
  delay?: number; // em minutos
}

// Interface para execução de workflow
export interface WorkflowExecution {
  id: string;
  trigger_id: string;
  event_type: GlobalEventType;
  event_data: any;
  actions_executed: WorkflowActionResult[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

// Interface para resultado de ação
export interface WorkflowActionResult {
  action_type: WorkflowAction;
  status: 'pending' | 'success' | 'failed';
  result?: any;
  error?: string;
  executed_at?: string;
}

// Workflows padrão do sistema
export const DEFAULT_WORKFLOWS: Omit<WorkflowTrigger, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    name: "Reunião agendada → Criar tarefa de follow-up",
    description: "Quando uma reunião é agendada, cria automaticamente uma tarefa de follow-up",
    condition: 'meeting-completed',
    actions: [
      {
        type: 'create-task',
        params: {
          title: "Follow-up reunião com {{lead.name}}",
          description: "Realizar follow-up da reunião realizada em {{meeting.date}}",
          priority: 'medium',
          due_date_offset: 1 // 1 dia após a reunião
        }
      }
    ],
    enabled: true
  },
  {
    name: "Lead qualificado → Mover para próxima etapa",
    description: "Quando um lead é qualificado, move automaticamente para a próxima etapa do funil",
    condition: 'lead-stage-changed',
    conditionParams: {
      from_stage: 'prospect',
      to_stage: 'qualified'
    },
    actions: [
      {
        type: 'update-lead-stage',
        params: {
          new_stage: 'qualified'
        }
      }
    ],
    enabled: true
  },
  {
    name: "Tarefa atrasada → Notificar responsável",
    description: "Quando uma tarefa está atrasada, notifica o responsável",
    condition: 'time-based',
    conditionParams: {
      entity_type: 'task',
      time_condition: 'overdue'
    },
    actions: [
      {
        type: 'send-notification',
        params: {
          message: "Tarefa '{{task.title}}' está atrasada",
          priority: 'high',
          recipients: ['assigned_user']
        }
      }
    ],
    enabled: true
  },
  {
    name: "Nova conversa → Criar tarefa de resposta",
    description: "Quando uma nova conversa é iniciada, cria tarefa para resposta",
    condition: 'conversation-started',
    actions: [
      {
        type: 'create-task',
        params: {
          title: "Responder conversa com {{lead.name}}",
          description: "Responder à nova conversa iniciada",
          priority: 'high',
          due_date_offset: 0.5 // 12 horas
        }
      }
    ],
    enabled: true
  }
];

/**
 * Hook para automação de workflows baseada em eventos globais
 * Permite criar triggers que executam ações automaticamente quando certas condições são atendidas
 *
 * FUNCIONALIDADES:
 * - Triggers baseados em eventos globais
 * - Ações automatizadas (tarefas, reuniões, notificações)
 * - Workflows personalizáveis
 * - Execução assíncrona com logging
 * - Filtragem por empresa
 */
export const useWorkflowAutomation = ({
  companyId,
  showNotifications = true
}: {
  companyId?: string;
  showNotifications?: boolean;
} = {}) => {

  // Executar ação de workflow
  const executeWorkflowAction = useCallback(async (
    action: WorkflowActionConfig,
    eventData: any,
    leadData?: any
  ): Promise<WorkflowActionResult> => {
    try {
      console.log('🔄 [Workflow] Executando ação:', action.type, action);

      let result: any = null;

      switch (action.type) {
        case 'create-task': {
          const taskData = {
            title: action.params.title.replace('{{lead.name}}', leadData?.name || 'Cliente'),
            description: action.params.description?.replace('{{lead.name}}', leadData?.name || 'Cliente'),
            priority: action.params.priority || 'medium',
            status: 'pending',
            lead_id: eventData.leadId || leadData?.id,
            assigned_to: action.params.assigned_to,
            due_date: action.params.due_date_offset ?
              new Date(Date.now() + (action.params.due_date_offset * 24 * 60 * 60 * 1000)).toISOString() :
              null,
            company_id: companyId
          };

          const { data, error } = await supabase
            .from('tasks')
            .insert(taskData)
            .select()
            .single();

          if (error) throw error;
          result = data;

          // Emitir evento global para sincronização
          if (window.emitGlobalEvent) {
            window.emitGlobalEvent({
              type: 'task-created',
              data: result,
              source: 'Workflow Automatizado'
            });
          }

          break;
        }

        case 'schedule-meeting': {
          const meetingData = {
            title: action.params.title.replace('{{lead.name}}', leadData?.name || 'Cliente'),
            description: action.params.description,
            date: action.params.date,
            duration: action.params.duration || 60,
            status: 'scheduled',
            lead_id: eventData.leadId || leadData?.id,
            location: action.params.location,
            company_id: companyId
          };

          const { data, error } = await supabase
            .from('meetings')
            .insert(meetingData)
            .select()
            .single();

          if (error) throw error;
          result = data;

          // Emitir evento global
          if (window.emitGlobalEvent) {
            window.emitGlobalEvent({
              type: 'meeting-scheduled',
              data: result,
              source: 'Workflow Automatizado'
            });
          }

          break;
        }

        case 'update-lead-stage': {
          const { error } = await supabase
            .from('leads')
            .update({
              stage: action.params.new_stage,
              updated_at: new Date().toISOString()
            })
            .eq('id', eventData.leadId || leadData?.id);

          if (error) throw error;
          result = { new_stage: action.params.new_stage };

          break;
        }

        case 'send-notification': {
          // Implementar sistema de notificações
          console.log('📢 [Workflow] Enviando notificação:', action.params);
          result = { message: 'Notificação enviada' };
          break;
        }

        default:
          throw new Error(`Ação não suportada: ${action.type}`);
      }

      return {
        action_type: action.type,
        status: 'success',
        result,
        executed_at: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ [Workflow] Erro ao executar ação:', error);
      return {
        action_type: action.type,
        status: 'failed',
        error: error.message,
        executed_at: new Date().toISOString()
      };
    }
  }, [companyId]);

  // Verificar se trigger deve ser executado
  const shouldExecuteTrigger = useCallback((trigger: WorkflowTrigger, eventType: GlobalEventType, eventData: any): boolean => {
    if (!trigger.enabled) return false;

    switch (trigger.condition) {
      case 'lead-stage-changed':
        return eventType === 'funnel-stage-changed' &&
               (!trigger.conditionParams?.from_stage || eventData.oldStage === trigger.conditionParams.from_stage) &&
               (!trigger.conditionParams?.to_stage || eventData.newStage === trigger.conditionParams.to_stage);

      case 'lead-created':
        return eventType === 'lead-created';

      case 'task-completed':
        return eventType === 'task-updated' && eventData.status === 'completed';

      case 'meeting-completed':
        return eventType === 'meeting-updated' && eventData.status === 'completed';

      case 'conversation-started':
        return eventType === 'conversation-started';

      case 'time-based':
        // Para condições baseadas em tempo, seria necessário um scheduler separado
        return false;

      default:
        return false;
    }
  }, []);

  // Executar workflow completo
  const executeWorkflow = useCallback(async (trigger: WorkflowTrigger, eventType: GlobalEventType, eventData: any) => {
    if (!shouldExecuteTrigger(trigger, eventType, eventData)) {
      return;
    }

    console.log('🚀 [Workflow] Executando workflow:', trigger.name);

    try {
      // Buscar dados do lead se necessário
      let leadData = null;
      if (eventData.leadId) {
        const { data } = await supabase
          .from('leads')
          .select('*')
          .eq('id', eventData.leadId)
          .single();
        leadData = data;
      }

      // Executar ações em sequência
      const actionResults: WorkflowActionResult[] = [];

      for (const action of trigger.actions) {
        // Adicionar delay se especificado
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay * 60 * 1000));
        }

        const result = await executeWorkflowAction(action, eventData, leadData);
        actionResults.push(result);

        // Se uma ação falhou e era crítica, parar execução
        if (result.status === 'failed' && action.params?.critical) {
          break;
        }
      }

      // Registrar execução
      const executionData = {
        trigger_id: trigger.id,
        event_type: eventType,
        event_data: eventData,
        actions_executed: actionResults,
        status: actionResults.every(r => r.status === 'success') ? 'completed' : 'failed',
        completed_at: new Date().toISOString(),
        company_id: companyId
      };

      const { error } = await supabase
        .from('workflow_executions')
        .insert(executionData);

      if (error) {
        console.error('❌ [Workflow] Erro ao registrar execução:', error);
      }

      if (showNotifications) {
        const successCount = actionResults.filter(r => r.status === 'success').length;
        const totalCount = actionResults.length;

        if (successCount === totalCount) {
          toast.success(`Workflow "${trigger.name}" executado com sucesso`);
        } else {
          toast.warning(`Workflow "${trigger.name}" executado parcialmente (${successCount}/${totalCount} ações)`);
        }
      }

    } catch (error: any) {
      console.error('❌ [Workflow] Erro ao executar workflow:', error);

      // Registrar falha
      const { error: logError } = await supabase
        .from('workflow_executions')
        .insert({
          trigger_id: trigger.id,
          event_type: eventType,
          event_data: eventData,
          actions_executed: [],
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
          company_id: companyId
        });

      if (logError) {
        console.error('❌ [Workflow] Erro ao registrar falha:', logError);
      }

      if (showNotifications) {
        toast.error(`Erro ao executar workflow "${trigger.name}": ${error.message}`);
      }
    }
  }, [shouldExecuteTrigger, executeWorkflowAction, companyId, showNotifications]);

  // Hook para ouvir eventos globais e executar workflows
  useGlobalSync({
    callbacks: {
      onFunnelStageChanged: (data) => {
        console.log('🎯 [Workflow] Evento funnel-stage-changed detectado');
        executeWorkflowForEvent('funnel-stage-changed', data);
      },
      onLeadCreated: (data) => {
        console.log('🎯 [Workflow] Evento lead-created detectado');
        executeWorkflowForEvent('lead-created', data);
      },
      onTaskUpdated: (data) => {
        if (data.status === 'completed') {
          console.log('🎯 [Workflow] Evento task-completed detectado');
          executeWorkflowForEvent('task-updated', data);
        }
      },
      onMeetingUpdated: (data) => {
        if (data.status === 'completed') {
          console.log('🎯 [Workflow] Evento meeting-completed detectado');
          executeWorkflowForEvent('meeting-updated', data);
        }
      },
      onConversationStarted: (data) => {
        console.log('🎯 [Workflow] Evento conversation-started detectado');
        executeWorkflowForEvent('conversation-started', data);
      }
    },
    showNotifications: false
  });

  // Executar workflows para um evento específico
  const executeWorkflowForEvent = useCallback(async (eventType: GlobalEventType, eventData: any) => {
    try {
      // Buscar workflows ativos
      const { data: workflows, error } = await supabase
        .from('workflow_triggers')
        .select('*')
        .eq('enabled', true)
        .eq('company_id', companyId);

      if (error) {
        console.error('❌ [Workflow] Erro ao buscar workflows:', error);
        return;
      }

      if (!workflows || workflows.length === 0) {
        return;
      }

      // Executar workflows que atendem às condições
      const executionPromises = workflows
        .filter(trigger => shouldExecuteTrigger(trigger, eventType, eventData))
        .map(trigger => executeWorkflow(trigger, eventType, eventData));

      await Promise.allSettled(executionPromises);

    } catch (error) {
      console.error('❌ [Workflow] Erro ao executar workflows para evento:', error);
    }
  }, [shouldExecuteTrigger, executeWorkflow, companyId]);

  // Criar workflow padrão
  const createDefaultWorkflows = useCallback(async () => {
    try {
      console.log('🔄 [Workflow] Criando workflows padrão...');

      for (const workflow of DEFAULT_WORKFLOWS) {
        const { error } = await supabase
          .from('workflow_triggers')
          .insert({
            ...workflow,
            company_id: companyId
          });

        if (error && !error.message.includes('duplicate key')) {
          console.error('❌ [Workflow] Erro ao criar workflow:', workflow.name, error);
        }
      }

      console.log('✅ [Workflow] Workflows padrão criados');
    } catch (error) {
      console.error('❌ [Workflow] Erro ao criar workflows padrão:', error);
    }
  }, [companyId]);

  // Função para criar workflow personalizado
  const createWorkflow = useCallback(async (workflow: Omit<WorkflowTrigger, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('workflow_triggers')
        .insert({
          ...workflow,
          company_id: companyId
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [Workflow] Workflow criado:', data);
      return data;
    } catch (error: any) {
      console.error('❌ [Workflow] Erro ao criar workflow:', error);
      throw error;
    }
  }, [companyId]);

  // Função para listar workflows
  const getWorkflows = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('workflow_triggers')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('❌ [Workflow] Erro ao buscar workflows:', error);
      return [];
    }
  }, [companyId]);

  // Inicializar workflows padrão na primeira execução
  useEffect(() => {
    const initializeWorkflows = async () => {
      const existingWorkflows = await getWorkflows();
      if (existingWorkflows.length === 0) {
        await createDefaultWorkflows();
      }
    };

    initializeWorkflows();
  }, [getWorkflows, createDefaultWorkflows]);

  return {
    createWorkflow,
    getWorkflows,
    executeWorkflow,
    createDefaultWorkflows
  };
};

