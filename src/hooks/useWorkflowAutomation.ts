/**
 * Hook simplificado de automação de workflows
 * 
 * NOTA: As tabelas workflow_triggers, workflow_executions e meetings não existem no banco.
 * Este hook foi simplificado para apenas reagir a eventos globais sem persistir no banco.
 */

import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGlobalSync } from "./useGlobalSync";
import { toast } from "sonner";

interface UseWorkflowAutomationOptions {
  companyId?: string;
  showNotifications?: boolean;
}

export const useWorkflowAutomation = ({
  companyId,
  showNotifications = true
}: UseWorkflowAutomationOptions = {}) => {
  
  // Sistema de eventos globais para reagir a mudanças
  const { emitGlobalEvent } = useGlobalSync({
    callbacks: {
      onLeadCreated: async (data) => {
        if (showNotifications) {
          console.log('[WORKFLOW] Novo lead criado:', data);
        }
      },
      onLeadUpdated: async (data) => {
        if (showNotifications) {
          console.log('[WORKFLOW] Lead atualizado:', data);
        }
      },
      onTaskCreated: async (data) => {
        if (showNotifications) {
          console.log('[WORKFLOW] Nova tarefa criada:', data);
        }
      },
      onMeetingScheduled: async (data) => {
        if (showNotifications) {
          console.log('[WORKFLOW] Reunião agendada:', data);
        }
      }
    },
    companyId,
    showNotifications: false // Não mostrar notificações duplicadas
  });

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      console.log('[WORKFLOW] Limpando hooks de workflow');
    };
  }, []);

  return {
    emitGlobalEvent
  };
};
