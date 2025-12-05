import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// ORQUESTRADOR CENTRAL DE IAs
// Decide qual IA usar: atendimento ou agendamento
// Vendas e suporte são tratados pelo atendimento
// ========================

interface ConversationContext {
  conversationId: string;
  message: string;
  leadData: any;
  companyId: string;
  previousMessages?: any[];
  agentConfigs?: any;
}

interface AIResponse {
  response: string;
  action?: string;
  actionResult?: any;
  agentUsed: string;
  shouldTransfer?: boolean;
  nextAgent?: string;
}

// Detectar intenção da mensagem - Simplificado para 2 agentes
function detectIntent(message: string): {
  intent: string;
  confidence: number;
  suggestedAgent: 'atendimento' | 'agendamento';
} {
  const msgLower = message.toLowerCase();
  
  // Intenções de AGENDAMENTO (alta prioridade)
  const agendamentoKeywords = [
    'agendar', 'marcar', 'horário', 'horario', 'consulta', 
    'disponível', 'disponivel', 'vaga', 'dia', 'data', 'quando',
    'desmarcar', 'cancelar', 'remarcar', 'alterar', 'mudar',
    'agenda', 'compromisso', 'reunião', 'reuniao', 'visita'
  ];
  
  const agendamentoScore = agendamentoKeywords.filter(k => msgLower.includes(k)).length;
  
  // Frases específicas de agendamento
  if (agendamentoScore >= 2 || 
      msgLower.includes('quero agendar') || 
      msgLower.includes('marcar horário') ||
      msgLower.includes('qual horário') ||
      msgLower.includes('tem vaga') ||
      msgLower.includes('posso marcar') ||
      msgLower.includes('quero marcar') ||
      msgLower.includes('remarcar para') ||
      msgLower.includes('cancelar meu')) {
    return { intent: 'agendamento', confidence: 0.9, suggestedAgent: 'agendamento' };
  }
  
  // Tudo mais vai para atendimento (vendas, suporte, qualificação, etc)
  // O agente de atendimento é polivalente e trata todos os casos
  return { intent: 'atendimento', confidence: 0.85, suggestedAgent: 'atendimento' };
}

// Chamar uma IA específica com timeout
async function callAgent(
  agent: string, 
  context: ConversationContext,
  supabase: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<AIResponse> {
  console.log(`🤖 [ORCHESTRATOR] Chamando agente: ${agent}`);
  
  const functionName = `ia-${agent}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        conversationId: context.conversationId,
        message: context.message,
        leadData: context.leadData,
        companyId: context.companyId
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro ao chamar ${functionName}:`, response.status, errorText);
      throw new Error(`Erro ao chamar agente ${agent}`);
    }
    
    const result = await response.json();
    
    return {
      response: result.response,
      action: result.action,
      actionResult: result.actionResult,
      agentUsed: agent,
      shouldTransfer: result.action === 'TRANSFERIR_HUMANO',
      nextAgent: result.nextAgent
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      console.error(`⏱️ Timeout ao chamar agente ${agent}`);
    } else {
      console.error(`❌ Erro no agente ${agent}:`, error);
    }
    
    return {
      response: 'Desculpe, estou com dificuldades técnicas. Um atendente humano irá te ajudar em breve.',
      agentUsed: agent,
      shouldTransfer: true
    };
  }
}

// Executar ação de CRM
async function executeCRMAction(
  action: string,
  params: any,
  supabaseUrl: string,
  supabaseKey: string
): Promise<any> {
  console.log(`🔧 [ORCHESTRATOR] Executando ação CRM: ${action}`);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ia-tools`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: action,
        params
      })
    });
    
    return await response.json();
  } catch (error: any) {
    console.error(`❌ Erro ao executar ação ${action}:`, error);
    return { success: false, error: error.message };
  }
}

// ========================
// FUNÇÃO PRINCIPAL
// ========================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const body = await req.json();
    const { 
      conversationId, 
      message, 
      numero,
      leadData, 
      companyId,
      forceAgent, // Forçar uso de um agente específico (atendimento ou agendamento)
      autoExecute = true // Executar ações automaticamente
    } = body;
    
    console.log('🎯 [ORCHESTRATOR] Processando mensagem:', { 
      conversationId, 
      message: message?.substring(0, 50),
      companyId,
      forceAgent 
    });
    
    // Se não tiver leadData, buscar pelo número
    let lead = leadData;
    if (!lead && numero && companyId) {
      const numeroLimpo = numero.replace(/[^0-9]/g, '');
      const { data: leadFound } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', companyId)
        .or(`telefone.eq.${numeroLimpo},phone.eq.${numeroLimpo}`)
        .limit(1)
        .maybeSingle();
      
      lead = leadFound;
    }
    
    // Detectar intenção
    const { intent, confidence, suggestedAgent } = detectIntent(message);
    
    // Validar agente forçado (só aceita atendimento ou agendamento)
    let agentToUse = suggestedAgent;
    if (forceAgent && (forceAgent === 'atendimento' || forceAgent === 'agendamento')) {
      agentToUse = forceAgent;
    }
    
    console.log('🎯 [ORCHESTRATOR] Intenção detectada:', { intent, confidence, agentToUse });
    
    // Verificar se IA está ativada para a empresa
    const { data: iaConfig } = await supabase
      .from('ia_configurations')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    
    // Se IA não está configurada ou desabilitada globalmente, retornar
    if (!iaConfig || !iaConfig.learning_mode) {
      console.log('⚠️ [ORCHESTRATOR] IA não ativada para empresa:', companyId);
      return new Response(
        JSON.stringify({ 
          active: false, 
          message: 'IA não ativada para esta empresa' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verificar se o agente específico está habilitado
    const customPrompts = iaConfig.custom_prompts || {};
    const agentConfig = customPrompts[agentToUse];
    
    if (!agentConfig || agentConfig.enabled !== true) {
      console.log(`⚠️ [ORCHESTRATOR] Agente ${agentToUse} desabilitado para empresa:`, companyId);
      
      // Tentar fallback para o outro agente
      const fallbackAgent = agentToUse === 'atendimento' ? 'agendamento' : 'atendimento';
      const fallbackConfig = customPrompts[fallbackAgent];
      
      if (fallbackConfig && fallbackConfig.enabled === true) {
        console.log(`🔄 [ORCHESTRATOR] Usando fallback: ${fallbackAgent}`);
        agentToUse = fallbackAgent as 'atendimento' | 'agendamento';
      } else {
        return new Response(
          JSON.stringify({ 
            active: false, 
            message: `Nenhum agente de IA está ativado` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`✅ [ORCHESTRATOR] Agente ${agentToUse} ativado - processando...`);
    
    // Contexto da conversa
    const context: ConversationContext = {
      conversationId,
      message,
      leadData: lead,
      companyId
    };
    
    // Chamar agente apropriado
    const aiResult = await callAgent(agentToUse, context, supabase, supabaseUrl, supabaseKey);
    
    // Processar ações detectadas automaticamente
    let actionsExecuted: any[] = [];
    
    if (autoExecute && aiResult.action) {
      const action = aiResult.action;
      
      // Ações de qualificação
      if (action === 'QUALIFICAR' && lead?.id) {
        const qualResult = await executeCRMAction('qualificar_lead', {
          lead_id: lead.id,
          qualificacao: {
            fonte: 'ia_atendimento',
            data: new Date().toISOString(),
            mensagem_original: message
          }
        }, supabaseUrl, supabaseKey);
        actionsExecuted.push({ action: 'qualificar_lead', result: qualResult });
      }
      
      // Ações de agendamento
      if (action === 'AGENDAR' && aiResult.actionResult) {
        actionsExecuted.push({ action: 'criar_compromisso', result: aiResult.actionResult });
      }
      
      // Criar tarefa de follow-up
      if (action === 'CRIAR_TAREFA' && lead?.id) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('company_id', companyId)
          .eq('role', 'company_admin')
          .limit(1)
          .single();
        
        const tarefaResult = await executeCRMAction('criar_tarefa', {
          titulo: `Follow-up: ${lead.name || 'Lead'}`,
          lead_id: lead.id,
          descricao: `Tarefa criada automaticamente pela IA. Última mensagem: "${message.substring(0, 100)}"`,
          prioridade: 'alta',
          company_id: companyId,
          owner_id: userRole?.user_id || lead.owner_id
        }, supabaseUrl, supabaseKey);
        actionsExecuted.push({ action: 'criar_tarefa', result: tarefaResult });
      }
    }
    
    const execTime = Date.now() - startTime;
    console.log(`✅ [ORCHESTRATOR] Processado em ${execTime}ms:`, {
      agentUsed: aiResult.agentUsed,
      action: aiResult.action,
      actionsExecuted: actionsExecuted.length
    });
    
    return new Response(
      JSON.stringify({
        active: true,
        response: aiResult.response,
        agentUsed: aiResult.agentUsed,
        intent,
        confidence,
        action: aiResult.action,
        actionResult: aiResult.actionResult,
        actionsExecuted,
        shouldTransfer: aiResult.shouldTransfer,
        executionTime: execTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [ORCHESTRATOR] Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
