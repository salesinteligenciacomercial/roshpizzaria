import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CriarUsuarioRequest {
  // Para criar apenas usuário em empresa existente
  companyId?: string;
  email: string;
  full_name: string;
  role?: string; // 'company_admin' | 'gestor' | 'vendedor' | 'suporte' | 'user'
  
  // Para criar subconta completa (nova empresa + admin)
  parentCompanyId?: string;
  companyName?: string;
  cnpj?: string;
  telefone?: string;
  responsavel?: string;
  plan?: string;
  max_users?: number;
  max_leads?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [CRIAR-USUARIO] Iniciando processamento...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [CRIAR-USUARIO] Sem autorização');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body: CriarUsuarioRequest = await req.json();
    console.log('📦 [CRIAR-USUARIO] Dados recebidos:', JSON.stringify(body, null, 2));
    
    const { companyId, email, full_name, role, parentCompanyId, companyName, cnpj, telefone, responsavel, plan, max_users, max_leads } = body;

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'Email e nome completo são obrigatórios' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Detectar modo de operação
    const isCreatingSubaccount = !!parentCompanyId && !!companyName;
    const isCreatingUser = !!companyId && !isCreatingSubaccount;

    if (!isCreatingSubaccount && !isCreatingUser) {
      return new Response(
        JSON.stringify({ error: 'Especifique companyId (para usuário) ou parentCompanyId+companyName (para subconta)' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRole = role || 'company_admin';
    const allowedRoles = new Set(['company_admin', 'gestor', 'vendedor', 'suporte', 'user']);
    if (!allowedRoles.has(userRole)) {
      return new Response(JSON.stringify({ error: 'Perfil inválido' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar variáveis de ambiente
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error('❌ [CRIAR-USUARIO] Configuração incompleta');
      return new Response(
        JSON.stringify({ error: 'Configuração do servidor incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar apenas SERVICE_ROLE para todas as operações
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Extrair JWT token do header
    const token = authHeader.replace('Bearer ', '');
    
    // Verificar token e obter usuário
    const { data: { user: me }, error: meErr } = await supabaseAdmin.auth.getUser(token);
    console.log('👤 [CRIAR-USUARIO] Usuário identificado:', { userId: me?.id, email: me?.email });
    
    if (meErr || !me) {
      console.error('❌ [CRIAR-USUARIO] Token inválido:', meErr);
      return new Response(JSON.stringify({ error: 'Token de autenticação inválido' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar permissões do usuário
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', me.id);

    console.log('🔐 [CRIAR-USUARIO] Roles encontradas:', roles);

    if (rolesErr) {
      console.error('❌ [CRIAR-USUARIO] Erro ao buscar roles:', rolesErr);
      return new Response(JSON.stringify({ error: 'Falha ao validar permissões' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin') || false;
    console.log('👑 [CRIAR-USUARIO] É super admin?', isSuperAdmin);
    
    let targetCompanyId: string;

    if (isCreatingSubaccount) {
      // Criar subconta: apenas super_admin pode
      if (!isSuperAdmin) {
        console.error('❌ [CRIAR-USUARIO] Usuário não é super admin');
        return new Response(JSON.stringify({ error: 'Apenas Super Admin pode criar subcontas' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log('📝 [CRIAR-USUARIO] Criando nova empresa (subconta independente)...');
      
      // Criar nova empresa SEPARADA com seus próprios dados
      const { data: newCompany, error: companyErr } = await supabaseAdmin
        .from('companies')
        .insert({
          name: companyName,
          cnpj: cnpj || null,
          parent_company_id: parentCompanyId,
          is_master_account: false,
          plan: plan || 'basic',
          max_users: max_users || 5,
          max_leads: max_leads || 1000,
          status: 'active',
          created_by: me.id,
          settings: {
            email,
            telefone: telefone || null,
            responsavel: responsavel || full_name,
          }
        })
        .select('id')
        .single();

      if (companyErr || !newCompany) {
        console.error('❌ [CRIAR-USUARIO] Erro ao criar empresa:', companyErr);
        return new Response(JSON.stringify({ 
          error: 'Erro ao criar subconta',
          details: companyErr?.message 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      targetCompanyId = newCompany.id;
      console.log('✅ [CRIAR-USUARIO] Empresa criada com company_id único:', targetCompanyId);
    } else {
      // Criar usuário em empresa existente
      const isCompanyAdminSameCompany = roles?.some(r => r.role === 'company_admin' && r.company_id === companyId) || false;

      if (!isSuperAdmin && !isCompanyAdminSameCompany) {
        return new Response(JSON.stringify({ error: 'Permissão negada para criar usuário nesta empresa' }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      targetCompanyId = companyId!;
    }

    console.log('🔐 [CRIAR-USUARIO] Criando usuário de autenticação...');
    
    // Gerar senha temporária forte
    const tempPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "!@#123";

    // Criar usuário de autenticação
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      user_metadata: { full_name },
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      console.error('❌ [CRIAR-USUARIO] Erro ao criar usuário auth:', createErr);
      return new Response(JSON.stringify({ 
        error: 'Erro ao criar usuário de autenticação',
        details: createErr?.message 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('✅ [CRIAR-USUARIO] Usuário criado:', created.user.id);
    console.log('🔗 [CRIAR-USUARIO] Vinculando role à empresa...');

    // Vincular role à empresa
    const { error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: created.user.id, company_id: targetCompanyId, role: userRole });

    if (roleErr) {
      console.error('❌ [CRIAR-USUARIO] Erro ao vincular role:', roleErr);
      return new Response(JSON.stringify({ 
        error: 'Erro ao vincular perfil do usuário',
        details: roleErr.message 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('✅ [CRIAR-USUARIO] Role vinculada com sucesso');

    // Opcional: Enviar credenciais por WhatsApp (não bloqueia sucesso)
    if (isCreatingSubaccount && telefone) {
      try {
        console.log('📤 [CRIAR-USUARIO] Enviando credenciais via WhatsApp...');
        await supabaseAdmin.functions.invoke('enviar-credenciais-subconta', {
          body: {
            nome: responsavel || full_name,
            email,
            senha: tempPassword,
            telefone,
            nomeConta: companyName,
            url: SUPABASE_URL.replace('supabase.co', 'lovableproject.com'),
          }
        });
        console.log('✅ [CRIAR-USUARIO] Credenciais enviadas');
      } catch (sendErr) {
        console.warn('⚠️ [CRIAR-USUARIO] Falha ao enviar credenciais (não crítico):', sendErr);
      }
    }

    console.log('🎉 [CRIAR-USUARIO] Processo concluído com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: created.user.id, 
        companyId: targetCompanyId,
        credentials: {
          email,
          senha: tempPassword,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [CRIAR-USUARIO] Erro geral:', error);
    console.error('❌ [CRIAR-USUARIO] Stack:', error instanceof Error ? error.stack : 'N/A');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
