import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Canal singleton compartilhado por todos os componentes
let sharedChannel: any = null;
let subscriberCount = 0;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;

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

/**
 * Hook global de sincronização de leads em tempo real
 * Usa Supabase Realtime com canal compartilhado (singleton) para otimizar recursos
 * e notificar os componentes quando houver alterações
 * 
 * OTIMIZAÇÕES:
 * - Canal compartilhado entre todos os componentes (evita múltiplas conexões)
 * - Reconexão automática em caso de perda de conexão
 * - Gerenciamento de subscribers para cleanup correto
 */
export const useLeadsSync = ({
  onInsert,
  onUpdate,
  onDelete,
  showNotifications = true,
  companyId // 🔒 ISOLAMENTO: company_id obrigatório para isolamento
}: UseLeadsSyncOptions & { companyId?: string } = {}) => {
  const handlersRef = useRef({ onInsert, onUpdate, onDelete, showNotifications });
  
  // Atualizar referências sem causar re-subscrição
  useEffect(() => {
    handlersRef.current = { onInsert, onUpdate, onDelete, showNotifications };
  }, [onInsert, onUpdate, onDelete, showNotifications]);
  
  const handleChange = useCallback((payload: any) => {
    console.log('📡 [useLeadsSync] Mudança detectada:', payload);

    const { eventType, new: newRecord, old: oldRecord } = payload;
    const handlers = handlersRef.current;

    // 🔒 SEGURANÇA: Filtrar apenas leads da empresa atual
    if (companyId) {
      const recordCompanyId = newRecord?.company_id || oldRecord?.company_id;
      if (recordCompanyId !== companyId) {
        console.log('🚫 [useLeadsSync] Lead ignorado - empresa diferente:', {
          recordCompanyId,
          userCompanyId: companyId
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
        break;
        
      case 'UPDATE':
        if (handlers.onUpdate) {
          handlers.onUpdate(newRecord, oldRecord);
        }
        if (handlers.showNotifications) {
          toast.info(`Lead atualizado: ${newRecord.name}`);
        }
        break;
        
      case 'DELETE':
        if (handlers.onDelete) {
          handlers.onDelete(oldRecord);
        }
        if (handlers.showNotifications) {
          toast.info(`Lead removido: ${oldRecord.name}`);
        }
        break;
        
      default:
        console.warn('[useLeadsSync] Evento desconhecido:', eventType);
    }
  }, []);

  const setupChannel = useCallback(async () => {
    if (!sharedChannel) {
      console.log('🔄 [useLeadsSync] Criando canal compartilhado...');
      
      sharedChannel = supabase
        .channel('leads_shared_channel')
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
          console.log('📡 [useLeadsSync] Status da conexão compartilhada:', status);
          
          if (status === 'SUBSCRIBED') {
            console.log(`✅ [useLeadsSync] Canal compartilhado ativo (${subscriberCount} subscribers)`);
            reconnectAttempts = 0; // Reset contador de reconexão
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [useLeadsSync] Erro na conexão realtime');
            
            // Tentar reconectar automaticamente
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              console.log(`🔄 [useLeadsSync] Tentando reconectar (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
              
              setTimeout(async () => {
                if (sharedChannel) {
                  await supabase.removeChannel(sharedChannel);
                  sharedChannel = null;
                }
                setupChannel();
              }, RECONNECT_DELAY * reconnectAttempts); // Aumentar delay a cada tentativa
            } else {
              console.error('❌ [useLeadsSync] Máximo de tentativas de reconexão atingido');
              if (handlersRef.current.showNotifications) {
                toast.error('Erro ao conectar sincronização. Por favor, recarregue a página.');
              }
            }
          } else if (status === 'CLOSED') {
            console.log('🔌 [useLeadsSync] Canal fechado');
          }
        });
    }
  }, [handleChange]);

  useEffect(() => {
    subscriberCount++;
    console.log(`🔄 [useLeadsSync] Registrando subscriber (${subscriberCount} total)`);
    
    setupChannel();

    // Cleanup ao desmontar
    return () => {
      subscriberCount--;
      console.log(`🔌 [useLeadsSync] Removendo subscriber (${subscriberCount} restantes)`);
      
      // Só remover canal se não houver mais subscribers
      if (subscriberCount === 0 && sharedChannel) {
        console.log('🔌 [useLeadsSync] Último subscriber, fechando canal compartilhado...');
        supabase.removeChannel(sharedChannel);
        sharedChannel = null;
        reconnectAttempts = 0;
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
    reloadLeads
  };
};
