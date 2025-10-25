import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
 * Usa Supabase Realtime para observar mudanças na tabela leads
 * e notificar os componentes quando houver alterações
 */
export const useLeadsSync = ({
  onInsert,
  onUpdate,
  onDelete,
  showNotifications = true
}: UseLeadsSyncOptions = {}) => {
  
  const handleChange = useCallback((payload: any) => {
    console.log('📡 [useLeadsSync] Mudança detectada:', payload);
    
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    switch (eventType) {
      case 'INSERT':
        if (onInsert) {
          onInsert(newRecord);
        }
        if (showNotifications) {
          toast.success(`Novo lead adicionado: ${newRecord.name}`);
        }
        break;
        
      case 'UPDATE':
        if (onUpdate) {
          onUpdate(newRecord, oldRecord);
        }
        if (showNotifications) {
          toast.info(`Lead atualizado: ${newRecord.name}`);
        }
        break;
        
      case 'DELETE':
        if (onDelete) {
          onDelete(oldRecord);
        }
        if (showNotifications) {
          toast.info(`Lead removido: ${oldRecord.name}`);
        }
        break;
        
      default:
        console.warn('[useLeadsSync] Evento desconhecido:', eventType);
    }
  }, [onInsert, onUpdate, onDelete, showNotifications]);

  useEffect(() => {
    console.log('🔄 [useLeadsSync] Iniciando sincronização de leads...');
    
    // Criar canal para mudanças na tabela leads
    const channel = supabase
      .channel('leads_changes')
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
        console.log('📡 [useLeadsSync] Status da conexão:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ [useLeadsSync] Sincronização ativa');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [useLeadsSync] Erro na conexão realtime');
          if (showNotifications) {
            toast.error('Erro ao conectar sincronização de leads');
          }
        }
      });

    // Cleanup ao desmontar
    return () => {
      console.log('🔌 [useLeadsSync] Desconectando sincronização...');
      supabase.removeChannel(channel);
    };
  }, [handleChange, showNotifications]);

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
