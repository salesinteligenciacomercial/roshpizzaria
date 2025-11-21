// ============================================
// 🔄 APLICAR ATUALIZAÇÕES EM SUBCONTAS
// ============================================
// Edge Function para aplicar melhorias e atualizações
// em todas as subcontas de uma conta matriz
// 
// ✅ SEGURANÇA: Apenas adiciona dados novos, NUNCA altera dados existentes
// ✅ VERSIONAMENTO: Rastreia quais atualizações já foram aplicadas
// ✅ SELETIVO: Aplica apenas atualizações pendentes

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AplicarAtualizacoesRequest {
  parentCompanyId: string;
  forceUpdate?: boolean; // Forçar atualização mesmo se já foi aplicada
  updateIds?: string[]; // IDs específicos de atualizações para aplicar (opcional)
}

// ============================================
// 📋 CONFIGURAÇÃO DE ATUALIZAÇÕES DISPONÍVEIS
// ============================================
// Adicione novas atualizações aqui quando implementar melhorias

interface UpdateDefinition {
  id: string;
  version: string;
  description: string;
  appliesTo: 'all' | 'new_only';
  safe: boolean; // true = não altera dados existentes
}

const AVAILABLE_UPDATES: UpdateDefinition[] = [
  {
    id: 'create-default-funil',
    version: '1.0.0',
    description: 'Cria funil padrão e etapas se não existirem',
    appliesTo: 'all',
    safe: true
  },
  {
    id: 'create-default-task-board',
    version: '1.0.0',
    description: 'Cria quadro de tarefas padrão se não existir',
    appliesTo: 'all',
    safe: true
  },
  {
    id: 'create-whatsapp-connection',
    version: '1.0.0',
    description: 'Cria registro de conexão WhatsApp se não existir',
    appliesTo: 'all',
    safe: true
  },
  {
    id: 'fix-conversas-company-id',
    version: '1.0.1',
    description: 'Corrige conversas sem company_id (apenas NULL)',
    appliesTo: 'all',
    safe: true
  }
];

const CURRENT_SYSTEM_VERSION = '1.0.1';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [APLICAR-ATUALIZACOES] Iniciando processamento...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: AplicarAtualizacoesRequest = await req.json();
    const { parentCompanyId, forceUpdate = false } = body;

    if (!parentCompanyId) {
      return new Response(
        JSON.stringify({ error: 'parentCompanyId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase Admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ [APLICAR-ATUALIZACOES] Variáveis de ambiente não configuradas');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor inválida' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se usuário é super_admin da conta matriz
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se é super_admin da conta matriz
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', user.id)
      .eq('company_id', parentCompanyId)
      .single();

    if (roleError || !userRole || userRole.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Apenas Super Admin da conta matriz pode aplicar atualizações' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se a empresa é realmente conta matriz
    const { data: parentCompany, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('id, name, is_master_account')
      .eq('id', parentCompanyId)
      .single();

    if (companyError || !parentCompany || !parentCompany.is_master_account) {
      return new Response(
        JSON.stringify({ error: 'Empresa não é conta matriz' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [APLICAR-ATUALIZACOES] Validações OK, buscando subcontas...');

    // Buscar todas as subcontas ativas
    const { data: subcontas, error: subcontasError } = await supabaseAdmin
      .from('companies')
      .select('id, name, status')
      .eq('parent_company_id', parentCompanyId)
      .eq('status', 'active');

    if (subcontasError) {
      console.error('❌ [APLICAR-ATUALIZACOES] Erro ao buscar subcontas:', subcontasError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar subcontas', details: subcontasError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subcontas || subcontas.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Nenhuma subconta encontrada',
          updated: 0,
          total: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 [APLICAR-ATUALIZACOES] Encontradas ${subcontas.length} subcontas`);

    const results = {
      total: subcontas.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
      details: [] as Array<{ 
        companyId: string; 
        companyName: string; 
        status: string; 
        message?: string;
        updatesApplied?: string[];
      }>
    };

    // Determinar quais atualizações aplicar
    const updatesToApply = body.updateIds 
      ? AVAILABLE_UPDATES.filter(u => body.updateIds!.includes(u.id))
      : AVAILABLE_UPDATES;

    console.log(`📋 [APLICAR-ATUALIZACOES] Aplicando ${updatesToApply.length} atualizações:`, 
      updatesToApply.map(u => u.id).join(', '));

    // Aplicar atualizações para cada subconta
    // ⚠️ IMPORTANTE: Cada subconta é processada INDIVIDUALMENTE e ISOLADAMENTE
    // NUNCA há mesclagem de dados entre subcontas ou com a conta matriz
    for (const subconta of subcontas) {
      try {
        console.log(`🔄 [APLICAR-ATUALIZACOES] Processando subconta: ${subconta.name} (${subconta.id})`);
        console.log(`🔒 [ISOLAMENTO] Processando ISOLADAMENTE - sem mesclagem de dados`);

        // Buscar configurações da empresa para verificar versões aplicadas
        // ⚠️ SEMPRE filtra pela subconta específica - NUNCA busca dados de outras contas
        const { data: companyData } = await supabaseAdmin
          .from('companies')
          .select('settings, created_at')
          .eq('id', subconta.id) // ← FILTRO OBRIGATÓRIO: apenas esta subconta
          .single();

        const currentSettings = companyData?.settings || {};
        const appliedVersions = currentSettings.applied_updates || [];
        const isNewCompany = new Date(companyData?.created_at || Date.now()).getTime() > 
          Date.now() - (7 * 24 * 60 * 60 * 1000); // Criada há menos de 7 dias

        // Filtrar atualizações pendentes
        const pendingUpdates = updatesToApply.filter(update => {
          // Se forceUpdate, aplicar todas
          if (forceUpdate) return true;
          
          // Se já foi aplicada, pular
          if (appliedVersions.includes(update.version)) {
            return false;
          }
          
          // Se é apenas para novas empresas e a empresa não é nova, pular
          if (update.appliesTo === 'new_only' && !isNewCompany) {
            return false;
          }
          
          return true;
        });

        if (pendingUpdates.length === 0) {
          console.log(`⏭️ [APLICAR-ATUALIZACOES] ${subconta.name} já está atualizada, pulando...`);
          results.skipped++;
          results.details.push({
            companyId: subconta.id,
            companyName: subconta.name,
            status: 'skipped',
            message: 'Já possui todas as atualizações aplicadas'
          });
          continue;
        }

        console.log(`📦 [APLICAR-ATUALIZACOES] Aplicando ${pendingUpdates.length} atualizações para ${subconta.name}`);

        const appliedUpdateIds: string[] = [];

        // Aplicar cada atualização pendente
        for (const update of pendingUpdates) {
          try {
            console.log(`  🔄 Aplicando: ${update.id} (${update.description})`);

            // ============================================
            // ATUALIZAÇÃO: create-default-funil
            // ============================================
            // ⚠️ SEGURANÇA: Sempre filtra por company_id da subconta específica
            // NUNCA altera dados existentes, apenas cria se não existir
            if (update.id === 'create-default-funil') {
              const { data: funisExistentes } = await supabaseAdmin
                .from('funis')
                .select('id')
                .eq('company_id', subconta.id) // ← FILTRO OBRIGATÓRIO: apenas esta subconta
                .limit(1);

              if (!funisExistentes || funisExistentes.length === 0) {
                const { data: novoFunil, error: funilError } = await supabaseAdmin
                  .from('funis')
                  .insert({
                    nome: 'Funil de Vendas',
                    descricao: 'Funil padrão do sistema',
                    company_id: subconta.id,
                    criado_em: new Date().toISOString()
                  })
                  .select('id')
                  .single();

                if (!funilError && novoFunil) {
                  await supabaseAdmin
                    .from('etapas')
                    .insert([
                      { funil_id: novoFunil.id, nome: 'Prospecção', posicao: 1, cor: '#3b82f6', company_id: subconta.id },
                      { funil_id: novoFunil.id, nome: 'Qualificação', posicao: 2, cor: '#eab308', company_id: subconta.id },
                      { funil_id: novoFunil.id, nome: 'Proposta', posicao: 3, cor: '#8b5cf6', company_id: subconta.id },
                      { funil_id: novoFunil.id, nome: 'Negociação', posicao: 4, cor: '#f59e0b', company_id: subconta.id },
                      { funil_id: novoFunil.id, nome: 'Fechamento', posicao: 5, cor: '#22c55e', company_id: subconta.id }
                    ]);
                  appliedUpdateIds.push(update.id);
                }
              }
            }

            // ============================================
            // ATUALIZAÇÃO: create-default-task-board
            // ============================================
            else if (update.id === 'create-default-task-board') {
              const { data: boardsExistentes } = await supabaseAdmin
                .from('task_boards')
                .select('id')
                .eq('company_id', subconta.id)
                .limit(1);

              if (!boardsExistentes || boardsExistentes.length === 0) {
                const { data: novoBoard, error: boardError } = await supabaseAdmin
                  .from('task_boards')
                  .insert({
                    nome: 'Quadro Principal',
                    descricao: 'Quadro padrão de tarefas',
                    company_id: subconta.id,
                    criado_em: new Date().toISOString()
                  })
                  .select('id')
                  .single();

                if (!boardError && novoBoard) {
                  await supabaseAdmin
                    .from('task_columns')
                    .insert([
                      { board_id: novoBoard.id, nome: 'A Fazer', posicao: 0, cor: '#3b82f6', company_id: subconta.id },
                      { board_id: novoBoard.id, nome: 'Em Progresso', posicao: 1, cor: '#eab308', company_id: subconta.id },
                      { board_id: novoBoard.id, nome: 'Concluído', posicao: 2, cor: '#22c55e', company_id: subconta.id }
                    ]);
                  appliedUpdateIds.push(update.id);
                }
              }
            }

            // ============================================
            // ATUALIZAÇÃO: create-whatsapp-connection
            // ============================================
            else if (update.id === 'create-whatsapp-connection') {
              const { data: conexaoExistente } = await supabaseAdmin
                .from('whatsapp_connections')
                .select('id')
                .eq('company_id', subconta.id)
                .limit(1);

              if (!conexaoExistente || conexaoExistente.length === 0) {
                await supabaseAdmin
                  .from('whatsapp_connections')
                  .insert({
                    company_id: subconta.id,
                    instance_name: 'INSTANCE_' + subconta.id.substring(0, 8).toUpperCase(),
                    status: 'disconnected',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  });
                appliedUpdateIds.push(update.id);
              }
            }

            // ============================================
            // ATUALIZAÇÃO: fix-conversas-company-id
            // ============================================
            else if (update.id === 'fix-conversas-company-id') {
              try {
                // Apenas corrige conversas com company_id NULL (não altera existentes)
                const { data: adminUser } = await supabaseAdmin
                  .from('user_roles')
                  .select('user_id')
                  .eq('company_id', subconta.id)
                  .eq('role', 'company_admin')
                  .limit(1)
                  .single();
                
                if (adminUser?.user_id) {
                  const { count } = await supabaseAdmin
                    .from('conversas')
                    .select('*', { count: 'exact', head: true })
                    .is('company_id', null)
                    .eq('owner_id', adminUser.user_id);
                  
                  if (count && count > 0) {
                    await supabaseAdmin
                      .from('conversas')
                      .update({ company_id: subconta.id })
                      .is('company_id', null)
                      .eq('owner_id', adminUser.user_id);
                    appliedUpdateIds.push(update.id);
                  }
                }
              } catch (conversasErr) {
                console.log(`⚠️ [APLICAR-ATUALIZACOES] Aviso ao corrigir conversas:`, conversasErr);
              }
            }

          } catch (updateError: any) {
            console.error(`❌ [APLICAR-ATUALIZACOES] Erro ao aplicar ${update.id}:`, updateError);
            // Continua com próxima atualização
          }
        }

        // Atualizar settings com versões aplicadas (MERGE, não sobrescreve)
        const newVersions = [...new Set([...appliedVersions, ...pendingUpdates.map(u => u.version)])];
        const updatedSettings = {
          ...currentSettings, // Preserva todas as configurações existentes
          applied_updates: newVersions,
          last_update_applied: new Date().toISOString(),
          system_version: CURRENT_SYSTEM_VERSION
        };

        await supabaseAdmin
          .from('companies')
          .update({ settings: updatedSettings })
          .eq('id', subconta.id);

        results.updated++;
        results.details.push({
          companyId: subconta.id,
          companyName: subconta.name,
          status: 'success',
          message: `${appliedUpdateIds.length} atualização(ões) aplicada(s)`,
          updatesApplied: appliedUpdateIds
        });

        console.log(`✅ [APLICAR-ATUALIZACOES] Subconta ${subconta.name} atualizada: ${appliedUpdateIds.join(', ')}`);

      } catch (error: any) {
        console.error(`❌ [APLICAR-ATUALIZACOES] Erro ao atualizar ${subconta.name}:`, error);
        results.errors.push(`${subconta.name}: ${error.message}`);
        results.details.push({
          companyId: subconta.id,
          companyName: subconta.name,
          status: 'error',
          message: error.message
        });
      }
    }

    console.log(`✅ [APLICAR-ATUALIZACOES] Processamento concluído: ${results.updated}/${results.total} atualizadas`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Atualizações aplicadas em ${results.updated} de ${results.total} subcontas (${results.skipped} já estavam atualizadas)`,
        ...results,
        availableUpdates: AVAILABLE_UPDATES.map(u => ({
          id: u.id,
          version: u.version,
          description: u.description,
          safe: u.safe
        }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [APLICAR-ATUALIZACOES] Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao aplicar atualizações',
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

