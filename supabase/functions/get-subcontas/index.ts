// ============================================
// 📋 BUSCAR SUBCONTAS
// ============================================
// Edge Function para buscar todas as subcontas de uma conta mestre
// Contorna RLS usando service role

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [GET-SUBCONTAS] Iniciando busca de subcontas...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase Admin (contorna RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Obter usuário do token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Usuário autenticado:', user.email);

    // Buscar roles do usuário
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', user.id);

    if (rolesError) {
      throw new Error(`Erro ao buscar roles: ${rolesError.message}`);
    }

    console.log('👤 Roles encontradas:', userRoles?.length || 0);

    // Encontrar empresas onde o usuário é super_admin
    const superAdminCompanies = (userRoles || [])
      .filter((r: any) => r.role === 'super_admin')
      .map((r: any) => r.company_id)
      .filter(Boolean);

    if (superAdminCompanies.length === 0) {
      return new Response(
        JSON.stringify({ data: [], message: 'Usuário não é super_admin de nenhuma empresa' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🏢 Empresas onde é super_admin:', superAdminCompanies);

    // Buscar informações das empresas
    const { data: companiesData, error: companiesError } = await supabaseAdmin
      .from('companies')
      .select('id, name, is_master_account, parent_company_id')
      .in('id', superAdminCompanies);

    if (companiesError) {
      throw new Error(`Erro ao buscar empresas: ${companiesError.message}`);
    }

    // Encontrar conta mestre
    const masterCompany = (companiesData || []).find((c: any) => c.is_master_account === true) 
      || (companiesData || [])[0];

    if (!masterCompany) {
      return new Response(
        JSON.stringify({ data: [], message: 'Nenhuma conta mestre encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const masterCompanyId = masterCompany.id;
    console.log('✅ Conta mestre identificada:', masterCompanyId, masterCompany.name);

    // Buscar todas as subcontas desta conta mestre
    const { data: subcontas, error: subcontasError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('parent_company_id', masterCompanyId)
      .order('created_at', { ascending: false });

    if (subcontasError) {
      throw new Error(`Erro ao buscar subcontas: ${subcontasError.message}`);
    }

    console.log('✅ Subcontas encontradas:', subcontas?.length || 0);

    return new Response(
      JSON.stringify({ 
        data: subcontas || [],
        parentCompanyId: masterCompanyId,
        parentCompanyName: masterCompany.name
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ [GET-SUBCONTAS] Erro:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao buscar subcontas',
        details: error.toString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

