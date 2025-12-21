import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// ============================================
// API PÚBLICA DE AGENDA
// Endpoint para auto-agendamento no site institucional
// ============================================

interface HorarioDisponivel {
  horario: string;
  disponivel: boolean;
  vagas_restantes?: number;
}

interface CompromissoInput {
  nome: string;
  telefone: string;
  email?: string;
  data: string;           // YYYY-MM-DD
  horario: string;        // HH:MM
  tipo_servico: string;
  observacoes?: string;
  company_slug?: string;
  agenda_id?: string;
  profissional_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'horarios';
    const companySlug = url.searchParams.get('company') || url.searchParams.get('company_slug');

    // Buscar empresa
    let companyId: string | null = null;
    let ownerId: string | null = null;

    if (companySlug) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, owner_user_id')
        .or(`domain.eq.${companySlug},name.ilike.%${companySlug}%`)
        .limit(1)
        .single();

      if (company) {
        companyId = company.id;
        ownerId = company.owner_user_id;
      }
    }

    // Se não encontrou, usar empresa master
    if (!companyId) {
      const { data: masterCompany } = await supabase
        .from('companies')
        .select('id, owner_user_id')
        .eq('is_master_account', true)
        .limit(1)
        .single();

      if (masterCompany) {
        companyId = masterCompany.id;
        ownerId = masterCompany.owner_user_id;
      }
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Empresa não encontrada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // GET: Listar agendas públicas
    // ============================================
    if (req.method === 'GET' && action === 'agendas') {
      const { data: agendas, error } = await supabase
        .from('agendas')
        .select(`
          id,
          nome,
          tipo,
          tempo_medio_servico,
          permite_simultaneo,
          capacidade_simultanea,
          disponibilidade
        `)
        .eq('company_id', companyId)
        .eq('status', 'ativa');

      if (error) {
        console.error('[api-public-agenda] Erro ao buscar agendas:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao buscar agendas' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          agendas: agendas || []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // GET: Listar horários disponíveis
    // ============================================
    if (req.method === 'GET' && action === 'horarios') {
      const data = url.searchParams.get('data');
      const agendaId = url.searchParams.get('agenda_id');
      const profissionalId = url.searchParams.get('profissional_id');

      if (!data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data é obrigatória (formato: YYYY-MM-DD)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar se data é futura
      const dataConsulta = new Date(data + 'T00:00:00');
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      if (dataConsulta < hoje) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data deve ser hoje ou futura' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar configuração de agenda
      let agenda: any = null;
      if (agendaId) {
        const { data: agendaData } = await supabase
          .from('agendas')
          .select('*')
          .eq('id', agendaId)
          .eq('company_id', companyId)
          .single();
        agenda = agendaData;
      } else {
        // Buscar agenda padrão
        const { data: agendaData } = await supabase
          .from('agendas')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'ativa')
          .limit(1)
          .single();
        agenda = agendaData;
      }

      // Horários base (pode ser configurável pela agenda)
      const horariosBase = agenda?.disponibilidade?.horarios || [
        '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
      ];

      const capacidadeMaxima = agenda?.permite_simultaneo ? (agenda?.capacidade_simultanea || 1) : 1;

      // Buscar compromissos do dia
      const dataInicio = `${data}T00:00:00`;
      const dataFim = `${data}T23:59:59`;

      let query = supabase
        .from('compromissos')
        .select('data_hora_inicio, data_hora_fim')
        .eq('company_id', companyId)
        .gte('data_hora_inicio', dataInicio)
        .lte('data_hora_inicio', dataFim)
        .neq('status', 'cancelado');

      if (profissionalId) {
        query = query.eq('profissional_id', profissionalId);
      }
      if (agendaId) {
        query = query.eq('agenda_id', agendaId);
      }

      const { data: compromissos, error } = await query;

      if (error) {
        console.error('[api-public-agenda] Erro ao buscar compromissos:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao verificar horários' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Contar compromissos por horário
      const contadorPorHorario: Record<string, number> = {};
      (compromissos || []).forEach((c: any) => {
        const hora = new Date(c.data_hora_inicio).toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo'
        });
        contadorPorHorario[hora] = (contadorPorHorario[hora] || 0) + 1;
      });

      // Se for hoje, filtrar horários passados
      const agora = new Date();
      const ehHoje = dataConsulta.toDateString() === agora.toDateString();

      const horariosDisponiveis: HorarioDisponivel[] = horariosBase.map((horario: string) => {
        const ocupados = contadorPorHorario[horario] || 0;
        const vagasRestantes = capacidadeMaxima - ocupados;
        
        // Verificar se horário já passou (se for hoje)
        let passado = false;
        if (ehHoje) {
          const [h, m] = horario.split(':').map(Number);
          const horarioDate = new Date();
          horarioDate.setHours(h, m, 0, 0);
          passado = horarioDate <= agora;
        }

        return {
          horario,
          disponivel: vagasRestantes > 0 && !passado,
          vagas_restantes: vagasRestantes > 0 ? vagasRestantes : 0
        };
      });

      return new Response(
        JSON.stringify({
          success: true,
          data,
          horarios: horariosDisponiveis,
          agenda_nome: agenda?.nome || 'Agenda',
          tempo_servico: agenda?.tempo_medio_servico || 30,
          permite_simultaneo: agenda?.permite_simultaneo || false,
          capacidade: capacidadeMaxima
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // POST: Criar agendamento
    // ============================================
    if (req.method === 'POST' && action === 'agendar') {
      const body: CompromissoInput = await req.json();

      // Validações
      if (!body.nome || body.nome.trim().length < 2) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nome é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.telefone) {
        return new Response(
          JSON.stringify({ success: false, error: 'Telefone é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.data || !body.horario) {
        return new Response(
          JSON.stringify({ success: false, error: 'Data e horário são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!body.tipo_servico) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tipo de serviço é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Montar data/hora
      const dataHoraInicio = new Date(`${body.data}T${body.horario}:00`);
      
      // Buscar tempo de serviço da agenda
      let tempoServico = 30; // padrão
      if (body.agenda_id) {
        const { data: agenda } = await supabase
          .from('agendas')
          .select('tempo_medio_servico')
          .eq('id', body.agenda_id)
          .single();
        if (agenda?.tempo_medio_servico) {
          tempoServico = agenda.tempo_medio_servico;
        }
      }

      const dataHoraFim = new Date(dataHoraInicio.getTime() + tempoServico * 60 * 1000);

      // Verificar conflito
      const { data: conflitos } = await supabase
        .from('compromissos')
        .select('id')
        .eq('company_id', companyId)
        .gte('data_hora_inicio', dataHoraInicio.toISOString())
        .lt('data_hora_inicio', dataHoraFim.toISOString())
        .neq('status', 'cancelado');

      // Buscar agenda para verificar capacidade
      let capacidadeMaxima = 1;
      if (body.agenda_id) {
        const { data: agenda } = await supabase
          .from('agendas')
          .select('permite_simultaneo, capacidade_simultanea')
          .eq('id', body.agenda_id)
          .single();
        if (agenda?.permite_simultaneo) {
          capacidadeMaxima = agenda.capacidade_simultanea || 1;
        }
      }

      if (conflitos && conflitos.length >= capacidadeMaxima) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Este horário não está mais disponível. Por favor, escolha outro horário.' 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalizar telefone
      const telefoneNormalizado = body.telefone.replace(/\D/g, '');

      // Criar ou buscar lead
      let leadId: string | null = null;

      // Verificar se já existe lead com este telefone
      const { data: leadExistente } = await supabase
        .from('leads')
        .select('id')
        .eq('company_id', companyId)
        .or(`telefone.eq.${telefoneNormalizado},phone.eq.${telefoneNormalizado}`)
        .limit(1)
        .single();

      if (leadExistente) {
        leadId = leadExistente.id;
      } else {
        // Criar novo lead
        const { data: novoLead, error: leadError } = await supabase
          .from('leads')
          .insert({
            name: body.nome.trim(),
            telefone: telefoneNormalizado,
            phone: telefoneNormalizado,
            email: body.email?.toLowerCase().trim() || null,
            company_id: companyId,
            owner_id: ownerId,
            source: 'auto-agendamento',
            status: 'novo',
            tags: ['auto-agendamento', 'site-institucional'],
            notes: `Lead criado via auto-agendamento em ${new Date().toLocaleString('pt-BR')}`
          })
          .select('id')
          .single();

        if (!leadError && novoLead) {
          leadId = novoLead.id;
        }
      }

      // Criar compromisso
      const { data: compromisso, error: compError } = await supabase
        .from('compromissos')
        .insert({
          titulo: `${body.tipo_servico} - ${body.nome}`,
          tipo_servico: body.tipo_servico,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          status: 'agendado',
          paciente: body.nome.trim(),
          telefone: telefoneNormalizado,
          observacoes: body.observacoes || `Agendamento via site - ${body.email || 'Sem email'}`,
          lead_id: leadId,
          agenda_id: body.agenda_id || null,
          profissional_id: body.profissional_id || null,
          company_id: companyId,
          owner_id: ownerId,
          usuario_responsavel_id: ownerId
        })
        .select('id, data_hora_inicio, data_hora_fim, tipo_servico')
        .single();

      if (compError) {
        console.error('[api-public-agenda] Erro ao criar compromisso:', compError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar agendamento' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[api-public-agenda] Compromisso criado:', compromisso.id);

      // Tentar enviar confirmação via WhatsApp
      try {
        const dataFormatada = dataHoraInicio.toLocaleDateString('pt-BR');
        const horaFormatada = dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const mensagemConfirmacao = `✅ *Agendamento Confirmado!*\n\n` +
          `Olá ${body.nome}!\n\n` +
          `📅 *Data:* ${dataFormatada}\n` +
          `⏰ *Horário:* ${horaFormatada}\n` +
          `📋 *Serviço:* ${body.tipo_servico}\n\n` +
          `Aguardamos você! 😊`;

        await supabase.functions.invoke('enviar-whatsapp', {
          body: {
            telefone: telefoneNormalizado,
            mensagem: mensagemConfirmacao,
            company_id: companyId
          }
        });
      } catch (e) {
        console.warn('[api-public-agenda] Erro ao enviar confirmação WhatsApp:', e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Agendamento realizado com sucesso!',
          compromisso: {
            id: compromisso.id,
            data: body.data,
            horario: body.horario,
            tipo_servico: compromisso.tipo_servico,
            data_hora_formatada: `${dataHoraInicio.toLocaleDateString('pt-BR')} às ${dataHoraInicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // GET: Status da API
    // ============================================
    if (req.method === 'GET' && action === 'status') {
      return new Response(
        JSON.stringify({
          success: true,
          status: 'online',
          version: '1.0.0',
          endpoints: {
            agendas: 'GET /?action=agendas&company=SLUG',
            horarios: 'GET /?action=horarios&data=YYYY-MM-DD&company=SLUG',
            agendar: 'POST /?action=agendar',
            status: 'GET /?action=status'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rota não encontrada
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Rota não encontrada',
        available_actions: ['agendas', 'horarios', 'agendar', 'status']
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[api-public-agenda] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
