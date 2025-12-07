import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Compromisso {
  id: string
  titulo?: string
  tipo_servico: string
  data_hora_inicio: string
  data_hora_fim: string
  status: string
  observacoes?: string
  paciente?: string
  telefone?: string
  profissional_id: string
  lead_id?: string
  agenda_id?: string
  company_id: string
}

interface Lembrete {
  id: string
  compromisso_id: string
  canal: string
  status_envio: string
  mensagem?: string
  horas_antecedencia: number
  data_envio?: string
  proxima_data_envio?: string
  recorrencia?: string
  ativo: boolean
}

interface Tarefa {
  id: string
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string
  start_date?: string
  assignee_id?: string
  responsaveis?: string[]
  lead_id?: string
  compromisso_id?: string
  professional_id?: string
}

interface Lead {
  id: string
  name: string
  phone?: string
  telefone?: string
  email?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // Obter token do header Authorization
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Cliente com token do usuário para verificar autenticação
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      console.error('[api-waze-agenda] Erro de autenticação:', authError)
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[api-waze-agenda] Usuário autenticado:', user.id, user.email)

    // Cliente admin para operações
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Buscar profissional vinculado ao usuário
    const { data: profissional, error: profError } = await supabaseAdmin
      .from('profissionais')
      .select('id, nome, email, telefone, especialidade, company_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profError || !profissional) {
      console.error('[api-waze-agenda] Profissional não encontrado:', profError)
      return new Response(
        JSON.stringify({ error: 'Profissional não encontrado para este usuário' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[api-waze-agenda] Profissional encontrado:', profissional.id, profissional.nome)

    // Parse da URL para determinar a ação
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'dashboard'
    const method = req.method

    console.log('[api-waze-agenda] Ação:', action, 'Método:', method)

    // ============================================
    // ROTAS DA API
    // ============================================

    // GET: Dashboard - Retorna todos os dados do profissional
    if (action === 'dashboard' && method === 'GET') {
      const hoje = new Date()
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString()
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString()

      // Buscar compromissos do profissional (próximos 30 dias)
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() + 30)

      const { data: compromissos, error: compError } = await supabaseAdmin
        .from('compromissos')
        .select(`
          *,
          lead:leads(id, name, phone, telefone, email),
          agenda:agendas(id, nome, tipo)
        `)
        .eq('profissional_id', profissional.id)
        .gte('data_hora_inicio', inicioHoje)
        .lte('data_hora_inicio', dataLimite.toISOString())
        .order('data_hora_inicio', { ascending: true })

      if (compError) {
        console.error('[api-waze-agenda] Erro ao buscar compromissos:', compError)
      }

      // Buscar lembretes dos compromissos
      const compromissoIds = compromissos?.map(c => c.id) || []
      let lembretes: any[] = []
      if (compromissoIds.length > 0) {
        const { data: lembretesData, error: lembError } = await supabaseAdmin
          .from('lembretes')
          .select('*')
          .in('compromisso_id', compromissoIds)
          .eq('ativo', true)
          .order('proxima_data_envio', { ascending: true })

        if (!lembError) {
          lembretes = lembretesData || []
        }
      }

      // Buscar tarefas atribuídas ao profissional (pelo user_id ou professional_id)
      const { data: tarefas, error: tarefError } = await supabaseAdmin
        .from('tasks')
        .select(`
          *,
          lead:leads(id, name, phone, telefone),
          compromisso:compromissos(id, titulo, tipo_servico, data_hora_inicio)
        `)
        .or(`assignee_id.eq.${user.id},responsaveis.cs.{${user.id}},professional_id.eq.${profissional.id}`)
        .neq('status', 'concluida')
        .order('due_date', { ascending: true })
        .limit(50)

      if (tarefError) {
        console.error('[api-waze-agenda] Erro ao buscar tarefas:', tarefError)
      }

      // Estatísticas
      const compromissosHoje = compromissos?.filter(c => {
        const dataComp = new Date(c.data_hora_inicio)
        return dataComp >= new Date(inicioHoje) && dataComp <= new Date(fimHoje)
      }) || []

      const compromissosPendentes = compromissos?.filter(c => c.status === 'agendado' || c.status === 'confirmado') || []
      const tarefasPendentes = tarefas?.filter(t => t.status !== 'concluida') || []

      return new Response(
        JSON.stringify({
          success: true,
          profissional,
          data: {
            compromissos: compromissos || [],
            compromissosHoje,
            lembretes,
            tarefas: tarefas || [],
            estatisticas: {
              totalCompromissos: compromissos?.length || 0,
              compromissosHoje: compromissosHoje.length,
              compromissosPendentes: compromissosPendentes.length,
              tarefasPendentes: tarefasPendentes.length,
              lembretesPendentes: lembretes.filter(l => l.status_envio === 'pendente').length
            }
          },
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // LEADS - Buscar e criar contatos
    // ============================================

    // GET: Buscar leads
    if (action === 'leads' && method === 'GET') {
      const busca = url.searchParams.get('busca') || ''
      const limit = parseInt(url.searchParams.get('limit') || '20')

      let query = supabaseAdmin
        .from('leads')
        .select('id, name, phone, telefone, email')
        .eq('company_id', profissional.company_id)
        .order('name', { ascending: true })
        .limit(limit)

      if (busca) {
        query = query.or(`name.ilike.%${busca}%,telefone.ilike.%${busca}%,phone.ilike.%${busca}%,email.ilike.%${busca}%`)
      }

      const { data: leads, error } = await query

      if (error) {
        console.error('[api-waze-agenda] Erro ao buscar leads:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar leads' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Formatar resposta para compatibilidade com App
      const leadsFormatados = leads?.map(l => ({
        id: l.id,
        nome: l.name,
        telefone: l.telefone || l.phone,
        email: l.email
      })) || []

      console.log('[api-waze-agenda] Leads encontrados:', leadsFormatados.length)

      return new Response(
        JSON.stringify({ success: true, leads: leadsFormatados }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST: Criar novo lead/contato
    if (action === 'leads' && method === 'POST') {
      const body = await req.json()
      const { nome, telefone, email } = body

      if (!nome) {
        return new Response(
          JSON.stringify({ error: 'Nome é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: novoLead, error } = await supabaseAdmin
        .from('leads')
        .insert({
          name: nome,
          telefone,
          phone: telefone,
          email,
          company_id: profissional.company_id,
          owner_id: user.id,
          source: 'waze-agenda',
          status: 'novo'
        })
        .select()
        .single()

      if (error) {
        console.error('[api-waze-agenda] Erro ao criar lead:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar lead' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Lead criado:', novoLead.id)

      return new Response(
        JSON.stringify({
          success: true,
          lead: {
            id: novoLead.id,
            nome: novoLead.name,
            telefone: novoLead.telefone || novoLead.phone,
            email: novoLead.email
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // COMPROMISSOS
    // ============================================

    // GET: Compromissos
    if (action === 'compromissos' && method === 'GET') {
      const dataInicio = url.searchParams.get('data_inicio')
      const dataFim = url.searchParams.get('data_fim')
      const status = url.searchParams.get('status')

      let query = supabaseAdmin
        .from('compromissos')
        .select(`
          *,
          lead:leads(id, name, phone, telefone, email),
          agenda:agendas(id, nome, tipo)
        `)
        .eq('profissional_id', profissional.id)
        .order('data_hora_inicio', { ascending: true })

      if (dataInicio) {
        query = query.gte('data_hora_inicio', dataInicio)
      }
      if (dataFim) {
        query = query.lte('data_hora_inicio', dataFim)
      }
      if (status) {
        query = query.eq('status', status)
      }

      const { data: compromissos, error } = await query

      if (error) {
        console.error('[api-waze-agenda] Erro ao buscar compromissos:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar compromissos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, compromissos }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST: Criar compromisso
    if (action === 'compromissos' && method === 'POST') {
      const body = await req.json()
      const { titulo, tipo_servico, data_hora_inicio, data_hora_fim, status, observacoes, paciente, telefone, lead_id, agenda_id } = body

      if (!tipo_servico || !data_hora_inicio || !data_hora_fim) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios: tipo_servico, data_hora_inicio, data_hora_fim' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: novoCompromisso, error } = await supabaseAdmin
        .from('compromissos')
        .insert({
          titulo,
          tipo_servico,
          data_hora_inicio,
          data_hora_fim,
          status: status || 'agendado',
          observacoes,
          paciente,
          telefone,
          lead_id,
          agenda_id,
          profissional_id: profissional.id,
          company_id: profissional.company_id,
          owner_id: user.id,
          usuario_responsavel_id: user.id
        })
        .select()
        .single()

      if (error) {
        console.error('[api-waze-agenda] Erro ao criar compromisso:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar compromisso' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Compromisso criado:', novoCompromisso.id)

      return new Response(
        JSON.stringify({ success: true, compromisso: novoCompromisso }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT: Atualizar compromisso
    if (action === 'compromissos' && method === 'PUT') {
      const body = await req.json()
      const { id, ...updates } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID do compromisso é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar se compromisso pertence ao profissional
      const { data: existente } = await supabaseAdmin
        .from('compromissos')
        .select('id')
        .eq('id', id)
        .eq('profissional_id', profissional.id)
        .single()

      if (!existente) {
        return new Response(
          JSON.stringify({ error: 'Compromisso não encontrado ou sem permissão' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: compromissoAtualizado, error } = await supabaseAdmin
        .from('compromissos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('[api-waze-agenda] Erro ao atualizar compromisso:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar compromisso' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Compromisso atualizado:', id)

      return new Response(
        JSON.stringify({ success: true, compromisso: compromissoAtualizado }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE: Deletar/Cancelar compromisso
    if (action === 'compromissos' && method === 'DELETE') {
      const id = url.searchParams.get('id')

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID do compromisso é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar permissão
      const { data: existente } = await supabaseAdmin
        .from('compromissos')
        .select('id')
        .eq('id', id)
        .eq('profissional_id', profissional.id)
        .single()

      if (!existente) {
        return new Response(
          JSON.stringify({ error: 'Compromisso não encontrado ou sem permissão' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Cancelar ao invés de deletar (soft delete)
      const { error } = await supabaseAdmin
        .from('compromissos')
        .update({ status: 'cancelado', updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) {
        console.error('[api-waze-agenda] Erro ao cancelar compromisso:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao cancelar compromisso' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Compromisso cancelado:', id)

      return new Response(
        JSON.stringify({ success: true, message: 'Compromisso cancelado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // TAREFAS - CRUD completo
    // ============================================

    // GET: Tarefas
    if (action === 'tarefas' && method === 'GET') {
      const status = url.searchParams.get('status')
      const compromisso_id = url.searchParams.get('compromisso_id')

      let query = supabaseAdmin
        .from('tasks')
        .select(`
          *,
          lead:leads(id, name, phone, telefone),
          compromisso:compromissos(id, titulo, tipo_servico, data_hora_inicio)
        `)
        .or(`assignee_id.eq.${user.id},responsaveis.cs.{${user.id}},professional_id.eq.${profissional.id}`)
        .order('due_date', { ascending: true })

      if (status) {
        query = query.eq('status', status)
      }

      if (compromisso_id) {
        query = query.eq('compromisso_id', compromisso_id)
      }

      const { data: tarefas, error } = await query

      if (error) {
        console.error('[api-waze-agenda] Erro ao buscar tarefas:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar tarefas' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Formatar para compatibilidade com App
      const tarefasFormatadas = tarefas?.map(t => ({
        ...t,
        titulo: t.title,
        descricao: t.description,
        prioridade: t.priority,
        data_vencimento: t.due_date
      })) || []

      return new Response(
        JSON.stringify({ success: true, tarefas: tarefasFormatadas }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // POST: Criar tarefa
    if (action === 'tarefas' && method === 'POST') {
      const body = await req.json()
      const { titulo, descricao, prioridade, data_vencimento, compromisso_id, lead_id } = body

      if (!titulo) {
        return new Response(
          JSON.stringify({ error: 'Título é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Mapear prioridade do App para o padrão do CRM
      const priorityMap: Record<string, string> = {
        'baixa': 'baixa',
        'normal': 'media',
        'alta': 'alta',
        'urgente': 'urgente'
      }

      const { data: novaTarefa, error } = await supabaseAdmin
        .from('tasks')
        .insert({
          title: titulo,
          description: descricao,
          priority: priorityMap[prioridade] || 'media',
          due_date: data_vencimento,
          compromisso_id,
          lead_id,
          professional_id: profissional.id,
          company_id: profissional.company_id,
          owner_id: user.id,
          assignee_id: user.id,
          status: 'pendente'
        })
        .select()
        .single()

      if (error) {
        console.error('[api-waze-agenda] Erro ao criar tarefa:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao criar tarefa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Tarefa criada:', novaTarefa.id)

      return new Response(
        JSON.stringify({
          success: true,
          tarefa: {
            ...novaTarefa,
            titulo: novaTarefa.title,
            descricao: novaTarefa.description,
            prioridade: novaTarefa.priority,
            data_vencimento: novaTarefa.due_date
          }
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT: Atualizar tarefa
    if (action === 'tarefas' && method === 'PUT') {
      const body = await req.json()
      const { id, status, titulo, descricao, prioridade, data_vencimento, ...updates } = body

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID da tarefa é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar permissão
      const { data: existente } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('id', id)
        .or(`assignee_id.eq.${user.id},responsaveis.cs.{${user.id}},professional_id.eq.${profissional.id}`)
        .single()

      if (!existente) {
        return new Response(
          JSON.stringify({ error: 'Tarefa não encontrada ou sem permissão' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Preparar updates com campos traduzidos
      const updateData: Record<string, any> = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      if (status) updateData.status = status
      if (titulo) updateData.title = titulo
      if (descricao !== undefined) updateData.description = descricao
      if (prioridade) updateData.priority = prioridade
      if (data_vencimento !== undefined) updateData.due_date = data_vencimento

      const { data: tarefaAtualizada, error } = await supabaseAdmin
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('[api-waze-agenda] Erro ao atualizar tarefa:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar tarefa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Tarefa atualizada:', id)

      return new Response(
        JSON.stringify({
          success: true,
          tarefa: {
            ...tarefaAtualizada,
            titulo: tarefaAtualizada.title,
            descricao: tarefaAtualizada.description,
            prioridade: tarefaAtualizada.priority,
            data_vencimento: tarefaAtualizada.due_date
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DELETE: Excluir tarefa
    if (action === 'tarefas' && method === 'DELETE') {
      const id = url.searchParams.get('id')

      if (!id) {
        return new Response(
          JSON.stringify({ error: 'ID da tarefa é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verificar permissão
      const { data: existente } = await supabaseAdmin
        .from('tasks')
        .select('id')
        .eq('id', id)
        .or(`assignee_id.eq.${user.id},responsaveis.cs.{${user.id}},professional_id.eq.${profissional.id}`)
        .single()

      if (!existente) {
        return new Response(
          JSON.stringify({ error: 'Tarefa não encontrada ou sem permissão' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error } = await supabaseAdmin
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[api-waze-agenda] Erro ao excluir tarefa:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao excluir tarefa' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Tarefa excluída:', id)

      return new Response(
        JSON.stringify({ success: true, message: 'Tarefa excluída' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // LEMBRETES
    // ============================================

    // GET: Lembretes
    if (action === 'lembretes' && method === 'GET') {
      // Buscar compromissos do profissional primeiro
      const { data: compromissos } = await supabaseAdmin
        .from('compromissos')
        .select('id')
        .eq('profissional_id', profissional.id)

      const compromissoIds = compromissos?.map(c => c.id) || []

      if (compromissoIds.length === 0) {
        return new Response(
          JSON.stringify({ success: true, lembretes: [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: lembretes, error } = await supabaseAdmin
        .from('lembretes')
        .select(`
          *,
          compromisso:compromissos(id, titulo, tipo_servico, data_hora_inicio, paciente, telefone)
        `)
        .in('compromisso_id', compromissoIds)
        .order('proxima_data_envio', { ascending: true })

      if (error) {
        console.error('[api-waze-agenda] Erro ao buscar lembretes:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar lembretes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, lembretes }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ============================================
    // PERFIL
    // ============================================

    // GET: Perfil do profissional
    if (action === 'perfil' && method === 'GET') {
      return new Response(
        JSON.stringify({ success: true, profissional }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PUT: Atualizar perfil
    if (action === 'perfil' && method === 'PUT') {
      const body = await req.json()
      const { nome, telefone, especialidade } = body

      const { data: profissionalAtualizado, error } = await supabaseAdmin
        .from('profissionais')
        .update({ nome, telefone, especialidade, updated_at: new Date().toISOString() })
        .eq('id', profissional.id)
        .select()
        .single()

      if (error) {
        console.error('[api-waze-agenda] Erro ao atualizar perfil:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar perfil' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('[api-waze-agenda] Perfil atualizado:', profissional.id)

      return new Response(
        JSON.stringify({ success: true, profissional: profissionalAtualizado }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ação não reconhecida
    return new Response(
      JSON.stringify({ error: `Ação não reconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[api-waze-agenda] Erro:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
