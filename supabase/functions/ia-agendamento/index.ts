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
    // Buscar horários disponíveis em uma data
    buscar_horarios_disponiveis: async ({ data, profissional_id, duracao_minutos = 30 }) => {
      console.log('🔍 [TOOL] Buscando horários disponíveis:', { data, profissional_id, duracao_minutos });
      
      // Buscar compromissos do dia
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
      
      // Horário comercial padrão (pode ser customizado por empresa)
      const horariosBase = [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
      ];
      
      // Filtrar horários ocupados
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
    
    // Listar profissionais/especialistas
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
    
    // Criar novo compromisso
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
    
    // Alterar compromisso existente
    alterar_compromisso: async ({ compromisso_id, novos_dados }) => {
      console.log('✏️ [TOOL] Alterando compromisso:', { compromisso_id, novos_dados });
      
      const updateData: any = {};
      
      if (novos_dados.data_hora) {
        const dataHoraInicio = new Date(novos_dados.data_hora);
        const duracao = novos_dados.duracao_minutos || 30;
        const dataHoraFim = new Date(dataHoraInicio.getTime() + duracao * 60 * 1000);
        updateData.data_hora_inicio = dataHoraInicio.toISOString();
        updateData.data_hora_fim = dataHoraFim.toISOString();
      }
      
      if (novos_dados.tipo_servico) updateData.tipo_servico = novos_dados.tipo_servico;
      if (novos_dados.observacoes) updateData.observacoes = novos_dados.observacoes;
      if (novos_dados.profissional_id) updateData.profissional_id = novos_dados.profissional_id;
      if (novos_dados.status) updateData.status = novos_dados.status;
      
      updateData.updated_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('compromissos')
        .update(updateData)
        .eq('id', compromisso_id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao alterar compromisso:', error);
        return { success: false, error: 'Erro ao alterar compromisso' };
      }
      
      return {
        success: true,
        compromisso: data,
        mensagem: 'Compromisso alterado com sucesso'
      };
    },
    
    // Cancelar compromisso
    cancelar_compromisso: async ({ compromisso_id, motivo }) => {
      console.log('❌ [TOOL] Cancelando compromisso:', { compromisso_id, motivo });
      
      const { data, error } = await supabase
        .from('compromissos')
        .update({
          status: 'cancelado',
          observacoes: motivo ? `Cancelado: ${motivo}` : 'Cancelado pelo cliente',
          updated_at: new Date().toISOString()
        })
        .eq('id', compromisso_id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao cancelar compromisso:', error);
        return { success: false, error: 'Erro ao cancelar compromisso' };
      }
      
      return {
        success: true,
        mensagem: 'Compromisso cancelado com sucesso'
      };
    },
    
    // Buscar compromissos de um lead
    buscar_compromissos_lead: async ({ lead_id }) => {
      console.log('🔍 [TOOL] Buscando compromissos do lead:', lead_id);
      
      const { data: compromissos, error } = await supabase
        .from('compromissos')
        .select(`
          id,
          data_hora_inicio,
          data_hora_fim,
          tipo_servico,
          status,
          observacoes,
          profissional:profissionais(nome, especialidade)
        `)
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
    
    const { conversationId, message, leadData, companyId, action } = await req.json();
    
    // Se for uma chamada direta de ferramenta
    if (action) {
      const tools = await createTools(supabase);
      
      switch (action) {
        case 'buscar_horarios':
          const horarios = await tools.buscar_horarios_disponiveis(req.body);
          return new Response(JSON.stringify(horarios), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'listar_profissionais':
          const profissionais = await tools.listar_profissionais(req.body);
          return new Response(JSON.stringify(profissionais), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        case 'criar_compromisso':
          const novoCompromisso = await tools.criar_compromisso(req.body);
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

    // Contexto do lead
    const leadContext = leadData ? `
DADOS DO CLIENTE:
- Nome: ${leadData.name}
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

    const systemPrompt = `Você é uma assistente especializada em agendamentos. Seu papel é ajudar clientes a:
1. Verificar disponibilidade de horários
2. Agendar novos compromissos/consultas
3. Alterar compromissos existentes
4. Cancelar compromissos
5. Tirar dúvidas sobre horários

${leadContext}
${compromissosContext}
${horariosContext}

REGRAS IMPORTANTES:
1. Sempre seja cordial e profissional
2. Confirme os dados antes de agendar (data, horário, tipo de serviço)
3. Se o cliente quiser agendar, pergunte a data e horário preferidos
4. Se não houver horário disponível, sugira alternativas
5. Mantenha respostas curtas (máximo 4 linhas)
6. Use emojis moderadamente

AÇÕES DISPONÍVEIS (inclua no final da resposta entre colchetes):
- [VERIFICAR_HORARIOS:YYYY-MM-DD] - quando cliente perguntar horários de uma data específica
- [AGENDAR:YYYY-MM-DDTHH:MM|TIPO_SERVICO] - quando confirmar agendamento
- [ALTERAR:COMPROMISSO_ID|NOVOS_DADOS] - quando alterar compromisso
- [CANCELAR:COMPROMISSO_ID] - quando cancelar compromisso
- [TRANSFERIR_HUMANO] - quando precisar de ajuda humana
- [CONFIRMAR_DADOS] - quando precisar confirmar dados do cliente

Responda à mensagem do cliente de forma natural e inclua a ação no final, se aplicável.`;

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
        temperature: 0.7,
        max_tokens: 600,
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
    const aiResponse = data.choices[0].message.content;

    // Extrair ação da resposta
    const actionMatch = aiResponse.match(/\[(VERIFICAR_HORARIOS|AGENDAR|ALTERAR|CANCELAR|TRANSFERIR_HUMANO|CONFIRMAR_DADOS)(:([^\]]+))?\]/);
    const actionType = actionMatch ? actionMatch[1] : null;
    const actionParams = actionMatch ? actionMatch[3] : null;
    
    // Remover ação da resposta
    const cleanResponse = aiResponse.replace(/\[(VERIFICAR_HORARIOS|AGENDAR|ALTERAR|CANCELAR|TRANSFERIR_HUMANO|CONFIRMAR_DADOS)(:([^\]]+))?\]/g, '').trim();

    // Executar ação automaticamente se aplicável
    let actionResult = null;
    
    if (actionType === 'AGENDAR' && actionParams && leadData?.id) {
      const [dataHora, tipoServico] = actionParams.split('|');
      
      // Buscar owner_id e company_id
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', companyId)
        .eq('role', 'company_admin')
        .limit(1)
        .single();
      
      const owner_id = userRole?.user_id || leadData.owner_id;
      
      actionResult = await tools.criar_compromisso({
        lead_id: leadData.id,
        data_hora: dataHora,
        tipo_servico: tipoServico || 'Consulta',
        company_id: companyId,
        owner_id
      });
    }
    
    if (actionType === 'VERIFICAR_HORARIOS' && actionParams) {
      actionResult = await tools.buscar_horarios_disponiveis({ data: actionParams });
    }
    
    if (actionType === 'CANCELAR' && actionParams) {
      actionResult = await tools.cancelar_compromisso({ compromisso_id: actionParams });
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
            company_id: companyId,
            agent_type: 'agendamento',
            conversation_id: conversationId,
            lead_id: leadData?.id,
            input_message: message,
            ai_response: cleanResponse,
            context_data: { action: actionType, actionParams, actionResult }
          }
        })
      });
    } catch (e) {
      console.log('Erro ao registrar aprendizado:', e);
    }

    const execTime = Date.now() - startTime;
    console.log('✅ IA Agendamento - Resposta gerada em', execTime, 'ms:', { action: actionType, response: cleanResponse.substring(0, 50) });

    return new Response(
      JSON.stringify({ 
        response: cleanResponse,
        action: actionType,
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
    console.error('❌ Erro na ia-agendamento:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

