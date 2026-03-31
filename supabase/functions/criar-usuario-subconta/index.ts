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
  password?: string; // Senha customizada (opcional - se não fornecida, será gerada)
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
  segmento?: string;
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
    
    const { companyId, email, full_name, password, role, parentCompanyId, companyName, cnpj, telefone, responsavel, plan, max_users, max_leads, segmento } = body;

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: 'Email e nome completo são obrigatórios' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Detectar modo de operação
    // IMPORTANTE: Criar usuário na empresa existente (companyId) vs Criar nova subconta (parentCompanyId + companyName)
    const isCreatingSubaccount = !!parentCompanyId && !!companyName;
    const isCreatingUser = !!companyId && !isCreatingSubaccount;

    console.log('🔍 [CRIAR-USUARIO] Modo detectado:', {
      isCreatingSubaccount,
      isCreatingUser,
      hasCompanyId: !!companyId,
      hasParentCompanyId: !!parentCompanyId,
      hasCompanyName: !!companyName
    });

    if (!isCreatingSubaccount && !isCreatingUser) {
      return new Response(
        JSON.stringify({ error: 'Especifique companyId (para criar usuário na empresa existente) ou parentCompanyId+companyName (para criar nova subconta)' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Garantir que está no modo correto
    if (isCreatingUser) {
      console.log('✅ [CRIAR-USUARIO] Modo: CRIAR USUÁRIO na empresa existente (companyId:', companyId, ')');
    } else {
      console.log('✅ [CRIAR-USUARIO] Modo: CRIAR NOVA SUBCONTA (parentCompanyId:', parentCompanyId, ', companyName:', companyName, ')');
    }

    // Valores válidos do enum app_role: super_admin, company_admin, gestor, vendedor, suporte
    // NÃO usar 'user' pois não existe no enum
    
    // IMPORTANTE: Se está criando subconta, o primeiro usuário DEVE ser company_admin
    // Se está apenas criando usuário em empresa existente, usar role fornecido ou 'vendedor' padrão
    const defaultRole = isCreatingSubaccount ? 'company_admin' : 'vendedor';
    const userRole = role || defaultRole;
    const allowedRoles = new Set(['company_admin', 'gestor', 'vendedor', 'suporte']);
    
    // Se receber 'user', mapear para 'vendedor' (role mais básico)
    const finalRole = userRole === 'user' ? 'vendedor' : userRole;
    
    console.log('🔐 [CRIAR-USUARIO] Role determinada:', {
      isCreatingSubaccount,
      isCreatingUser,
      roleRecebida: role,
      defaultRole,
      userRole,
      finalRole
    });
    
    if (!allowedRoles.has(finalRole)) {
      return new Response(JSON.stringify({ 
        error: 'Perfil inválido', 
        details: `Perfis válidos: company_admin, gestor, vendedor, suporte. Recebido: ${userRole}` 
      }), { 
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

      // VERIFICAR SE EMAIL JÁ EXISTE ANTES DE CRIAR EMPRESA
      console.log('🔍 [CRIAR-USUARIO] Verificando se email já existe...');
      const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
      const emailExists = existingUser?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (emailExists) {
        console.error('❌ [CRIAR-USUARIO] Email já cadastrado:', email);
        return new Response(JSON.stringify({ 
          error: 'Este email já está cadastrado no sistema. Use outro email ou remova o usuário existente primeiro.',
          code: 'EMAIL_JA_CADASTRADO'
        }), { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Verificar se CNPJ já existe
      if (cnpj) {
        const { data: existingCnpj } = await supabaseAdmin
          .from('companies')
          .select('id, name')
          .eq('cnpj', cnpj)
          .maybeSingle();
        
        if (existingCnpj) {
          console.error('❌ [CRIAR-USUARIO] CNPJ já cadastrado:', cnpj, 'empresa:', existingCnpj.name);
          return new Response(JSON.stringify({ 
            error: `Este CNPJ já está cadastrado para a empresa "${existingCnpj.name}". Use outro CNPJ ou edite a empresa existente.`,
            code: 'CNPJ_JA_CADASTRADO'
          }), { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      console.log('📝 [CRIAR-USUARIO] Criando nova empresa...');
      
      // Criar nova empresa
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
          segmento: segmento || null,
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
      console.log('✅ [CRIAR-USUARIO] Empresa criada:', targetCompanyId);
    } else {
      // Criar usuário em empresa existente
      // Normalizar company_id para string para comparação correta
      const normalizedCompanyId = String(companyId).trim();
      
      // Verificar se o usuário tem permissão na empresa
      // Pode ser super_admin OU company_admin da mesma empresa OU admin (role antiga)
      const isCompanyAdminSameCompany = roles?.some(r => {
        const roleCompanyId = String(r.company_id || '').trim();
        return (r.role === 'company_admin' || r.role === 'admin') && roleCompanyId === normalizedCompanyId;
      }) || false;

      console.log('🔐 [CRIAR-USUARIO] Verificação de permissões:', {
        isSuperAdmin,
        isCompanyAdminSameCompany,
        companyId: normalizedCompanyId,
        roles: roles?.map(r => ({ role: r.role, company_id: String(r.company_id) }))
      });

      // Permitir criar usuário se:
      // 1. É super_admin OU
      // 2. É company_admin/admin da mesma empresa
      if (!isSuperAdmin && !isCompanyAdminSameCompany) {
        console.error('❌ [CRIAR-USUARIO] Permissão negada:', {
          isSuperAdmin,
          isCompanyAdminSameCompany,
          companyId: normalizedCompanyId,
          userRoles: roles
        });
        return new Response(JSON.stringify({ 
          error: 'Permissão negada para criar usuário nesta empresa. Você precisa ser Super Admin ou Administrador da empresa.',
          details: `Company ID: ${normalizedCompanyId}`
        }), { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      targetCompanyId = normalizedCompanyId;
      
      // VERIFICAR SE EMAIL JÁ EXISTE (para usuários em empresa existente também)
      console.log('🔍 [CRIAR-USUARIO] Verificando se email já existe...');
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const emailExists = existingUsers?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (emailExists) {
        console.error('❌ [CRIAR-USUARIO] Email já cadastrado:', email);
        return new Response(JSON.stringify({ 
          error: `O e-mail ${email} já está cadastrado no sistema. Use outro e-mail ou remova o usuário existente primeiro.`,
          code: 'EMAIL_JA_CADASTRADO'
        }), { 
          status: 409, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    console.log('🔐 [CRIAR-USUARIO] Criando usuário de autenticação...');
    
    // Usar senha fornecida ou gerar senha temporária forte
    const userPassword = password && password.length >= 6 
      ? password 
      : Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "!@#123";

    // Criar usuário de autenticação
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: userPassword,
      user_metadata: { full_name },
      email_confirm: true,
    });

    if (createErr || !created?.user) {
      console.error('❌ [CRIAR-USUARIO] Erro ao criar usuário auth:', createErr);
      
      // Mensagem de erro mais específica
      let errorMessage = 'Erro ao criar usuário de autenticação';
      let errorDetails = createErr?.message || 'Erro desconhecido';
      
      // Verificar tipos comuns de erro
      if (errorDetails.includes('already registered') || errorDetails.includes('already exists') || errorDetails.includes('duplicate')) {
        errorMessage = `O e-mail ${email} já está cadastrado no sistema.`;
        errorDetails = 'EMAIL_JA_CADASTRADO';
      } else if (errorDetails.includes('invalid email') || errorDetails.includes('email format')) {
        errorMessage = `O e-mail ${email} não é válido.`;
        errorDetails = 'EMAIL_INVALIDO';
      } else if (errorDetails.includes('password')) {
        errorMessage = 'Erro ao gerar senha do usuário.';
        errorDetails = 'ERRO_SENHA';
      }
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        originalError: createErr?.message
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('✅ [CRIAR-USUARIO] Usuário criado:', created.user.id);
    
    // Criar ou atualizar profile na tabela profiles
    console.log('👤 [CRIAR-USUARIO] Criando/atualizando profile...');
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: created.user.id,
        full_name: full_name,
        email: email.toLowerCase().trim(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (profileErr) {
      console.warn('⚠️ [CRIAR-USUARIO] Erro ao criar/atualizar profile (não crítico):', profileErr);
      // Não bloquear se der erro no profile, pois pode ser criado por trigger
    } else {
      console.log('✅ [CRIAR-USUARIO] Profile criado/atualizado com sucesso');
    }

    console.log('🔗 [CRIAR-USUARIO] Vinculando role à empresa...');

    // Vincular role à empresa (usar finalRole que garante valor válido do enum)
    const { error: roleErr } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: created.user.id, company_id: targetCompanyId, role: finalRole });

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
            senha: userPassword,
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
          senha: userPassword,
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
