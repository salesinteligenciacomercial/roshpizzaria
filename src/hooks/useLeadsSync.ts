import { useEffect, useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Canal singleton compartilhado por todos os componentes
let sharedChannel: any = null;
let subscriberCount = 0;
let reconnectAttempts = 0;
let reconnectTimeoutId: NodeJS.Timeout | null = null;
let isReconnecting = false;
const MAX_RECONNECT_ATTEMPTS = 10; // Aumentado para 10 tentativas
const RECONNECT_DELAY = 3000;
const DEBOUNCE_DELAY = 300; // Debounce de 300ms para atualizações

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  telefone?: string | null;
  company: string | null;
  source: string | null;
  status: string;
  stage: string;
  value: number;
  created_at: string;
  updated_at: string;
  tags?: string[];
  cpf?: string | null;
  notes?: string | null;
  funil_id?: string | null;
  etapa_id?: string | null;
  responsavel_id?: string | null;
  company_id?: string | null;
  owner_id?: string | null;
  servico?: string | null;
  segmentacao?: string | null;
}

interface LeadsChangePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Lead;
  old: Lead;
}

interface UseLeadsSyncOptions {
  onInsert?: (lead: Lead) => void;
  onUpdate?: (lead: Lead, oldLead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  showNotifications?: boolean;
}

// Status da conexão realtime
export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

// Status global da conexão (compartilhado entre componentes)
let globalConnectionStatus: RealtimeStatus = 'disconnected';
const statusListeners = new Set<(status: RealtimeStatus) => void>();

// Função auxiliar para validar dados do lead
const validateLead = (lead: any): lead is Lead => {
  if (!lead || typeof lead !== 'object') {
    console.warn('❌ [useLeadsSync] Lead inválido: não é um objeto', lead);
    return false;
  }
  
  if (!lead.id || typeof lead.id !== 'string') {
    console.warn('❌ [useLeadsSync] Lead inválido: id ausente ou inválido', lead);
    return false;
  }
  
  if (!lead.name || typeof lead.name !== 'string') {
    console.warn('❌ [useLeadsSync] Lead inválido: name ausente ou inválido', lead);
    return false;
  }
  
  // Validar campos obrigatórios
  const requiredFields = ['status', 'stage', 'created_at'];
  for (const field of requiredFields) {
    if (!lead[field]) {
      console.warn(`❌ [useLeadsSync] Lead inválido: ${field} ausente`, lead);
      return false;
    }
  }
  
  return true;
};

// Função para atualizar status global e notificar listeners
const setGlobalConnectionStatus = (status: RealtimeStatus) => {
  if (globalConnectionStatus !== status) {
    globalConnectionStatus = status;
    statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('❌ [useLeadsSync] Erro ao notificar listener:', error);
      }
    });
  }
};

/**
 * Hook global de sincronização de leads em tempo real
 * Usa Supabase Realtime com canal compartilhado (singleton) para otimizar recursos
 * e notificar os componentes quando houver alterações
 * 
 * OTIMIZAÇÕES:
 * - Canal compartilhado entre todos os componentes (evita múltiplas conexões)
 * - Reconexão automática robusta em caso de perda de conexão
 * - Debounce nas atualizações para evitar spam
 * - Validação de dados recebidos
 * - Logs detalhados para debug
 * - Indicador visual de status de conexão
 * - Gerenciamento de subscribers para cleanup correto
 */
export const useLeadsSync = ({
  onInsert,
  onUpdate,
  onDelete,
  showNotifications = true,
  companyId
}: UseLeadsSyncOptions & { companyId?: string } = {}) => {
  const handlersRef = useRef({ onInsert, onUpdate, onDelete, showNotifications, companyId });
  const [connectionStatus, setConnectionStatus] = useState<RealtimeStatus>(globalConnectionStatus);
  const debounceTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  
  // Atualizar referências sem causar re-subscrição
  useEffect(() => {
    handlersRef.current = { onInsert, onUpdate, onDelete, showNotifications, companyId };
  }, [onInsert, onUpdate, onDelete, showNotifications, companyId]);

  // Listener para status global de conexão
  useEffect(() => {
    const statusListener = (status: RealtimeStatus) => {
      setConnectionStatus(status);
    };
    statusListeners.add(statusListener);
    setConnectionStatus(globalConnectionStatus); // Atualizar com status atual

    return () => {
      statusListeners.delete(statusListener);
    };
  }, []);
  
  // Função com debounce para processar atualizações
  const processUpdate = useCallback((payload: any) => {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const handlers = handlersRef.current;

      // ✅ VALIDAÇÃO: Validar dados recebidos
      if (eventType === 'INSERT' || eventType === 'UPDATE') {
        if (!validateLead(newRecord)) {
          console.error('❌ [useLeadsSync] Lead inválido ignorado:', newRecord);
          return;
        }
      }
      
      if (eventType === 'DELETE' || eventType === 'UPDATE') {
        if (!validateLead(oldRecord)) {
          console.error('❌ [useLeadsSync] Lead antigo inválido ignorado:', oldRecord);
          return;
        }
      }

      // 🔒 SEGURANÇA: Filtrar apenas leads da empresa atual
      const currentCompanyId = handlers.companyId;
      if (currentCompanyId) {
        const recordCompanyId = newRecord?.company_id || oldRecord?.company_id;
        if (recordCompanyId !== currentCompanyId) {
          console.log('🚫 [useLeadsSync] Lead ignorado - empresa diferente:', {
            recordCompanyId,
            userCompanyId: currentCompanyId,
            leadId: newRecord?.id || oldRecord?.id
          });
          return; // Ignorar leads de outras empresas
        }
      }
      
      switch (eventType) {
        case 'INSERT':
          if (handlers.onInsert) {
            handlers.onInsert(newRecord);
          }
          if (handlers.showNotifications) {
            toast.success(`Novo lead adicionado: ${newRecord.name}`);
          }
          console.log('✅ [useLeadsSync] INSERT processado:', newRecord.id);
          break;
          
        case 'UPDATE':
          if (handlers.onUpdate) {
            handlers.onUpdate(newRecord, oldRecord);
          }
          if (handlers.showNotifications) {
            toast.info(`Lead atualizado: ${newRecord.name}`);
          }
          console.log('✅ [useLeadsSync] UPDATE processado:', newRecord.id);
          break;
          
        case 'DELETE':
          if (handlers.onDelete) {
            handlers.onDelete(oldRecord);
          }
          if (handlers.showNotifications) {
            toast.info(`Lead removido: ${oldRecord.name}`);
          }
          console.log('✅ [useLeadsSync] DELETE processado:', oldRecord.id);
          break;
          
      default:
        console.warn('⚠️ [useLeadsSync] Evento desconhecido:', eventType);
    }
  } catch (error) {
    console.error('❌ [useLeadsSync] Erro ao processar mudança:', error, payload);
  }
}, []);

  // Handler com debounce para evitar spam de atualizações
  const handleChange = useCallback((payload: any) => {
    const leadId = payload.new?.id || payload.old?.id || 'unknown';
    console.log('📡 [useLeadsSync] Mudança detectada:', {
      eventType: payload.eventType,
      leadId,
      timestamp: new Date().toISOString()
    });

    // Limpar timeout anterior para este lead (debounce)
    if (debounceTimeoutRef.current[leadId]) {
      clearTimeout(debounceTimeoutRef.current[leadId]);
    }

    // Criar novo timeout com debounce
    debounceTimeoutRef.current[leadId] = setTimeout(() => {
      processUpdate(payload);
      delete debounceTimeoutRef.current[leadId];
    }, DEBOUNCE_DELAY);
  }, [processUpdate]);

  const setupChannel = useCallback(async () => {
    if (sharedChannel && sharedChannel.state === 'joined') {
      console.log('✅ [useLeadsSync] Canal já existe e está conectado');
      return;
    }

    try {
      // Limpar canal anterior se existir
      if (sharedChannel) {
        await supabase.removeChannel(sharedChannel);
        sharedChannel = null;
      }

      console.log('🔄 [useLeadsSync] Criando canal compartilhado...');
      setGlobalConnectionStatus('connecting');
      
      sharedChannel = supabase
        .channel('leads_shared_channel', {
          config: {
            broadcast: { self: true },
            presence: { key: '' }
          }
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'leads'
          },
          handleChange
        )
        .subscribe((status) => {
          console.log('📡 [useLeadsSync] Status da conexão:', {
            status,
            timestamp: new Date().toISOString(),
            subscribers: subscriberCount
          });
          
          if (status === 'SUBSCRIBED') {
            console.log(`✅ [useLeadsSync] Canal compartilhado ativo (${subscriberCount} subscribers)`);
            reconnectAttempts = 0;
            isReconnecting = false;
            setGlobalConnectionStatus('connected');
            
            // Limpar timeout de reconexão se existir
            if (reconnectTimeoutId) {
              clearTimeout(reconnectTimeoutId);
              reconnectTimeoutId = null;
            }
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [useLeadsSync] Erro na conexão realtime:', {
              timestamp: new Date().toISOString(),
              attempts: reconnectAttempts,
              maxAttempts: MAX_RECONNECT_ATTEMPTS
            });
            setGlobalConnectionStatus('error');
            // Usar função inline para evitar dependência circular
            if (!isReconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              isReconnecting = true;
              reconnectAttempts++;
              setGlobalConnectionStatus('reconnecting');
              const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 30000);
              
              if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
              reconnectTimeoutId = setTimeout(async () => {
                try {
                  if (sharedChannel) {
                    await supabase.removeChannel(sharedChannel);
                    sharedChannel = null;
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  await setupChannel();
                } catch (err) {
                  console.error('❌ [useLeadsSync] Erro durante reconexão:', err);
                  isReconnecting = false;
                  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts = 0; // Reset para tentar novamente
                  } else {
                    setGlobalConnectionStatus('error');
                  }
                }
              }, delay);
            }
          } else if (status === 'CLOSED') {
            console.log('🔌 [useLeadsSync] Canal fechado:', {
              timestamp: new Date().toISOString()
            });
            setGlobalConnectionStatus('disconnected');
            
            // Tentar reconectar automaticamente se houver subscribers
            if (subscriberCount > 0 && !isReconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              isReconnecting = true;
              reconnectAttempts++;
              setGlobalConnectionStatus('reconnecting');
              const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 30000);
              
              if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
              reconnectTimeoutId = setTimeout(async () => {
                try {
                  if (sharedChannel) {
                    await supabase.removeChannel(sharedChannel);
                    sharedChannel = null;
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  await setupChannel();
                } catch (err) {
                  console.error('❌ [useLeadsSync] Erro durante reconexão:', err);
                  isReconnecting = false;
                  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts = 0;
                  } else {
                    setGlobalConnectionStatus('error');
                  }
                }
              }, delay);
            }
          } else if (status === 'TIMED_OUT') {
            console.warn('⏱️ [useLeadsSync] Timeout na conexão:', {
              timestamp: new Date().toISOString()
            });
            setGlobalConnectionStatus('error');
            // Mesma lógica de reconexão
            if (!isReconnecting && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              isReconnecting = true;
              reconnectAttempts++;
              setGlobalConnectionStatus('reconnecting');
              const delay = Math.min(RECONNECT_DELAY * reconnectAttempts, 30000);
              
              if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
              reconnectTimeoutId = setTimeout(async () => {
                try {
                  if (sharedChannel) {
                    await supabase.removeChannel(sharedChannel);
                    sharedChannel = null;
                  }
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  await setupChannel();
                } catch (err) {
                  console.error('❌ [useLeadsSync] Erro durante reconexão:', err);
                  isReconnecting = false;
                  if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts = 0;
                  } else {
                    setGlobalConnectionStatus('error');
                  }
                }
              }, delay);
            }
          }
        });
    } catch (error) {
      console.error('❌ [useLeadsSync] Erro ao criar canal:', error);
      setGlobalConnectionStatus('error');
      isReconnecting = false;
    }
  }, [handleChange]);

  useEffect(() => {
    subscriberCount++;
    console.log(`🔄 [useLeadsSync] Registrando subscriber (${subscriberCount} total)`, {
      timestamp: new Date().toISOString(),
      companyId: companyId || 'não definido'
    });
    
    setupChannel();

    // Cleanup ao desmontar
    return () => {
      subscriberCount--;
      console.log(`🔌 [useLeadsSync] Removendo subscriber (${subscriberCount} restantes)`);
      
      // Limpar timeouts de debounce
      Object.values(debounceTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      debounceTimeoutRef.current = {};
      
      // Limpar timeout de reconexão
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      
      // Só remover canal se não houver mais subscribers
      if (subscriberCount === 0 && sharedChannel) {
        console.log('🔌 [useLeadsSync] Último subscriber, fechando canal compartilhado...');
        setGlobalConnectionStatus('disconnected');
        supabase.removeChannel(sharedChannel);
        sharedChannel = null;
        reconnectAttempts = 0;
        isReconnecting = false;
      }
    };
  }, [setupChannel]);

  // Retornar função para forçar recarregamento manual se necessário
  const reloadLeads = useCallback(async () => {
    try {
      console.log('🔄 [useLeadsSync] Recarregando leads manualmente...');
      
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log('✅ [useLeadsSync] Leads recarregados:', data?.length);
      return data;
    } catch (error) {
      console.error('❌ [useLeadsSync] Erro ao recarregar leads:', error);
      if (showNotifications) {
        toast.error('Erro ao recarregar leads');
      }
      return null;
    }
  }, [showNotifications]);

  return {
    reloadLeads,
    connectionStatus // ✅ Retornar status para indicador visual
  };
};
