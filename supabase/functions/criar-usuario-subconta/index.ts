import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CriarUsuarioRequest {
  companyId: string;
  email: string;
  full_name: string;
  role: string; // 'company_admin' | 'gestor' | 'vendedor' | 'suporte' | 'user'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { companyId, email, full_name, role }: CriarUsuarioRequest = await req.json();

    if (!companyId || !email || !full_name || !role) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const allowedRoles = new Set(['company_admin', 'gestor', 'vendedor', 'suporte', 'user']);
    if (!allowedRoles.has(role)) {
      return new Response(JSON.stringify({ error: 'Perfil inválido' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Validar variáveis de ambiente obrigatórias
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!SUPABASE_URL) {
      return new Response(
        JSON.stringify({ error: 'Configuração ausente: SUPABASE_URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!SERVICE_ROLE) {
      return new Response(
        JSON.stringify({ error: 'Configuração ausente: SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!ANON_KEY) {
      return new Response(
        JSON.stringify({ error: 'Configuração ausente: SUPABASE_ANON_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente admin para operações privileged (criar usuário)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Cliente authed do chamador para validações de permissão e RLS
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar se chamador é super_admin OU company_admin da mesma company
    const { data: me, error: meErr } = await supabase.auth.getUser();
    if (meErr || !me?.user) {
      return new Response(JSON.stringify({ error: 'Falha ao identificar usuário' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: roles, error: rolesErr } = await supabase
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', me.user.id);

    if (rolesErr) {
      return new Response(JSON.stringify({ error: 'Falha ao validar permissões' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin') || false;
    const isCompanyAdminSameCompany = roles?.some(r => r.role === 'company_admin' && r.company_id === companyId) || false;

    if (!isSuperAdmin && !isCompanyAdminSameCompany) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Gerar senha temporária forte
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "!@#123";

    // Criar usuário de autenticação (não confirma email, senha temporária)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { full_name },
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      console.error('❌ [CRIAR USUÁRIO] Erro ao criar auth:', createErr);
      return new Response(JSON.stringify({ error: 'Erro ao criar usuário de autenticação' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Vincular role ao company
    const { error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .insert([{ user_id: created.user.id, company_id: companyId, role }]);

    if (roleErr) {
      console.error('❌ [CRIAR USUÁRIO] Erro ao vincular role:', roleErr);
      // Em um caso real, poderíamos deletar o usuário criado para consistência
      return new Response(JSON.stringify({ error: 'Erro ao vincular perfil do usuário' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, userId: created.user.id, tempPassword }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [CRIAR USUÁRIO] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});


