import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tipos de eventos globais
export type GlobalEventType =
  | 'lead-updated'
  | 'lead-created'
  | 'lead-deleted'
  | 'task-created'
  | 'task-updated'
  | 'task-deleted'
  | 'meeting-scheduled'
  | 'meeting-updated'
  | 'meeting-completed'
  | 'conversation-started'
  | 'conversation-updated'
  | 'funnel-stage-changed'
  | 'appointment-reminder';

// Interface para payload de eventos
export interface GlobalEventPayload {
  type: GlobalEventType;
  data: any;
  source: string; // Nome do módulo que originou o evento
  timestamp: string;
  userId?: string;
  companyId?: string;
}

// Interface para callbacks de eventos
export interface GlobalSyncCallbacks {
  onLeadUpdated?: (data: any) => void;
  onLeadCreated?: (data: any) => void;
  onLeadDeleted?: (data: any) => void;
  onTaskCreated?: (data: any) => void;
  onTaskUpdated?: (data: any) => void;
  onTaskDeleted?: (data: any) => void;
  onMeetingScheduled?: (data: any) => void;
  onMeetingUpdated?: (data: any) => void;
  onMeetingCompleted?: (data: any) => void;
  onConversationStarted?: (data: any) => void;
  onConversationUpdated?: (data: any) => void;
  onFunnelStageChanged?: (data: any) => void;
  onAppointmentReminder?: (data: any) => void;
}

// Canal singleton compartilhado para eventos globais
let globalChannel: any = null;
let globalSubscriberCount = 0;
let globalReconnectAttempts = 0;
const MAX_GLOBAL_RECONNECT_ATTEMPTS = 5;
const GLOBAL_RECONNECT_DELAY = 2000;

/**
 * Hook global de sincronização entre módulos
 * Permite comunicação em tempo real entre Leads, Funil, Conversas, Agenda e Tarefas
 * Usa Supabase Realtime com canal compartilhado para otimizar recursos
 *
 * FUNCIONALIDADES:
 * - Eventos globais entre módulos
 * - Canal compartilhado (singleton)
 * - Reconexão automática
 * - Filtragem por empresa
 * - Callbacks específicos por tipo de evento
 */
export const useGlobalSync = ({
  callbacks = {},
  companyId,
  showNotifications = true
}: {
  callbacks?: GlobalSyncCallbacks;
  companyId?: string;
  showNotifications?: boolean;
} = {}) => {
  const callbacksRef = useRef(callbacks);

  // Atualizar referências dos callbacks sem causar re-subscrição
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const handleGlobalEvent = useCallback((payload: any) => {
    console.log('🌍 [useGlobalSync] Evento global recebido:', payload);

    const { type, data, source, companyId: eventCompanyId } = payload;

    // 🔒 SEGURANÇA: Filtrar apenas eventos da empresa atual
    if (companyId && eventCompanyId !== companyId) {
      console.log('🚫 [useGlobalSync] Evento ignorado - empresa diferente:', {
        eventCompanyId,
        userCompanyId: companyId
      });
      return;
    }

    const currentCallbacks = callbacksRef.current;

    // Executar callback específico baseado no tipo de evento
    switch (type) {
      case 'lead-created':
        if (currentCallbacks.onLeadCreated) {
          currentCallbacks.onLeadCreated(data);
        }
        if (showNotifications) {
          toast.success(`Novo lead criado em ${source}: ${data.name}`);
        }
        break;

      case 'lead-updated':
        if (currentCallbacks.onLeadUpdated) {
          currentCallbacks.onLeadUpdated(data);
        }
        if (showNotifications) {
          toast.info(`Lead atualizado em ${source}: ${data.name}`);
        }
        break;

      case 'lead-deleted':
        if (currentCallbacks.onLeadDeleted) {
          currentCallbacks.onLeadDeleted(data);
        }
        if (showNotifications) {
          toast.info(`Lead removido em ${source}: ${data.name}`);
        }
        break;

      case 'task-created':
        if (currentCallbacks.onTaskCreated) {
          currentCallbacks.onTaskCreated(data);
        }
        if (showNotifications) {
          toast.success(`Nova tarefa criada em ${source}: ${data.title}`);
        }
        break;

      case 'task-updated':
        if (currentCallbacks.onTaskUpdated) {
          currentCallbacks.onTaskUpdated(data);
        }
        if (showNotifications) {
          toast.info(`Tarefa atualizada em ${source}: ${data.title}`);
        }
        break;

      case 'task-deleted':
        if (currentCallbacks.onTaskDeleted) {
          currentCallbacks.onTaskDeleted(data);
        }
        if (showNotifications) {
          toast.info(`Tarefa removida em ${source}: ${data.title}`);
        }
        break;

      case 'meeting-scheduled':
        if (currentCallbacks.onMeetingScheduled) {
          currentCallbacks.onMeetingScheduled(data);
        }
        if (showNotifications) {
          toast.success(`Reunião agendada em ${source}: ${data.title}`);
        }
        break;

      case 'meeting-updated':
        if (currentCallbacks.onMeetingUpdated) {
          currentCallbacks.onMeetingUpdated(data);
        }
        if (showNotifications) {
          toast.info(`Reunião atualizada em ${source}: ${data.title}`);
        }
        break;

      case 'meeting-completed':
        if (currentCallbacks.onMeetingCompleted) {
          currentCallbacks.onMeetingCompleted(data);
        }
        if (showNotifications) {
          toast.success(`Reunião concluída em ${source}: ${data.title}`);
        }
        break;

      case 'conversation-started':
        if (currentCallbacks.onConversationStarted) {
          currentCallbacks.onConversationStarted(data);
        }
        if (showNotifications) {
          toast.info(`Conversa iniciada em ${source}`);
        }
        break;

      case 'conversation-updated':
        if (currentCallbacks.onConversationUpdated) {
          currentCallbacks.onConversationUpdated(data);
        }
        break;

      case 'funnel-stage-changed':
        if (currentCallbacks.onFunnelStageChanged) {
          currentCallbacks.onFunnelStageChanged(data);
        }
        if (showNotifications) {
          toast.info(`Lead movido no funil: ${data.leadName} → ${data.newStage}`);
        }
        break;

      case 'appointment-reminder':
        if (currentCallbacks.onAppointmentReminder) {
          currentCallbacks.onAppointmentReminder(data);
        }
        if (showNotifications) {
          toast.warning(`Lembrete: ${data.title} às ${new Date(data.date).toLocaleTimeString('pt-BR')}`);
        }
        break;

      default:
        console.warn('[useGlobalSync] Evento desconhecido:', type);
    }
  }, [companyId, showNotifications]);

  const setupGlobalChannel = useCallback(async () => {
    if (!globalChannel) {
      console.log('🌍 [useGlobalSync] Criando canal global compartilhado...');

      globalChannel = supabase
        .channel('global_sync_channel')
        .on(
          'broadcast',
          { event: 'global_event' },
          handleGlobalEvent
        )
        .subscribe((status) => {
          console.log('🌍 [useGlobalSync] Status da conexão global:', status);

          if (status === 'SUBSCRIBED') {
            console.log(`✅ [useGlobalSync] Canal global ativo (${globalSubscriberCount} subscribers)`);
            globalReconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [useGlobalSync] Erro na conexão global');

            // Tentar reconectar automaticamente
            if (globalReconnectAttempts < MAX_GLOBAL_RECONNECT_ATTEMPTS) {
              globalReconnectAttempts++;
              console.log(`🔄 [useGlobalSync] Tentando reconectar (${globalReconnectAttempts}/${MAX_GLOBAL_RECONNECT_ATTEMPTS})...`);

              setTimeout(async () => {
                if (globalChannel) {
                  await supabase.removeChannel(globalChannel);
                  globalChannel = null;
                }
                setupGlobalChannel();
              }, GLOBAL_RECONNECT_DELAY * globalReconnectAttempts);
            } else {
              console.error('❌ [useGlobalSync] Máximo de tentativas de reconexão global atingido');
              if (showNotifications) {
                toast.error('Erro na sincronização global. Recarregue a página.');
              }
            }
          } else if (status === 'CLOSED') {
            console.log('🔌 [useGlobalSync] Canal global fechado');
          }
        });
    }
  }, [handleGlobalEvent, showNotifications]);

  useEffect(() => {
    globalSubscriberCount++;
    console.log(`🔄 [useGlobalSync] Registrando subscriber global (${globalSubscriberCount} total)`);

    setupGlobalChannel();

    // Cleanup ao desmontar
    return () => {
      globalSubscriberCount--;
      console.log(`🔌 [useGlobalSync] Removendo subscriber global (${globalSubscriberCount} restantes)`);

      // Só remover canal se não houver mais subscribers
      if (globalSubscriberCount === 0 && globalChannel) {
        console.log('🔌 [useGlobalSync] Último subscriber global, fechando canal...');
        supabase.removeChannel(globalChannel);
        globalChannel = null;
        globalReconnectAttempts = 0;
      }
    };
  }, [setupGlobalChannel]);

  // Função para disparar eventos globais
  const emitGlobalEvent = useCallback(async (event: Omit<GlobalEventPayload, 'timestamp'>) => {
    if (!globalChannel) {
      console.warn('⚠️ [useGlobalSync] Canal global não disponível para emitir evento');
      return false;
    }

    try {
      const fullEvent: GlobalEventPayload = {
        ...event,
        timestamp: new Date().toISOString()
      };

      console.log('📡 [useGlobalSync] Emitindo evento global:', fullEvent);

      await globalChannel.send({
        type: 'broadcast',
        event: 'global_event',
        payload: fullEvent
      });

      return true;
    } catch (error) {
      console.error('❌ [useGlobalSync] Erro ao emitir evento global:', error);
      return false;
    }
  }, []);

  return {
    emitGlobalEvent
  };
};

