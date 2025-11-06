import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Obter o token do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verificar o usuário autenticado
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Erro ao obter usuário:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action } = await req.json();
    
    console.log(`🔐 Processando ação: ${action} para usuário ${user.email}`);

    if (action === 'elevate_super_admin') {
      // Buscar ou criar empresa para o usuário
      let { data: existingRole } = await supabaseAdmin
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      let companyId: string;

      if (!existingRole) {
        // Criar empresa se não existir
        const { data: newCompany, error: companyError } = await supabaseAdmin
          .from('companies')
          .insert({
            name: user.email?.split('@')[0].toUpperCase() || 'COMPANY',
            owner_user_id: user.id,
            created_by: user.id,
            is_master_account: true
          })
          .select('id')
          .single();

        if (companyError || !newCompany) {
          console.error('Erro ao criar empresa:', companyError);
          throw new Error('Falha ao criar empresa');
        }

        companyId = newCompany.id;
        console.log(`✅ Empresa criada: ${companyId}`);
      } else {
        companyId = existingRole.company_id;
      }

      // Promover usuário a super admin
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .upsert({
          user_id: user.id,
          company_id: companyId,
          role: 'super_admin'
        }, {
          onConflict: 'user_id,company_id'
        });

      if (roleError) {
        console.error('Erro ao atualizar role:', roleError);
        throw new Error('Falha ao promover usuário');
      }

      console.log(`✅ Usuário ${user.email} promovido a super_admin`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Usuário promovido a Super Admin com sucesso',
          company_id: companyId 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'make_master_account') {
      // Buscar empresa do usuário
      const { data: userRole } = await supabaseAdmin
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) {
        return new Response(
          JSON.stringify({ error: 'Usuário não possui empresa associada' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Tornar conta mestre
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({
          is_master_account: true,
          parent_company_id: null
        })
        .eq('id', userRole.company_id);

      if (updateError) {
        console.error('Erro ao tornar conta mestre:', updateError);
        throw new Error('Falha ao atualizar empresa');
      }

      console.log(`✅ Empresa ${userRole.company_id} marcada como conta mestre`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Empresa marcada como Conta Mestre com sucesso' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
