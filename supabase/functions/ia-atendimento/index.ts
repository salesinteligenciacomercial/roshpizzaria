import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const { conversationId, message, leadData, companyId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Montar contexto do lead
    const leadContext = leadData ? `
Lead: ${leadData.name}
Empresa: ${leadData.company || 'Não informado'}
Telefone: ${leadData.phone || 'Não informado'}
Etapa do funil: ${leadData.funnelStage || 'Novo'}
Histórico: ${leadData.notes || 'Sem histórico'}
` : '';

    const systemPrompt = `Você é um assistente de atendimento ao cliente inteligente.

CONTEXTO DO ATENDIMENTO:
${leadContext}

REGRAS:
1. Seja cordial, profissional e direto
2. Faça perguntas para qualificar o lead (necessidade, orçamento, urgência)
3. Se o lead demonstrar interesse, sugira agendar uma reunião
4. Se precisar de informações complexas ou decisões comerciais, transfira para um humano
5. Mantenha respostas curtas (máximo 3 linhas)
6. Use emojis moderadamente para humanizar

AÇÕES DISPONÍVEIS:
- [QUALIFICAR]: quando obtiver informações importantes do lead
- [AGENDAR]: quando o lead aceitar marcar reunião
- [TRANSFERIR_HUMANO]: quando precisar de intervenção humana
- [CRIAR_TAREFA]: quando identificar uma ação necessária

Responda à mensagem do cliente de forma natural e inclua no final da resposta a ação recomendada entre colchetes, se aplicável.`;

    console.log('🤖 IA Atendimento - Processando:', { conversationId, message: message.substring(0, 50) });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione fundos à sua conta Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('❌ Erro da IA:', response.status, errorText);
      throw new Error(`Erro da IA: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Extrair ação recomendada
    const actionMatch = aiResponse.match(/\[(QUALIFICAR|AGENDAR|TRANSFERIR_HUMANO|CRIAR_TAREFA)\]/);
    const action = actionMatch ? actionMatch[1] : null;
    
    // Remover a ação da resposta final
    const cleanResponse = aiResponse.replace(/\[(QUALIFICAR|AGENDAR|TRANSFERIR_HUMANO|CRIAR_TAREFA)\]/g, '').trim();

    // Registrar no sistema de aprendizado
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/ia-aprendizado`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'record_interaction',
          data: {
            company_id: leadData?.company_id,
            agent_type: 'atendimento',
            conversation_id: conversationId,
            lead_id: leadData?.id,
            input_message: message,
            ai_response: cleanResponse,
            context_data: { action, leadData }
          }
        })
      });
    } catch (e) {
      console.log('Erro ao registrar aprendizado:', e);
    }

    console.log('✅ IA Atendimento - Resposta gerada:', { action, response: cleanResponse.substring(0, 50) });

    // Registrar log de execução e métricas
    try {
      const execTime = Date.now() - startTime;
      await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/ia_execution_logs`, {
        method: 'POST',
        headers: {
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_id: leadData?.company_id || companyId,
          agent_type: 'atendimento',
          conversation_id: conversationId,
          lead_id: leadData?.id,
          input_message: message,
          output_response: cleanResponse,
          execution_time_ms: execTime,
          success: true,
          action_taken: action || 'RESPONDER',
          confidence_score: 0.8,
          model_version: 'google/gemini-2.5-flash'
        })
      });
    } catch (e) {
      console.log('Erro ao registrar ia_execution_logs:', e);
    }

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        action,
        conversationId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na função ia-atendimento:', error);
    // Registrar falha
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/ia_execution_logs`, {
        method: 'POST',
        headers: {
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          company_id: (await req.json())?.companyId || null,
          agent_type: 'atendimento',
          success: false,
          error_message: error.message || 'Erro ao processar IA',
        })
      });
    } catch (_e) {}
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar IA de atendimento' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
