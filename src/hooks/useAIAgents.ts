import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type AgentType = "atendimento" | "vendedora" | "suporte";

type AgentConfig = {
  agent_type: AgentType;
  enabled: boolean;
};

type TrainingPreferences = {
  agent_toggles?: Record<AgentType, boolean>;
  [key: string]: unknown;
};

type IAConfiguration = {
  company_id: string;
  training_preferences: TrainingPreferences | null;
};

const DEFAULT_TOGGLES: Record<AgentType, boolean> = {
  atendimento: true,
  vendedora: true,
  suporte: false,
};

export function useAIAgents() {
  const getAgentConfigs = useCallback(async (companyId: string): Promise<AgentConfig[]> => {
    const { data, error } = await supabase
      .from("ia_configurations")
      .select("company_id, training_preferences")
      .eq("company_id", companyId)
      .maybeSingle<IAConfiguration>();

    if (error) {
      console.error("Erro ao carregar ia_configurations:", error);
      return [
        { agent_type: "atendimento", enabled: DEFAULT_TOGGLES.atendimento },
        { agent_type: "vendedora", enabled: DEFAULT_TOGGLES.vendedora },
        { agent_type: "suporte", enabled: DEFAULT_TOGGLES.suporte },
      ];
    }

    const toggles = (data?.training_preferences?.agent_toggles as Record<AgentType, boolean> | undefined) || DEFAULT_TOGGLES;
    return [
      { agent_type: "atendimento", enabled: !!toggles.atendimento },
      { agent_type: "vendedora", enabled: !!toggles.vendedora },
      { agent_type: "suporte", enabled: !!toggles.suporte },
    ];
  }, []);

  const updateAgentConfig = useCallback(async (
    companyId: string,
    agentType: AgentType,
    update: { enabled: boolean }
  ) => {
    // Buscar prefs atuais
    const { data, error } = await supabase
      .from("ia_configurations")
      .select("company_id, training_preferences")
      .eq("company_id", companyId)
      .maybeSingle<IAConfiguration>();

    if (error) {
      console.error("Erro carregando ia_configurations para update:", error);
    }

    const currentPrefs: TrainingPreferences = data?.training_preferences || {};
    const currentToggles: Record<AgentType, boolean> = {
      ...DEFAULT_TOGGLES,
      ...(currentPrefs.agent_toggles || {}),
    } as Record<AgentType, boolean>;

    currentToggles[agentType] = !!update.enabled;

    const newPrefs: TrainingPreferences = {
      ...currentPrefs,
      agent_toggles: currentToggles,
    };

    // Upsert por company_id
    const { error: upsertError } = await supabase
      .from("ia_configurations")
      .upsert(
        {
          company_id: companyId,
          training_preferences: newPrefs,
        },
        { onConflict: "company_id" }
      );

    if (upsertError) {
      console.error("Erro ao atualizar ia_configurations:", upsertError);
    }
  }, []);

  return { getAgentConfigs, updateAgentConfig };
}


