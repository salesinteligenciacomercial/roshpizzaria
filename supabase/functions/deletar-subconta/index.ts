import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeletarSubcontaRequest {
  subcontaId: string;
}

// Função para deletar em lotes menores para evitar timeout
async function deletarEmLotes(
  supabaseAdmin: any,
  tabela: string,
  companyId: string,
  batchSize: number = 100
): Promise<number> {
  let totalDeletados = 0;
  let tentativas = 0;
  const maxTentativas = 50; // Máximo de iterações para evitar loop infinito

  while (tentativas < maxTentativas) {
    tentativas++;
    
    try {
      // Deletar diretamente com limit para evitar timeout no SELECT
      const { error: deleteError, count } = await supabaseAdmin
        .from(tabela)
        .delete({ count: 'exact' })
        .eq('company_id', companyId)
        .limit(batchSize);

      if (deleteError) {
        // Se timeout, tentar com batch menor
        if (deleteError.code === '57014') {
          console.log(`⏱️ Timeout em ${tabela}, tentando batch menor...`);
          batchSize = Math.max(10, Math.floor(batchSize / 2));
          continue;
        }
        console.error(`❌ Erro ao deletar ${tabela}:`, deleteError);
        break;
      }

      const deletados = count || 0;
      if (deletados === 0) {
        // Não há mais registros
        break;
      }

      totalDeletados += deletados;
      console.log(`✅ ${tabela}: ${deletados} registros deletados (total: ${totalDeletados})`);
      
    } catch (err) {
      console.error(`❌ Exceção ao deletar ${tabela}:`, err);
      break;
    }
  }

  return totalDeletados;
}

// Função alternativa para deletar usando RPC (mais rápido para tabelas grandes)
async function deletarConversasRapido(
  supabaseAdmin: any,
  companyId: string
): Promise<number> {
  let totalDeletados = 0;
  let continuar = true;
  let batchSize = 50;
  
  while (continuar) {
    try {
      // Deletar diretamente sem SELECT prévio
      const { count, error } = await supabaseAdmin
        .from('conversas')
        .delete({ count: 'exact' })
        .eq('company_id', companyId)
        .limit(batchSize);
      
      if (error) {
        if (error.code === '57014') {
          // Timeout - reduzir batch
          batchSize = Math.max(10, Math.floor(batchSize / 2));
          console.log(`⏱️ Timeout em conversas, reduzindo batch para ${batchSize}`);
          continue;
        }
        console.error('❌ Erro ao deletar conversas:', error);
        break;
      }
      
      const deletados = count || 0;
      totalDeletados += deletados;
      
      if (deletados > 0) {
        console.log(`✅ conversas: ${deletados} deletadas (total: ${totalDeletados})`);
      }
      
      if (deletados < batchSize) {
        continuar = false;
      }
      
    } catch (err) {
      console.error('❌ Exceção ao deletar conversas:', err);
      break;
    }
  }
  
  return totalDeletados;
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

    let deletedRecords = 0;

    // IMPORTANTE: Deletar conversas primeiro (tabela com mais registros)
    console.log('📨 Deletando conversas em lotes pequenos...');
    const conversasDeletadas = await deletarConversasRapido(supabaseAdmin, subcontaId);
    deletedRecords += conversasDeletadas;
    console.log(`✅ Total de conversas deletadas: ${conversasDeletadas}`);

    // Lista de tabelas para deletar (ordem de dependências)
    const tabelasParaDeletar = [
      'scheduled_whatsapp_messages',
      'lembretes',
      'compromissos',
      'tasks',
      'leads',
      'agendas',
      'automation_flow_logs',
      'automation_flows',
      'etapas',
      'funis',
      'task_columns',
      'task_boards',
      'quick_messages',
      'quick_message_categories',
      'ia_training_data',
      'ia_recommendations',
      'ia_patterns',
      'ia_metrics',
      'ia_configurations',
      'whatsapp_connections',
      'conversation_assignments',
      'blocked_groups',
    ];

    // Deletar dados de cada tabela
    for (const tabela of tabelasParaDeletar) {
      const { error, count } = await supabaseAdmin
        .from(tabela)
        .delete()
        .eq('company_id', subcontaId);

      if (error) {
        console.error(`⚠️ Erro ao deletar ${tabela}:`, error.message);
      } else if (count && count > 0) {
        deletedRecords += count;
        console.log(`✅ ${tabela}: ${count} registros deletados`);
      }
    }

    // Deletar user_roles da subconta
    const { error: rolesError, count: rolesCount } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('company_id', subcontaId);

    if (rolesError) {
      console.error('⚠️ Erro ao deletar user_roles:', rolesError);
    } else if (rolesCount) {
      deletedRecords += rolesCount;
      console.log(`✅ user_roles: ${rolesCount} registros deletados`);
    }

    // Agora deletar a empresa (após todas as dependências terem sido removidas)
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
