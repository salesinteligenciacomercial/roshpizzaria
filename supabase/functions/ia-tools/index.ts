import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========================
// FERRAMENTAS DE CRM PARA IAS
// ========================

interface CRMTools {
  // Gestão de Leads/Funil
  mover_lead_funil: (params: { lead_id: string; etapa_id?: string; funil_id?: string }) => Promise<any>;
  adicionar_info_lead: (params: { lead_id: string; dados: any }) => Promise<any>;
  adicionar_tags_lead: (params: { lead_id: string; tags: string[] }) => Promise<any>;
  buscar_lead: (params: { lead_id?: string; telefone?: string; nome?: string }) => Promise<any>;
  qualificar_lead: (params: { lead_id: string; qualificacao: any }) => Promise<any>;
  
  // Gestão de Tarefas
  criar_tarefa: (params: { titulo: string; lead_id?: string; descricao?: string; prioridade?: string; data_limite?: string; company_id: string; owner_id: string }) => Promise<any>;
  listar_tarefas_lead: (params: { lead_id: string }) => Promise<any>;
  atualizar_tarefa: (params: { tarefa_id: string; dados: any }) => Promise<any>;
  
  // Gestão de Funil
  listar_funis: (params: { company_id: string }) => Promise<any>;
  listar_etapas_funil: (params: { funil_id: string }) => Promise<any>;
  
  // Mensagens
  enviar_mensagem_whatsapp: (params: { numero: string; mensagem: string; company_id: string }) => Promise<any>;
}

async function createCRMTools(supabase: any): Promise<CRMTools> {
  return {
    // ========================
    // GESTÃO DE LEADS/FUNIL
    // ========================
    
    // Mover lead para outra etapa/funil
    mover_lead_funil: async ({ lead_id, etapa_id, funil_id }) => {
      console.log('📋 [TOOL] Movendo lead no funil:', { lead_id, etapa_id, funil_id });
      
      const updateData: any = { updated_at: new Date().toISOString() };
      if (etapa_id) updateData.etapa_id = etapa_id;
      if (funil_id) updateData.funil_id = funil_id;
      
      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead_id)
        .select('id, name, etapa_id, funil_id')
        .single();
      
      if (error) {
        console.error('Erro ao mover lead:', error);
        return { success: false, error: 'Erro ao mover lead no funil' };
      }
      
      return {
        success: true,
        lead: data,
        mensagem: 'Lead movido com sucesso no funil'
      };
    },
    
    // Adicionar informações ao lead (CPF, valor, etc)
    adicionar_info_lead: async ({ lead_id, dados }) => {
      console.log('📝 [TOOL] Adicionando info ao lead:', { lead_id, dados });
      
      const updateData: any = { updated_at: new Date().toISOString() };
      
      // Mapear campos permitidos
      if (dados.cpf) updateData.cpf = dados.cpf;
      if (dados.valor || dados.value) updateData.value = dados.valor || dados.value;
      if (dados.email) updateData.email = dados.email;
      if (dados.empresa || dados.company) updateData.company = dados.empresa || dados.company;
      if (dados.telefone || dados.phone) {
        updateData.telefone = dados.telefone || dados.phone;
        updateData.phone = dados.telefone || dados.phone;
      }
      if (dados.observacoes || dados.notes) updateData.notes = dados.observacoes || dados.notes;
      if (dados.servico) updateData.servico = dados.servico;
      if (dados.segmentacao) updateData.segmentacao = dados.segmentacao;
      
      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead_id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao adicionar info:', error);
        return { success: false, error: 'Erro ao adicionar informações ao lead' };
      }
      
      return {
        success: true,
        lead: data,
        campos_atualizados: Object.keys(updateData).filter(k => k !== 'updated_at'),
        mensagem: 'Informações adicionadas ao lead'
      };
    },
    
    // Adicionar tags ao lead
    adicionar_tags_lead: async ({ lead_id, tags }) => {
      console.log('🏷️ [TOOL] Adicionando tags ao lead:', { lead_id, tags });
      
      // Buscar tags atuais
      const { data: leadAtual } = await supabase
        .from('leads')
        .select('tags')
        .eq('id', lead_id)
        .single();
      
      const tagsAtuais = leadAtual?.tags || [];
      const novasTags = [...new Set([...tagsAtuais, ...tags])]; // Merge sem duplicatas
      
      const { data, error } = await supabase
        .from('leads')
        .update({ 
          tags: novasTags,
          updated_at: new Date().toISOString()
        })
        .eq('id', lead_id)
        .select('id, name, tags')
        .single();
      
      if (error) {
        console.error('Erro ao adicionar tags:', error);
        return { success: false, error: 'Erro ao adicionar tags' };
      }
      
      return {
        success: true,
        lead: data,
        tags_adicionadas: tags,
        todas_tags: novasTags,
        mensagem: `Tags adicionadas: ${tags.join(', ')}`
      };
    },
    
    // Buscar lead por diferentes critérios
    buscar_lead: async ({ lead_id, telefone, nome }) => {
      console.log('🔍 [TOOL] Buscando lead:', { lead_id, telefone, nome });
      
      let query = supabase
        .from('leads')
        .select(`
          *,
          etapa:etapas(nome, cor),
          funil:funis(nome)
        `);
      
      if (lead_id) {
        query = query.eq('id', lead_id);
      } else if (telefone) {
        const tel = telefone.replace(/[^0-9]/g, '');
        query = query.or(`telefone.eq.${tel},phone.eq.${tel}`);
      } else if (nome) {
        query = query.ilike('name', `%${nome}%`);
      }
      
      const { data, error } = await query.limit(1).single();
      
      if (error) {
        console.error('Erro ao buscar lead:', error);
        return { encontrado: false, error: 'Lead não encontrado' };
      }
      
      return {
        encontrado: true,
        lead: data
      };
    },
    
    // Qualificar lead com dados estruturados
    qualificar_lead: async ({ lead_id, qualificacao }) => {
      console.log('✅ [TOOL] Qualificando lead:', { lead_id, qualificacao });
      
      const updateData: any = { 
        updated_at: new Date().toISOString(),
        status: 'qualificado'
      };
      
      // Adicionar dados de qualificação às notas
      const { data: leadAtual } = await supabase
        .from('leads')
        .select('notes')
        .eq('id', lead_id)
        .single();
      
      const notasAtuais = leadAtual?.notes || '';
      const qualificacaoTexto = `\n\n--- QUALIFICAÇÃO IA (${new Date().toLocaleString('pt-BR')}) ---\n${JSON.stringify(qualificacao, null, 2)}`;
      updateData.notes = notasAtuais + qualificacaoTexto;
      
      // Se tiver orçamento, atualizar valor
      if (qualificacao.orcamento || qualificacao.budget) {
        updateData.value = qualificacao.orcamento || qualificacao.budget;
      }
      
      // Se tiver serviço de interesse
      if (qualificacao.servico_interesse) {
        updateData.servico = qualificacao.servico_interesse;
      }
      
      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', lead_id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao qualificar lead:', error);
        return { success: false, error: 'Erro ao qualificar lead' };
      }
      
      return {
        success: true,
        lead: data,
        qualificacao,
        mensagem: 'Lead qualificado com sucesso'
      };
    },
    
    // ========================
    // GESTÃO DE TAREFAS
    // ========================
    
    // Criar nova tarefa
    criar_tarefa: async ({ titulo, lead_id, descricao, prioridade = 'media', data_limite, company_id, owner_id }) => {
      console.log('📋 [TOOL] Criando tarefa:', { titulo, lead_id, prioridade });
      
      const { data: tarefa, error } = await supabase
        .from('tasks')
        .insert({
          title: titulo,
          description: descricao,
          lead_id,
          priority: prioridade,
          due_date: data_limite,
          status: 'pendente',
          company_id,
          owner_id
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao criar tarefa:', error);
        return { success: false, error: 'Erro ao criar tarefa' };
      }
      
      return {
        success: true,
        tarefa_id: tarefa.id,
        tarefa,
        mensagem: `Tarefa "${titulo}" criada com sucesso`
      };
    },
    
    // Listar tarefas de um lead
    listar_tarefas_lead: async ({ lead_id }) => {
      console.log('📋 [TOOL] Listando tarefas do lead:', lead_id);
      
      const { data: tarefas, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', lead_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao listar tarefas:', error);
        return { error: 'Erro ao listar tarefas' };
      }
      
      const pendentes = (tarefas || []).filter((t: any) => t.status === 'pendente' || t.status === 'em_andamento');
      const concluidas = (tarefas || []).filter((t: any) => t.status === 'concluida');
      
      return {
        tarefas_pendentes: pendentes,
        tarefas_concluidas: concluidas,
        total: (tarefas || []).length
      };
    },
    
    // Atualizar tarefa
    atualizar_tarefa: async ({ tarefa_id, dados }) => {
      console.log('✏️ [TOOL] Atualizando tarefa:', { tarefa_id, dados });
      
      const updateData: any = { updated_at: new Date().toISOString() };
      
      if (dados.status) updateData.status = dados.status;
      if (dados.titulo || dados.title) updateData.title = dados.titulo || dados.title;
      if (dados.descricao || dados.description) updateData.description = dados.descricao || dados.description;
      if (dados.prioridade || dados.priority) updateData.priority = dados.prioridade || dados.priority;
      if (dados.data_limite || dados.due_date) updateData.due_date = dados.data_limite || dados.due_date;
      if (dados.checklist) updateData.checklist = dados.checklist;
      
      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', tarefa_id)
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao atualizar tarefa:', error);
        return { success: false, error: 'Erro ao atualizar tarefa' };
      }
      
      return {
        success: true,
        tarefa: data,
        mensagem: 'Tarefa atualizada com sucesso'
      };
    },
    
    // ========================
    // GESTÃO DE FUNIL
    // ========================
    
    // Listar funis da empresa
    listar_funis: async ({ company_id }) => {
      console.log('📊 [TOOL] Listando funis:', company_id);
      
      const { data: funis, error } = await supabase
        .from('funis')
        .select(`
          id,
          nome,
          descricao,
          etapas(id, nome, cor, posicao)
        `)
        .eq('company_id', company_id)
        .order('criado_em', { ascending: false });
      
      if (error) {
        console.error('Erro ao listar funis:', error);
        return { error: 'Erro ao listar funis' };
      }
      
      return {
        funis: funis || [],
        total: (funis || []).length
      };
    },
    
    // Listar etapas de um funil
    listar_etapas_funil: async ({ funil_id }) => {
      console.log('📊 [TOOL] Listando etapas do funil:', funil_id);
      
      const { data: etapas, error } = await supabase
        .from('etapas')
        .select('id, nome, cor, posicao')
        .eq('funil_id', funil_id)
        .order('posicao', { ascending: true });
      
      if (error) {
        console.error('Erro ao listar etapas:', error);
        return { error: 'Erro ao listar etapas' };
      }
      
      return {
        etapas: etapas || [],
        total: (etapas || []).length
      };
    },
    
    // ========================
    // MENSAGENS WHATSAPP
    // ========================
    
    // Enviar mensagem WhatsApp
    enviar_mensagem_whatsapp: async ({ numero, mensagem, company_id }) => {
      console.log('📤 [TOOL] Enviando mensagem WhatsApp:', { numero, mensagem: mensagem.substring(0, 50) });
      
      try {
        const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enviar-whatsapp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            numero,
            mensagem,
            tipo_mensagem: 'text',
            company_id
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          return { success: false, error: result.error || 'Erro ao enviar mensagem' };
        }
        
        return {
          success: true,
          mensagem: 'Mensagem enviada com sucesso'
        };
      } catch (error: any) {
        console.error('Erro ao enviar WhatsApp:', error);
        return { success: false, error: error.message };
      }
    }
  };
}

// ========================
// FUNÇÃO PRINCIPAL - EXECUTA FERRAMENTAS
// ========================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { tool, params } = await req.json();
    
    if (!tool) {
      return new Response(
        JSON.stringify({ error: 'Ferramenta não especificada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const tools = await createCRMTools(supabase);
    
    // Executar ferramenta
    let result;
    switch (tool) {
      // Leads
      case 'mover_lead_funil':
        result = await tools.mover_lead_funil(params);
        break;
      case 'adicionar_info_lead':
        result = await tools.adicionar_info_lead(params);
        break;
      case 'adicionar_tags_lead':
        result = await tools.adicionar_tags_lead(params);
        break;
      case 'buscar_lead':
        result = await tools.buscar_lead(params);
        break;
      case 'qualificar_lead':
        result = await tools.qualificar_lead(params);
        break;
      
      // Tarefas
      case 'criar_tarefa':
        result = await tools.criar_tarefa(params);
        break;
      case 'listar_tarefas_lead':
        result = await tools.listar_tarefas_lead(params);
        break;
      case 'atualizar_tarefa':
        result = await tools.atualizar_tarefa(params);
        break;
      
      // Funil
      case 'listar_funis':
        result = await tools.listar_funis(params);
        break;
      case 'listar_etapas_funil':
        result = await tools.listar_etapas_funil(params);
        break;
      
      // WhatsApp
      case 'enviar_mensagem_whatsapp':
        result = await tools.enviar_mensagem_whatsapp(params);
        break;
      
      default:
        result = { error: `Ferramenta "${tool}" não encontrada` };
    }
    
    console.log('🔧 [IA-TOOLS] Resultado:', { tool, result });
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro no ia-tools:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

