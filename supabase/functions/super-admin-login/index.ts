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
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const { email, password } = await req.json();
    
    console.log(`🔐 [SUPER ADMIN] Tentando autenticar:`, email);

    // Validar que é o super admin
    if (email !== 'jeovauzumak@gmail.com') {
      console.log('❌ Email não autorizado');
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = '677a7847-1f34-44d0-b03b-c148b4b166b7';
    
    // Passo 1: Resetar senha para a senha fornecida
    console.log('🔧 Atualizando senha do super admin...');
    
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: password }
    );

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar senha: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Senha atualizada com sucesso');

    // Passo 2: Fazer login usando a API REST do Supabase diretamente
    console.log('🔑 Fazendo login via API REST...');
    
    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!loginResponse.ok) {
      const errorData = await loginResponse.json();
      console.error('❌ Erro no login REST:', errorData);
      return new Response(
        JSON.stringify({ error: 'Erro ao fazer login: ' + (errorData.error_description || errorData.msg) }),
        { status: loginResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login bem-sucedido!');

    return new Response(
      JSON.stringify({ 
        success: true,
        session: {
          access_token: loginData.access_token,
          refresh_token: loginData.refresh_token,
          expires_in: loginData.expires_in,
          expires_at: loginData.expires_at,
          token_type: loginData.token_type,
          user: loginData.user
        },
        user: loginData.user,
        role: 'super_admin'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro fatal:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
