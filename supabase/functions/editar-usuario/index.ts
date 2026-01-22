import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EditarUsuarioRequest {
  userId: string;
  companyId: string;
  full_name?: string;
  email?: string;
  telefone?: string;
  role?: string;
  password?: string; // Nova senha (opcional)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 [EDITAR-USUARIO] Iniciando processamento...');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [EDITAR-USUARIO] Sem autorização');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const body: EditarUsuarioRequest = await req.json();
    console.log('📦 [EDITAR-USUARIO] Dados recebidos:', JSON.stringify({ ...body, password: body.password ? '***' : undefined }, null, 2));
    
    const { userId, companyId, full_name, email, telefone, role, password } = body;

    if (!userId || !companyId) {
      return new Response(JSON.stringify({ error: 'userId e companyId são obrigatórios' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Validar variáveis de ambiente
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      console.error('❌ [EDITAR-USUARIO] Configuração incompleta');
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

    // Verificar token e obter usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: me }, error: meErr } = await supabaseAdmin.auth.getUser(token);
    
    if (meErr || !me) {
      console.error('❌ [EDITAR-USUARIO] Token inválido:', meErr);
      return new Response(JSON.stringify({ error: 'Token de autenticação inválido' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('👤 [EDITAR-USUARIO] Usuário identificado:', { userId: me.id, email: me.email });

    // Verificar permissões do usuário
    const { data: roles, error: rolesErr } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', me.id);

    if (rolesErr) {
      console.error('❌ [EDITAR-USUARIO] Erro ao buscar roles:', rolesErr);
      return new Response(JSON.stringify({ error: 'Falha ao validar permissões' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin') || false;
    const isCompanyAdmin = roles?.some(r => 
      (r.role === 'company_admin' || r.role === 'admin') && 
      String(r.company_id) === String(companyId)
    ) || false;

    console.log('🔐 [EDITAR-USUARIO] Permissões:', { isSuperAdmin, isCompanyAdmin });

    if (!isSuperAdmin && !isCompanyAdmin) {
      return new Response(JSON.stringify({ 
        error: 'Permissão negada. Você precisa ser Super Admin ou Administrador da empresa.' 
      }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verificar se o usuário alvo pertence à empresa
    const { data: targetUserRole, error: targetErr } = await supabaseAdmin
      .from('user_roles')
      .select('id, role')
      .eq('user_id', userId)
      .eq('company_id', companyId)
      .single();

    if (targetErr || !targetUserRole) {
      console.error('❌ [EDITAR-USUARIO] Usuário não encontrado na empresa:', targetErr);
      return new Response(JSON.stringify({ error: 'Usuário não encontrado nesta empresa' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Atualizar dados no profiles
    if (full_name || telefone) {
      console.log('👤 [EDITAR-USUARIO] Atualizando profile...');
      const profileUpdate: any = { updated_at: new Date().toISOString() };
      if (full_name) profileUpdate.full_name = full_name;
      
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);

      if (profileErr) {
        console.error('❌ [EDITAR-USUARIO] Erro ao atualizar profile:', profileErr);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar dados do perfil' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      console.log('✅ [EDITAR-USUARIO] Profile atualizado');
    }

    // Atualizar email no auth (se fornecido)
    if (email) {
      console.log('📧 [EDITAR-USUARIO] Atualizando email...');
      
      try {
        // Buscar o email atual do usuário
        const { data: userData, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (getUserErr) {
          console.error('❌ [EDITAR-USUARIO] Erro ao buscar usuário:', getUserErr);
          return new Response(JSON.stringify({ error: 'Erro ao buscar dados do usuário' }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        
        const currentEmail = userData?.user?.email?.toLowerCase().trim();
        const newEmail = email.toLowerCase().trim();
        
        // Só atualizar se o email for diferente
        if (currentEmail !== newEmail) {
          console.log('📧 [EDITAR-USUARIO] Email diferente, verificando disponibilidade...');
          
          // Verificar se o email já existe em outro usuário
          const { data: profilesWithEmail } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', newEmail)
            .neq('id', userId)
            .limit(1);
          
          if (profilesWithEmail && profilesWithEmail.length > 0) {
            console.error('❌ [EDITAR-USUARIO] Email já em uso');
            return new Response(JSON.stringify({ 
              error: 'Este email já está em uso por outro usuário.' 
            }), { 
              status: 409, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }

          const { error: emailErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: newEmail,
            email_confirm: true
          });

          if (emailErr) {
            console.error('❌ [EDITAR-USUARIO] Erro ao atualizar email:', emailErr);
            return new Response(JSON.stringify({ error: `Erro ao atualizar email: ${emailErr.message}` }), { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }

          // Atualizar email no profiles também
          const { error: profileEmailErr } = await supabaseAdmin
            .from('profiles')
            .update({ email: newEmail, updated_at: new Date().toISOString() })
            .eq('id', userId);

          if (profileEmailErr) {
            console.error('⚠️ [EDITAR-USUARIO] Aviso: erro ao atualizar email no profile:', profileEmailErr);
          }

          console.log('✅ [EDITAR-USUARIO] Email atualizado');
        } else {
          console.log('📧 [EDITAR-USUARIO] Email é o mesmo, ignorando atualização');
        }
      } catch (emailError) {
        console.error('❌ [EDITAR-USUARIO] Erro na atualização de email:', emailError);
        return new Response(JSON.stringify({ 
          error: emailError instanceof Error ? emailError.message : 'Erro ao atualizar email' 
        }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Atualizar senha (se fornecida)
    if (password) {
      console.log('🔐 [EDITAR-USUARIO] Atualizando senha...');
      
      if (password.length < 6) {
        return new Response(JSON.stringify({ error: 'A senha deve ter pelo menos 6 caracteres' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { error: passErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
      });

      if (passErr) {
        console.error('❌ [EDITAR-USUARIO] Erro ao atualizar senha:', passErr);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar senha' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      console.log('✅ [EDITAR-USUARIO] Senha atualizada');
    }

    // Atualizar role (se fornecida)
    if (role) {
      console.log('🎭 [EDITAR-USUARIO] Atualizando role...');
      
      const allowedRoles = ['company_admin', 'gestor', 'vendedor', 'suporte'];
      if (!allowedRoles.includes(role)) {
        return new Response(JSON.stringify({ 
          error: `Perfil inválido. Valores permitidos: ${allowedRoles.join(', ')}` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { error: roleErr } = await supabaseAdmin
        .from('user_roles')
        .update({ role })
        .eq('id', targetUserRole.id);

      if (roleErr) {
        console.error('❌ [EDITAR-USUARIO] Erro ao atualizar role:', roleErr);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar perfil do usuário' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      console.log('✅ [EDITAR-USUARIO] Role atualizada');
    }

    console.log('🎉 [EDITAR-USUARIO] Processo concluído com sucesso');

    return new Response(
      JSON.stringify({ success: true, message: 'Usuário atualizado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [EDITAR-USUARIO] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
