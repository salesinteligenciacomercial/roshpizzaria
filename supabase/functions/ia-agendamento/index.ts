import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const { conversationId, message, leadData, companyId } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // Buscar configuração e prompt personalizado
    const { data: iaConfig } = await supabase
      .from('ia_configurations')
      .select('custom_prompts')
      .eq('company_id', companyId)
      .single();

    const customPrompt = iaConfig?.custom_prompts?.agendamento?.custom_prompt;

    // Funções disponíveis para a IA
    const tools = [
      {
        type: "function",
        function: {
          name: "buscar_horarios_disponiveis",
          description: "Busca horários disponíveis para agendamento em uma data específica",
          parameters: {
            type: "object",
            properties: {
              data: { type: "string", description: "Data no formato YYYY-MM-DD" },
              profissional_id: { type: "string", description: "ID do profissional (opcional)" }
            },
            required: ["data"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "listar_profissionais",
          description: "Lista profissionais disponíveis para agendamento",
          parameters: {
            type: "object",
            properties: {
              especialidade: { type: "string", description: "Filtrar por especialidade (opcional)" }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "criar_compromisso",
          description: "Cria um novo compromisso/agendamento",
          parameters: {
            type: "object",
            properties: {
              lead_id: { type: "string", description: "ID do lead" },
              data_hora_inicio: { type: "string", description: "Data e hora de início (ISO 8601)" },
              tipo_servico: { type: "string", description: "Tipo de serviço" },
              profissional_id: { type: "string", description: "ID do profissional" },
              observacoes: { type: "string", description: "Observações do agendamento" }
            },
            required: ["lead_id", "data_hora_inicio", "tipo_servico"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "cancelar_compromisso",
          description: "Cancela um compromisso existente",
          parameters: {
            type: "object",
            properties: {
              compromisso_id: { type: "string", description: "ID do compromisso" }
            },
            required: ["compromisso_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "buscar_compromissos_lead",
          description: "Busca compromissos de um lead específico",
          parameters: {
            type: "object",
            properties: {
              lead_id: { type: "string", description: "ID do lead" }
            },
            required: ["lead_id"]
          }
        }
      }
    ];

    const leadContext = leadData ? `
Cliente: ${leadData.name}
Telefone: ${leadData.phone || 'Não informado'}
Email: ${leadData.email || 'Não informado'}
` : '';

    const defaultPrompt = `Você é a assistente de agendamentos. Gerencie compromissos e horários.

CONTEXTO:
${leadContext}

REGRAS:
- Confirme dados antes de agendar
- Ofereça opções de horário
- Pergunte tipo de serviço
- Confirme data e hora
- Seja objetiva (máximo 4 linhas)

AÇÕES (use no final se aplicável):
- [VERIFICAR_HORARIOS:YYYY-MM-DD] - buscar horários disponíveis
- [AGENDAR:DATA|SERVICO] - criar agendamento
- [CANCELAR:ID] - cancelar compromisso
- [TRANSFERIR_HUMANO] - passar para atendente humano

Use as funções disponíveis para:
- buscar_horarios_disponiveis: verificar disponibilidade
- listar_profissionais: mostrar profissionais
- criar_compromisso: agendar
- cancelar_compromisso: cancelar agendamento
- buscar_compromissos_lead: ver agendamentos existentes

Responda de forma natural e helpful. Máximo 5 linhas.`;

    const systemPrompt = customPrompt || defaultPrompt;

    console.log('📅 IA Agendamento - Processando:', { conversationId, message: message.substring(0, 50) });

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
        tools,
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        return new Response(
          JSON.stringify({ error: response.status === 429 ? 'Rate limit' : 'Créditos insuficientes' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Erro da IA: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0].message;

    // Processar tool calls se existirem
    if (aiMessage.tool_calls) {
      const results = [];
      
      for (const toolCall of aiMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        let result;
        
        switch (functionName) {
          case 'buscar_horarios_disponiveis':
            const { data: compromissos } = await supabase
              .from('compromissos')
              .select('data_hora_inicio, data_hora_fim, profissional_id')
              .gte('data_hora_inicio', args.data)
              .lt('data_hora_inicio', `${args.data}T23:59:59`)
              .eq('company_id', companyId);
            
            result = { horarios_ocupados: compromissos };
            break;
            
          case 'listar_profissionais':
            const { data: profissionais } = await supabase
              .from('profissionais')
              .select('id, nome, especialidade, email')
              .eq('company_id', companyId);
            
            result = { profissionais };
            break;
            
          case 'criar_compromisso':
            const dataHoraFim = new Date(args.data_hora_inicio);
            dataHoraFim.setMinutes(dataHoraFim.getMinutes() + 60);
            
            const { data: compromisso, error } = await supabase
              .from('compromissos')
              .insert({
                lead_id: args.lead_id,
                data_hora_inicio: args.data_hora_inicio,
                data_hora_fim: dataHoraFim.toISOString(),
                tipo_servico: args.tipo_servico,
                profissional_id: args.profissional_id,
                observacoes: args.observacoes,
                company_id: companyId,
                owner_id: leadData?.owner_id,
                usuario_responsavel_id: leadData?.owner_id,
                status: 'agendado'
              })
              .select()
              .single();
            
            result = error ? { error: error.message } : { compromisso };
            break;
            
          case 'cancelar_compromisso':
            const { error: cancelError } = await supabase
              .from('compromissos')
              .update({ status: 'cancelado' })
              .eq('id', args.compromisso_id);
            
            result = cancelError ? { error: cancelError.message } : { success: true };
            break;
            
          case 'buscar_compromissos_lead':
            const { data: compromissosLead } = await supabase
              .from('compromissos')
              .select('*, profissionais(nome)')
              .eq('lead_id', args.lead_id)
              .order('data_hora_inicio', { ascending: false });
            
            result = { compromissos: compromissosLead };
            break;
        }
        
        results.push({ tool_call_id: toolCall.id, result });
      }
      
      // Segunda chamada com os resultados das ferramentas
      const secondResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
            aiMessage,
            ...results.map(r => ({
              role: 'tool',
              tool_call_id: r.tool_call_id,
              content: JSON.stringify(r.result)
            }))
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });
      
      const secondData = await secondResponse.json();
      const finalResponse = secondData.choices[0].message.content;
      
      // Registrar no sistema de aprendizado
      try {
        await fetch(`${supabaseUrl}/functions/v1/ia-aprendizado`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'record_interaction',
            data: {
              company_id: companyId,
              agent_type: 'agendamento',
              conversation_id: conversationId,
              lead_id: leadData?.id,
              input_message: message,
              ai_response: finalResponse,
              context_data: { tools_used: results.map(r => r.tool_call_id) }
            }
          })
        });
      } catch (e) {
        console.log('Erro ao registrar aprendizado:', e);
      }
      
      console.log('✅ IA Agendamento - Resposta:', finalResponse.substring(0, 50));
      
      return new Response(
        JSON.stringify({ 
          response: finalResponse,
          conversationId 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    // Se não houver tool calls, retornar resposta direta
    const cleanResponse = aiMessage.content;
    
    // Registrar no sistema de aprendizado
    try {
      await fetch(`${supabaseUrl}/functions/v1/ia-aprendizado`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'record_interaction',
          data: {
            company_id: companyId,
            agent_type: 'agendamento',
            conversation_id: conversationId,
            lead_id: leadData?.id,
            input_message: message,
            ai_response: cleanResponse,
            context_data: { leadData }
          }
        })
      });
    } catch (e) {
      console.log('Erro ao registrar aprendizado:', e);
    }

    console.log('✅ IA Agendamento - Resposta:', cleanResponse.substring(0, 50));

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        conversationId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na ia-agendamento:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
