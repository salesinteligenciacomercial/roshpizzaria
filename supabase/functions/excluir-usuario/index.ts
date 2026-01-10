import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExcluirUsuarioRequest {
  userId: string;
  companyId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [EXCLUIR-USUARIO] Iniciando processamento...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body: ExcluirUsuarioRequest = await req.json();
    const { userId, companyId } = body;

    if (!userId || !companyId) {
      return new Response(JSON.stringify({ error: 'userId e companyId são obrigatórios' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
      global: {
        headers: {
          'x-supabase-bypass-rls': 'true'
        }
      }
    });

    // Verificar token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: me }, error: meErr } = await supabaseAdmin.auth.getUser(token);
    
    if (meErr || !me) {
      return new Response(JSON.stringify({ error: 'Token de autenticação inválido' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar permissões
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', me.id);

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin') || false;
    const isCompanyAdmin = roles?.some(r => 
      (r.role === 'company_admin' || r.role === 'admin') && 
      String(r.company_id) === String(companyId)
    ) || false;

    if (!isSuperAdmin && !isCompanyAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Permissão negada. Você precisa ser Super Admin ou Administrador da empresa.' 
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Impedir auto-exclusão
    if (userId === me.id) {
      return new Response(JSON.stringify({ error: 'Você não pode excluir a si mesmo.' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar se usuário pertence à empresa
    const { data: targetUserRole, error: targetErr } = await supabaseAdmin
      .from('user_roles')
      .select('id, role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    if (targetErr || !targetUserRole) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado nesta empresa' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Impedir exclusão de super_admin
    if (targetUserRole.role === 'super_admin') {
      return new Response(JSON.stringify({ error: 'Não é possível excluir um Super Admin' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('🗑️ [EXCLUIR-USUARIO] Removendo user_role...');
    
    // Remover vinculo com a empresa
    const { error: deleteRoleErr } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('id', targetUserRole.id);

    if (deleteRoleErr) {
      console.error('❌ [EXCLUIR-USUARIO] Erro ao remover role:', deleteRoleErr);
      return new Response(JSON.stringify({ error: 'Erro ao remover vínculo do usuário' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar se o usuário tem outras associações
    const { data: otherRoles } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId);

    // Se não tem mais vínculos, excluir completamente
    if (!otherRoles || otherRoles.length === 0) {
      console.log('🗑️ [EXCLUIR-USUARIO] Usuário sem vínculos, excluindo completamente...');
      
      // Excluir profile
      await supabaseAdmin.from('profiles').delete().eq('id', userId);
      
      // Excluir usuário de auth
      const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      
      if (deleteAuthErr) {
        console.warn('⚠️ [EXCLUIR-USUARIO] Erro ao excluir usuário auth:', deleteAuthErr);
      } else {
        console.log('✅ [EXCLUIR-USUARIO] Usuário completamente excluído');
      }
    } else {
      console.log('✅ [EXCLUIR-USUARIO] Vínculo removido (usuário mantido em outras empresas)');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Usuário excluído com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [EXCLUIR-USUARIO] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
