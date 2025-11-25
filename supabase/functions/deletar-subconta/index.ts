import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeletarSubcontaRequest {
  subcontaId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase com service role para ter permissões totais
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    // Verificar se o usuário tem permissão (é admin da parent company)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Parsear request
    const { subcontaId }: DeletarSubcontaRequest = await req.json();

    if (!subcontaId) {
      throw new Error('ID da subconta é obrigatório');
    }

    console.log(`🗑️ Iniciando deleção da subconta ${subcontaId}`);

    // Verificar se a subconta existe e se o usuário tem permissão
    const { data: subconta, error: subcontaError } = await supabaseAdmin
      .from('companies')
      .select('id, name, parent_company_id')
      .eq('id', subcontaId)
      .single();

    if (subcontaError || !subconta) {
      throw new Error('Subconta não encontrada');
    }

    // Verificar se usuário pertence à parent company
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('company_id', subconta.parent_company_id)
      .single();

    if (roleError || !userRole) {
      throw new Error('Você não tem permissão para deletar esta subconta');
    }

    // Verificar se é admin ou super_admin
    if (!['company_admin', 'super_admin'].includes(userRole.role)) {
      throw new Error('Apenas administradores podem deletar subcontas');
    }

    // Contar registros associados
    const [leadsCount, tasksCount, conversasCount, compromissosCount] = await Promise.all([
      supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', subcontaId),
      supabaseAdmin.from('tasks').select('id', { count: 'exact', head: true }).eq('company_id', subcontaId),
      supabaseAdmin.from('conversas').select('id', { count: 'exact', head: true }).eq('company_id', subcontaId),
      supabaseAdmin.from('compromissos').select('id', { count: 'exact', head: true }).eq('company_id', subcontaId),
    ]);

    const totalRecords = (leadsCount.count || 0) + (tasksCount.count || 0) + (conversasCount.count || 0) + (compromissosCount.count || 0);

    console.log(`📊 Total de registros a deletar: ${totalRecords}`);

    // Deletar em ordem (dependências primeiro)
    const deletionSteps = [
      { name: 'conversas', count: conversasCount.count || 0 },
      { name: 'scheduled_whatsapp_messages', count: 0 },
      { name: 'lembretes', count: 0 },
      { name: 'compromissos', count: compromissosCount.count || 0 },
      { name: 'tasks', count: tasksCount.count || 0 },
      { name: 'leads', count: leadsCount.count || 0 },
      { name: 'agendas', count: 0 },
      { name: 'automation_flow_logs', count: 0 },
      { name: 'automation_flows', count: 0 },
      { name: 'etapas', count: 0 },
      { name: 'funis', count: 0 },
      { name: 'task_columns', count: 0 },
      { name: 'task_boards', count: 0 },
      { name: 'quick_messages', count: 0 },
      { name: 'quick_message_categories', count: 0 },
      { name: 'ia_training_data', count: 0 },
      { name: 'ia_recommendations', count: 0 },
      { name: 'ia_patterns', count: 0 },
      { name: 'ia_metrics', count: 0 },
      { name: 'ia_configurations', count: 0 },
      { name: 'whatsapp_connections', count: 0 },
      { name: 'conversation_assignments', count: 0 },
      { name: 'blocked_groups', count: 0 },
    ];

    let deletedRecords = 0;

    // Deletar dados de cada tabela
    for (const step of deletionSteps) {
      const { error, count } = await supabaseAdmin
        .from(step.name)
        .delete()
        .eq('company_id', subcontaId);

      if (error) {
        console.error(`❌ Erro ao deletar ${step.name}:`, error);
      } else {
        deletedRecords += count || 0;
        if (count && count > 0) {
          console.log(`✅ ${step.name}: ${count} registros deletados`);
        }
      }
    }

    // Deletar user_roles da subconta
    const { error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('company_id', subcontaId);

    if (rolesError) {
      console.error('⚠️ Erro ao deletar user_roles:', rolesError);
    }

    // Deletar a empresa
    const { error: companyError } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', subcontaId);

    if (companyError) {
      throw new Error(`Erro ao deletar subconta: ${companyError.message}`);
    }

    console.log(`✅ Subconta ${subconta.name} deletada com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subconta deletada com sucesso',
        deletedRecords,
        subcontaName: subconta.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao deletar subconta:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Erro ao deletar subconta',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
