import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// FERRAMENTAS DA IA DE AGENDAMENTO
// ========================

interface IATools {
  buscar_horarios_disponiveis: (params: { data: string; profissional_id?: string; duracao_minutos?: number }) => Promise<any>;
  listar_profissionais: (params: { especialidade?: string; company_id: string }) => Promise<any>;
  criar_compromisso: (params: { lead_id: string; profissional_id?: string; data_hora: string; tipo_servico: string; duracao_minutos?: number; observacoes?: string; company_id: string; owner_id: string }) => Promise<any>;
  alterar_compromisso: (params: { compromisso_id: string; novos_dados: any }) => Promise<any>;
  cancelar_compromisso: (params: { compromisso_id: string; motivo?: string }) => Promise<any>;
  buscar_compromissos_lead: (params: { lead_id: string }) => Promise<any>;
}

async function createTools(supabase: any): Promise<IATools> {
  return {
    buscar_horarios_disponiveis: async ({ data, profissional_id, duracao_minutos = 30 }) => {
      console.log('🔍 [TOOL] Buscando horários disponíveis:', { data, profissional_id, duracao_minutos });
      
      const dataInicio = `${data}T00:00:00`;
      const dataFim = `${data}T23:59:59`;
      
      let query = supabase
        .from('compromissos')
        .select('data_hora_inicio, data_hora_fim, profissional_id')
        .gte('data_hora_inicio', dataInicio)
        .lte('data_hora_inicio', dataFim)
        .neq('status', 'cancelado');
      
      if (profissional_id) {
        query = query.eq('profissional_id', profissional_id);
      }
      
      const { data: compromissosExistentes, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar compromissos:', error);
        return { error: 'Erro ao buscar horários' };
      }
      
      const horariosBase = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
      ];
      
      const horariosOcupados = (compromissosExistentes || []).map((c: any) => {
        const hora = new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return hora;
      });
      
      const horariosDisponiveis = horariosBase.filter(h => !horariosOcupados.includes(h));
      
      return {
        data,
        horarios_disponiveis: horariosDisponiveis,
        horarios_ocupados: horariosOcupados,
        total_disponiveis: horariosDisponiveis.length
      };
    },
    
    listar_profissionais: async ({ especialidade, company_id }) => {
      console.log('🔍 [TOOL] Listando profissionais:', { especialidade, company_id });
      
      let query = supabase
        .from('profissionais')
        .select('id, nome, especialidade, email, telefone')
        .eq('company_id', company_id);
      
      if (especialidade) {
        query = query.ilike('especialidade', `%${especialidade}%`);
      }
      
      const { data: profissionais, error } = await query;
      
      if (error) {
        console.error('Erro ao buscar profissionais:', error);
        return { error: 'Erro ao buscar profissionais' };
      }
      
      return {
        profissionais: profissionais || [],
        total: (profissionais || []).length
      };
    },
    
    criar_compromisso: async ({ lead_id, profissional_id, data_hora, tipo_servico, duracao_minutos = 30, observacoes, company_id, owner_id }) => {
      console.log('📅 [TOOL] Criando compromisso:', { lead_id, data_hora, tipo_servico });
      
      const dataHoraInicio = new Date(data_hora);
      const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao_minutos * 60 * 1000);
      
      // Verificar conflitos
      const { data: conflitos } = await supabase
        .from('compromissos')
        .select('id')
        .gte('data_hora_inicio', dataHoraInicio.toISOString())
        .lt('data_hora_inicio', dataHoraFim.toISOString())
        .neq('status', 'cancelado')
        .limit(1);
      
      if (conflitos && conflitos.length > 0) {
        return { 
          success: false, 
          error: 'Já existe um compromisso neste horário',
          conflito: true
        };
      }
      
      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .insert({
          lead_id,
          profissional_id,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico,
          observacoes,
          status: 'agendado',
          company_id,
          owner_id,
          usuario_responsavel_id: owner_id
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar compromisso:', error);
        return { success: false, error: 'Erro ao criar compromisso' };
      }
      
      return {
        success: true,
        compromisso_id: compromisso.id,
        data_hora_inicio: compromisso.data_hora_inicio,
        data_hora_fim: compromisso.data_hora_fim,
        mensagem: `Compromisso agendado para ${dataHoraInicio.toLocaleDateString('pt-BR')} às ${dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      };
    },
    
    alterar_compromisso: async ({ compromisso_id, novos_dados }) => {
      console.log('✏️ [TOOL] Alterando compromisso:', { compromisso_id, novos_dados });
      
      const { error } = await supabase
        .from('compromissos')
        .update({
          ...novos_dados,
          updated_at: new Date().toISOString()
        })
        .eq('id', compromisso_id);
      
      if (error) {
        console.error('Erro ao alterar compromisso:', error);
        return { success: false, error: 'Erro ao alterar compromisso' };
      }
      
      return { success: true, mensagem: 'Compromisso alterado com sucesso' };
    },
    
    cancelar_compromisso: async ({ compromisso_id, motivo }) => {
      console.log('❌ [TOOL] Cancelando compromisso:', { compromisso_id, motivo });
      
      const { error } = await supabase
        .from('compromissos')
        .update({
          status: 'cancelado',
          observacoes: motivo ? `Cancelado: ${motivo}` : 'Cancelado',
          updated_at: new Date().toISOString()
        })
        .eq('id', compromisso_id);
      
      if (error) {
        console.error('Erro ao cancelar compromisso:', error);
        return { success: false, error: 'Erro ao cancelar compromisso' };
      }
      
      return { success: true, mensagem: 'Compromisso cancelado com sucesso' };
    },
    
    buscar_compromissos_lead: async ({ lead_id }) => {
      console.log('🔍 [TOOL] Buscando compromissos do lead:', { lead_id });
      
      const { data: compromissos, error } = await supabase
        .from('compromissos')
        .select('*')
        .eq('lead_id', lead_id)
        .order('data_hora_inicio', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar compromissos:', error);
        return { error: 'Erro ao buscar compromissos' };
      }
      
      const agora = new Date();
      const futuros = (compromissos || []).filter((c: any) => new Date(c.data_hora_inicio) > agora && c.status !== 'cancelado');
      const passados = (compromissos || []).filter((c: any) => new Date(c.data_hora_inicio) <= agora);
      
      return {
        compromissos_futuros: futuros,
        compromissos_passados: passados,
        total: (compromissos || []).length
      };
    }
  };
}

// ========================
// FUNÇÃO PRINCIPAL - PROMPT PERSONALIZADO
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
    
    const { conversationId, message, leadData, companyId, action } = await req.json();
    
    // Se for uma chamada direta de ferramenta
    if (action) {
      const tools = await createTools(supabase);
      const bodyData = req.body ? await req.json() : {};
      
      switch (action) {
        case 'buscar_horarios':
          const horarios = await tools.buscar_horarios_disponiveis(bodyData);
          return new Response(JSON.stringify(horarios), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'listar_profissionais':
          const profissionais = await tools.listar_profissionais(bodyData);
          return new Response(JSON.stringify(profissionais), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'criar_compromisso':
          const novoCompromisso = await tools.criar_compromisso(bodyData);
          return new Response(JSON.stringify(novoCompromisso), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        default:
          break;
      }
    }
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // ========================================
    // BUSCAR PROMPT PERSONALIZADO DA BASE DE DADOS
    // ========================================
    let promptPersonalizado = null;
    
    if (companyId) {
      const { data: iaConfig } = await supabase
        .from('ia_configurations')
        .select('custom_prompts')
        .eq('company_id', companyId)
        .single();
      
      // Buscar prompt específico para agente de agendamento
      if (iaConfig?.custom_prompts) {
        const customPrompts = iaConfig.custom_prompts as any;
        promptPersonalizado = customPrompts.agendamento || customPrompts.default || null;
      }
    }

    // ========================================
    // MONTAR CONTEXTO DINÂMICO
    // ========================================
    const leadContext = leadData ? `
DADOS DO CLIENTE:
- Nome: ${leadData.name || 'Não informado'}
- Telefone: ${leadData.phone || leadData.telefone || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Empresa: ${leadData.company || 'Não informado'}
` : '';

    // Buscar compromissos existentes do lead
    let compromissosContext = '';
    if (leadData?.id) {
      const tools = await createTools(supabase);
      const compromissos = await tools.buscar_compromissos_lead({ lead_id: leadData.id });
      
      if (compromissos.compromissos_futuros?.length > 0) {
        compromissosContext = `
COMPROMISSOS AGENDADOS:
${compromissos.compromissos_futuros.map((c: any) => 
  `- ${new Date(c.data_hora_inicio).toLocaleDateString('pt-BR')} às ${new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} - ${c.tipo_servico} (${c.status})`
).join('\n')}
`;
      } else {
        compromissosContext = '\nO cliente não possui compromissos agendados.\n';
      }
    }

    // Buscar horários disponíveis de hoje e amanhã
    const hoje = new Date().toISOString().split('T')[0];
    const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const tools = await createTools(supabase);
    const horariosHoje = await tools.buscar_horarios_disponiveis({ data: hoje });
    const horariosAmanha = await tools.buscar_horarios_disponiveis({ data: amanha });
    
    const horariosContext = `
HORÁRIOS DISPONÍVEIS:
Hoje (${hoje}): ${horariosHoje.horarios_disponiveis?.slice(0, 5).join(', ') || 'Nenhum'} ${horariosHoje.horarios_disponiveis?.length > 5 ? `e mais ${horariosHoje.horarios_disponiveis.length - 5}` : ''}
Amanhã (${amanha}): ${horariosAmanha.horarios_disponiveis?.slice(0, 5).join(', ') || 'Nenhum'} ${horariosAmanha.horarios_disponiveis?.length > 5 ? `e mais ${horariosAmanha.horarios_disponiveis.length - 5}` : ''}
`;

    // ========================================
    // CONSTRUIR PROMPT FINAL
    // ========================================
    let systemPrompt = '';
    
    // Se tem prompt personalizado, usar SOMENTE ele + contexto dinâmico
    if (promptPersonalizado && promptPersonalizado.trim()) {
      // Substituir variáveis no prompt personalizado
      let promptComVariaveis = promptPersonalizado
        .replace(/{lead\.name}/g, leadData?.name || 'Cliente')
        .replace(/{lead\.phone}/g, leadData?.phone || leadData?.telefone || '')
        .replace(/{lead\.email}/g, leadData?.email || '')
        .replace(/{lead\.company}/g, leadData?.company || '')
        .replace(/{company\.name}/g, 'Empresa');
      
      systemPrompt = `${promptComVariaveis}

${leadContext}
${compromissosContext}
${horariosContext}

AÇÕES DISPONÍVEIS (inclua no final da resposta entre colchetes, se aplicável):
- [VERIFICAR_HORARIOS:YYYY-MM-DD] - para verificar horários de uma data
- [AGENDAR:YYYY-MM-DDTHH:MM|TIPO_SERVICO] - para confirmar agendamento
- [ALTERAR:COMPROMISSO_ID|NOVOS_DADOS] - para alterar compromisso
- [CANCELAR:COMPROMISSO_ID] - para cancelar compromisso
- [TRANSFERIR_HUMANO] - para transferir para atendente humano`;
    } else {
      // Se NÃO tem prompt personalizado, usar prompt padrão básico
      systemPrompt = `Você é uma assistente especializada em agendamentos. Ajude clientes a agendar, alterar ou cancelar compromissos.

${leadContext}
${compromissosContext}
${horariosContext}

AÇÕES DISPONÍVEIS (inclua no final da resposta entre colchetes, se aplicável):
- [VERIFICAR_HORARIOS:YYYY-MM-DD] - para verificar horários de uma data
- [AGENDAR:YYYY-MM-DDTHH:MM|TIPO_SERVICO] - para confirmar agendamento
- [ALTERAR:COMPROMISSO_ID|NOVOS_DADOS] - para alterar compromisso
- [CANCELAR:COMPROMISSO_ID] - para cancelar compromisso
- [TRANSFERIR_HUMANO] - para transferir para atendente humano`;
    }

    console.log('📅 IA Agendamento - Processando:', { 
      conversationId, 
      message: message.substring(0, 50),
      hasCustomPrompt: !!promptPersonalizado
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
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições atingido.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('❌ Erro da IA:', response.status, errorText);
      throw new Error(`Erro da IA: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Extrair e executar ações
    const actionPattern = /\[(VERIFICAR_HORARIOS|AGENDAR|ALTERAR|CANCELAR|TRANSFERIR_HUMANO|CONFIRMAR_DADOS)(:([^\]]+))?\]/;
    const actionMatch = aiResponse.match(actionPattern);
    
    const actionType = actionMatch ? actionMatch[1] : null;
    const actionParams = actionMatch ? actionMatch[3] : null;
    
    const cleanResponse = aiResponse.replace(actionPattern, '').trim();

    let actionResult = null;

    if (actionType && leadData?.id && companyId) {
      const { data: user } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', companyId)
        .limit(1)
        .single();
      
      const ownerId = user?.user_id;

      switch (actionType) {
        case 'VERIFICAR_HORARIOS':
          if (actionParams) {
            const horariosData = await tools.buscar_horarios_disponiveis({ data: actionParams });
            actionResult = horariosData;
          }
          break;
          
        case 'AGENDAR':
          if (actionParams && ownerId) {
            const [dataHora, tipoServico] = actionParams.split('|');
            if (dataHora && tipoServico) {
              const resultado = await tools.criar_compromisso({
                lead_id: leadData.id,
                data_hora: dataHora,
                tipo_servico: tipoServico,
                company_id: companyId,
                owner_id: ownerId
              });
              actionResult = resultado;
            }
          }
          break;
          
        case 'CANCELAR':
          if (actionParams) {
            const resultado = await tools.cancelar_compromisso({ compromisso_id: actionParams });
            actionResult = resultado;
          }
          break;
      }
    }

    // Log da interação para aprendizado
    try {
      await supabase.functions.invoke('ia-aprendizado', {
        body: {
          companyId,
          agentType: 'agendamento',
          inputMessage: message,
          aiResponse: cleanResponse,
          action: actionType,
          actionParams,
          actionResult,
          leadId: leadData?.id
        }
      });
    } catch (e) {
      console.warn('⚠️ Erro ao registrar aprendizado:', e);
    }

    const executionTime = Date.now() - startTime;
    console.log(`✅ IA Agendamento - Concluído em ${executionTime}ms`);

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        action: actionType,
        actionParams,
        actionResult,
        executionTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na IA Agendamento:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        response: 'Desculpe, tive um problema técnico. Um atendente humano irá te ajudar.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
