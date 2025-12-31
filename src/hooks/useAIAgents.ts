import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentConfig {
  id?: string;
  company_id: string;
  agent_type: 'atendimento' | 'vendedora' | 'suporte' | 'agendamento';
  enabled: boolean;
  auto_response: boolean;
  custom_prompt?: string;
  transfer_on_unknown: boolean;
  working_hours?: {
    start: string;
    end: string;
    days: string[];
  };
  max_responses_per_conversation?: number;
  // Configurações de tempo e pausa
  response_delay?: number;
  pause_on_human_response?: boolean;
  // Configurações de follow-up
  follow_up_enabled?: boolean;
  follow_up_time?: number;
  follow_up_time_unit?: 'minutes' | 'hours';
  follow_up_message?: string;
  max_follow_ups?: number;
  // Configurações específicas de agendamento
  use_lead_phone_auto?: boolean;
  // Configurações de bloqueio
  block_by_tags?: boolean;
  blocked_tags?: string[];
  read_conversation_history?: boolean;
  history_messages_count?: number;
  block_by_funnel?: boolean;
  blocked_funnels?: string[];
  blocked_stages?: string[];
  // Base de Conhecimento
  knowledge_base?: {
    empresa?: {
      nome?: string;
      descricao?: string;
      segmento?: string;
      horario?: string;
      endereco?: string;
      contato?: string;
    };
    produtos?: Array<{
      id: string;
      nome: string;
      descricao: string;
      preco?: string;
    }>;
    faqs?: Array<{
      id: string;
      pergunta: string;
      resposta: string;
    }>;
    informacoes_extras?: string;
    arquivos?: Array<{
      id: string;
      nome: string;
      tipo: 'texto' | 'pdf' | 'imagem' | 'audio' | 'video';
      url: string;
      conteudoExtraido?: string;
    }>;
    casos_antes_depois?: Array<{
      id: string;
      titulo: string;
      categoria: string;
      legenda: string;
      imagemAntes?: string;
      imagemDepois?: string;
      videoAntes?: string;
      videoDepois?: string;
    }>;
    // Agendas selecionadas para consulta (IA de Agendamento)
    agendas_selecionadas?: string[];
  };
  // Treinamentos
  training_data?: Array<{
    id: string;
    perguntaExemplo: string;
    respostaIdeal: string;
    categoria: string;
  }>;
}

export interface IAMetrics {
  agent_type: string;
  total_interactions: number;
  successful_interactions: number;
  corrections_needed: number;
  conversions_assisted: number;
  avg_response_accuracy: number;
  learning_progress: number;
}

export function useAIAgents() {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [metrics, setMetrics] = useState<IAMetrics[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Buscar configurações dos agentes
  const getAgentConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      // Buscar configuração geral
      const { data: iaConfig, error: configError } = await supabase
        .from('ia_configurations')
        .select('*')
        .eq('company_id', userRole.company_id)
        .maybeSingle();

      if (configError) throw configError;

      // Se não existe configuração, criar uma padrão COM TODOS AGENTES DESATIVADOS
      if (!iaConfig) {
        const { data: newConfig, error: insertError } = await supabase
          .from('ia_configurations')
          .insert({
            company_id: userRole.company_id,
            learning_mode: false,
            auto_optimization: false,
            collaborative_mode: true,
            custom_prompts: {
              atendimento: { enabled: false, auto_response: false },
              vendedora: { enabled: false, auto_response: false },
              suporte: { enabled: false, auto_response: false },
              agendamento: { enabled: false, auto_response: false }
            }
          })
          .select()
          .single();

        if (insertError) throw insertError;
        
        // Converter para formato de configs
        const agentConfigs = parseCustomPrompts(newConfig?.custom_prompts || {}, userRole.company_id);
        setConfigs(agentConfigs);
        return agentConfigs;
      }

      // Converter custom_prompts para configs
      const agentConfigs = parseCustomPrompts(iaConfig.custom_prompts || {}, userRole.company_id);
      setConfigs(agentConfigs);
      return agentConfigs;
    } catch (err: any) {
      console.error("Erro ao buscar configs:", err);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Parser de custom_prompts para AgentConfig[]
  const parseCustomPrompts = (prompts: any, companyId: string): AgentConfig[] => {
    const agents = ['atendimento', 'vendedora', 'suporte', 'agendamento'];
    return agents.map(agent => ({
      company_id: companyId,
      agent_type: agent as any,
      enabled: prompts[agent]?.enabled ?? false,
      auto_response: prompts[agent]?.auto_response ?? false,
      custom_prompt: prompts[agent]?.custom_prompt,
      transfer_on_unknown: prompts[agent]?.transfer_on_unknown ?? true,
      working_hours: prompts[agent]?.working_hours,
      max_responses_per_conversation: prompts[agent]?.max_responses_per_conversation ?? 10
    }));
  };

  // Atualizar configuração de um agente
  const updateAgentConfig = useCallback(async (agentType: string, updates: Partial<AgentConfig>) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      // Buscar configuração atual
      const { data: currentConfig } = await supabase
        .from('ia_configurations')
        .select('custom_prompts')
        .eq('company_id', userRole.company_id)
        .single();

      const customPrompts = currentConfig?.custom_prompts || {};
      
      // Atualizar apenas o agente específico
      customPrompts[agentType] = {
        ...customPrompts[agentType],
        ...updates
      };

      // Salvar no banco
      const { error: updateError } = await supabase
        .from('ia_configurations')
        .update({ 
          custom_prompts: customPrompts,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', userRole.company_id);

      if (updateError) throw updateError;

      // Atualizar estado local
      setConfigs(prev => prev.map(c => 
        c.agent_type === agentType ? { ...c, ...updates } : c
      ));

      toast.success(`Configuração do agente ${agentType} atualizada!`);
      return true;
    } catch (err: any) {
      console.error("Erro ao atualizar config:", err);
      setError(err.message);
      toast.error("Erro ao salvar configuração");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Toggle ativar/desativar agente
  const toggleAgent = useCallback(async (agentType: string, enabled: boolean) => {
    return await updateAgentConfig(agentType, { enabled });
  }, [updateAgentConfig]);

  // Toggle resposta automática
  const toggleAutoResponse = useCallback(async (agentType: string, autoResponse: boolean) => {
    return await updateAgentConfig(agentType, { auto_response: autoResponse });
  }, [updateAgentConfig]);

  // Atualizar prompt customizado
  const updateCustomPrompt = useCallback(async (agentType: string, prompt: string) => {
    return await updateAgentConfig(agentType, { custom_prompt: prompt });
  }, [updateAgentConfig]);

  // Buscar métricas dos agentes
  const getAgentMetrics = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!userRole?.company_id) return [];

      const { data, error } = await supabase
        .from('ia_metrics')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('metric_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      setMetrics(data || []);
      return data || [];
    } catch (err) {
      console.error("Erro ao buscar métricas:", err);
      return [];
    }
  }, []);

  // Interface para arquivos de teste
  interface TestFile {
    type: 'image' | 'pdf' | 'audio' | 'video';
    base64: string;
    name: string;
    mimeType: string;
  }

  // Testar um agente com uma mensagem e arquivos opcionais
  const testAgent = useCallback(async (agentType: string, message: string, files?: TestFile[]) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) throw new Error("Company não encontrada");

      // Obter sessão para token de autenticação
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão não encontrada");

      // Chamar função usando fetch direto para maior controle
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const functionUrl = `${supabaseUrl}/functions/v1/ia-${agentType}`;
      
      console.log(`🧪 Testando agente ia-${agentType}...`, { functionUrl, filesCount: files?.length || 0 });

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
        },
        body: JSON.stringify({
          conversationId: 'test-' + Date.now(),
          message,
          companyId: userRole.company_id,
          leadData: {
            id: 'test-lead',
            name: 'Lead Teste',
            phone: '5511999999999',
            company_id: userRole.company_id
          },
          files: files || []
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta:', response.status, errorText);
        throw new Error(`Erro ${response.status}: ${errorText || 'Função não disponível'}`);
      }

      const data = await response.json();
      console.log('✅ Resposta do agente:', data);
      return data;
    } catch (err: any) {
      console.error("Erro ao testar agente:", err);
      toast.error("Erro ao testar agente: " + (err.message || 'Erro desconhecido'));
      return null;
    }
  }, []);

  // Ativar/desativar modo de aprendizado global
  const toggleLearningMode = useCallback(async (enabled: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      
      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      const { error } = await supabase
        .from('ia_configurations')
        .update({ 
          learning_mode: enabled,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', userRole.company_id);

      if (error) throw error;
      
      toast.success(enabled ? "Modo de aprendizado ativado" : "Modo de aprendizado desativado");
      return true;
    } catch (err: any) {
      console.error("Erro ao alterar learning mode:", err);
      toast.error("Erro ao alterar configuração");
      return false;
    }
  }, []);

  return {
    loading,
    error,
    configs,
    metrics,
    
    // Métodos
    getAgentConfigs,
    updateAgentConfig,
    toggleAgent,
    toggleAutoResponse,
    updateCustomPrompt,
    getAgentMetrics,
    testAgent,
    toggleLearningMode
  };
}
