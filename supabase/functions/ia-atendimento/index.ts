import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// IA DE ATENDIMENTO AVANÇADA
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
    
    const { conversationId, message, leadData, companyId, customPrompt } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Buscar contexto adicional
    let leadContext = '';
    let funilContext = '';
    let tarefasContext = '';
    
    if (leadData) {
      leadContext = `
DADOS DO CLIENTE:
- Nome: ${leadData.name || 'Não informado'}
- Telefone: ${leadData.phone || leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Empresa: ${leadData.company || 'Não informado'}
- CPF: ${leadData.cpf || 'Não informado'}
- Valor em negociação: ${leadData.value ? `R$ ${leadData.value}` : 'Não definido'}
- Status: ${leadData.status || 'novo'}
- Tags: ${leadData.tags?.join(', ') || 'Nenhuma'}
- Observações: ${leadData.notes || 'Nenhuma'}
`;

      // Buscar etapa/funil do lead
      if (leadData.etapa_id) {
        const { data: etapa } = await supabase
          .from('etapas')
          .select('nome, funil:funis(nome)')
          .eq('id', leadData.etapa_id)
          .single();
        
        if (etapa) {
          funilContext = `
POSIÇÃO NO FUNIL:
- Funil: ${(etapa as any).funil?.nome || 'Não definido'}
- Etapa: ${etapa.nome}
`;
        }
      }
      
      // Buscar tarefas do lead
      if (leadData.id) {
        const { data: tarefas } = await supabase
          .from('tasks')
          .select('title, status, priority, due_date')
          .eq('lead_id', leadData.id)
          .in('status', ['pendente', 'em_andamento'])
          .limit(5);
        
        if (tarefas && tarefas.length > 0) {
          tarefasContext = `
TAREFAS PENDENTES:
${tarefas.map((t: any) => `- ${t.title} (${t.priority}) - ${t.status}`).join('\n')}
`;
        }
      }
    }

    // Buscar histórico recente da conversa
    let historicoContext = '';
    if (conversationId && companyId) {
      const { data: historico } = await supabase
        .from('conversas')
        .select('mensagem, fromme, created_at')
        .eq('telefone_formatado', leadData?.telefone || leadData?.phone)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (historico && historico.length > 1) {
        historicoContext = `
HISTÓRICO RECENTE:
${historico.slice(1).reverse().map((h: any) => 
  `${h.fromme ? 'Você' : 'Cliente'}: ${h.mensagem?.substring(0, 100)}`
).join('\n')}
`;
      }
    }

    // Buscar funis disponíveis para sugerir movimentação
    let funisDisponiveis = '';
    if (companyId) {
      const { data: funis } = await supabase
        .from('funis')
        .select('id, nome, etapas(id, nome)')
        .eq('company_id', companyId)
        .limit(3);
      
      if (funis && funis.length > 0) {
        funisDisponiveis = `
FUNIS DISPONÍVEIS:
${funis.map((f: any) => `- ${f.nome}: ${f.etapas?.map((e: any) => e.nome).join(' → ') || 'Sem etapas'}`).join('\n')}
`;
      }
    }

    const systemPrompt = customPrompt || `Você é uma assistente de atendimento inteligente e proativa. Seu papel é:
1. Fazer pré-atendimento e triagem
2. Qualificar leads (entender necessidade, orçamento, urgência)
3. Coletar informações importantes (CPF, email, empresa)
4. Identificar oportunidades de agendamento ou venda
5. Criar tarefas de follow-up quando necessário
6. Saber quando transferir para um humano

${leadContext}
${funilContext}
${tarefasContext}
${historicoContext}
${funisDisponiveis}

REGRAS DE COMPORTAMENTO:
1. Seja cordial, profissional e empático
2. Faça perguntas inteligentes para qualificar (não seja interrogativo)
3. Se detectar interesse em agendar, pergunte a data preferida
4. Se detectar interesse em comprar, explore necessidades
5. Colete informações naturalmente durante a conversa
6. Mantenha respostas curtas (máximo 4 linhas)
7. Use emojis moderadamente para humanizar
8. Se o cliente pedir atendente humano, transfira imediatamente

AÇÕES DISPONÍVEIS (inclua UMA ação no final da resposta entre colchetes):
- [QUALIFICAR] - quando obtiver informações importantes do lead
- [COLETAR_DADOS:campo] - quando coletar CPF, email, telefone, empresa (ex: [COLETAR_DADOS:cpf=12345678901])
- [ADICIONAR_TAG:nome] - quando identificar uma característica (ex: [ADICIONAR_TAG:interessado])
- [MOVER_FUNIL:etapa] - quando o lead avançar na jornada (ex: [MOVER_FUNIL:qualificado])
- [CRIAR_TAREFA:titulo] - quando identificar ação necessária (ex: [CRIAR_TAREFA:Enviar proposta])
- [AGENDAR] - quando cliente quiser marcar horário
- [TRANSFERIR_HUMANO] - quando precisar de intervenção humana

EXEMPLOS DE COLETA NATURAL:
- "Qual seu CPF para eu consultar seu cadastro?" → depois [COLETAR_DADOS:cpf=123.456.789-01]
- "Me passa seu e-mail que envio mais informações" → depois [COLETAR_DADOS:email=cliente@email.com]

Responda à mensagem do cliente de forma natural:`;

    console.log('🤖 IA Atendimento - Processando:', { 
      conversationId, 
      message: message.substring(0, 50),
      hasLead: !!leadData 
    });

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
        max_tokens: 600,
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

    // Extrair ação e parâmetros da resposta
    const actionPattern = /\[(QUALIFICAR|COLETAR_DADOS|ADICIONAR_TAG|MOVER_FUNIL|CRIAR_TAREFA|AGENDAR|TRANSFERIR_HUMANO)(:([^\]]+))?\]/;
    const actionMatch = aiResponse.match(actionPattern);
    
    const action = actionMatch ? actionMatch[1] : null;
    const actionParams = actionMatch ? actionMatch[3] : null;
    
    // Remover ação da resposta
    const cleanResponse = aiResponse.replace(actionPattern, '').trim();

    // Executar ações automaticamente
    let actionResult = null;
    
    if (action && leadData?.id) {
      switch (action) {
        case 'COLETAR_DADOS':
          if (actionParams) {
            const [campo, valor] = actionParams.split('=');
            if (campo && valor) {
              const { error } = await supabase
                .from('leads')
                .update({ 
                  [campo]: valor.trim(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', leadData.id);
              
              actionResult = { success: !error, campo, valor: valor.trim() };
              console.log(`📝 Dados coletados: ${campo}=${valor}`);
            }
          }
          break;
          
        case 'ADICIONAR_TAG':
          if (actionParams) {
            const tagsAtuais = leadData.tags || [];
            const novasTags = [...new Set([...tagsAtuais, actionParams.trim()])];
            
            const { error } = await supabase
              .from('leads')
              .update({ 
                tags: novasTags,
                updated_at: new Date().toISOString()
              })
              .eq('id', leadData.id);
            
            actionResult = { success: !error, tag: actionParams.trim() };
            console.log(`🏷️ Tag adicionada: ${actionParams}`);
          }
          break;
          
        case 'MOVER_FUNIL':
          if (actionParams && companyId) {
            // Buscar etapa pelo nome
            const { data: etapa } = await supabase
              .from('etapas')
              .select('id')
              .eq('company_id', companyId)
              .ilike('nome', `%${actionParams.trim()}%`)
              .limit(1)
              .single();
            
            if (etapa) {
              const { error } = await supabase
                .from('leads')
                .update({ 
                  etapa_id: etapa.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', leadData.id);
              
              actionResult = { success: !error, etapa: actionParams.trim() };
              console.log(`📋 Lead movido para: ${actionParams}`);
            }
          }
          break;
          
        case 'CRIAR_TAREFA':
          if (actionParams && companyId) {
            const { data: userRole } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('company_id', companyId)
              .eq('role', 'company_admin')
              .limit(1)
              .single();
            
            const { data: tarefa, error } = await supabase
              .from('tasks')
              .insert({
                title: actionParams.trim(),
                lead_id: leadData.id,
                description: `Tarefa criada pela IA após conversa. Mensagem: "${message.substring(0, 200)}"`,
                priority: 'alta',
                status: 'pendente',
                company_id: companyId,
                owner_id: userRole?.user_id || leadData.owner_id
              })
              .select()
              .single();
            
            actionResult = { success: !error, tarefa_id: tarefa?.id };
            console.log(`📋 Tarefa criada: ${actionParams}`);
          }
          break;
          
        case 'QUALIFICAR':
          const { error: qualError } = await supabase
            .from('leads')
            .update({ 
              status: 'qualificado',
              updated_at: new Date().toISOString()
            })
            .eq('id', leadData.id);
          
          actionResult = { success: !qualError };
          console.log('✅ Lead qualificado');
          break;
      }
    }

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
            company_id: companyId || leadData?.company_id,
            agent_type: 'atendimento',
            conversation_id: conversationId,
            lead_id: leadData?.id,
            input_message: message,
            ai_response: cleanResponse,
            context_data: { action, actionParams, actionResult, leadData }
          }
        })
      });
    } catch (e) {
      console.log('Erro ao registrar aprendizado:', e);
    }

    const execTime = Date.now() - startTime;
    console.log(`✅ IA Atendimento - Resposta em ${execTime}ms:`, { 
      action, 
      actionParams,
      response: cleanResponse.substring(0, 50) 
    });

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        action,
        actionParams,
        actionResult,
        conversationId 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro na função ia-atendimento:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar IA de atendimento' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
