import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

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
    const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || SUPABASE_SERVICE_ROLE_KEY;
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { email, password } = await req.json();
    
    console.log(`🔐 [SUPER ADMIN BYPASS] Login direto para:`, email);

    // BYPASS COMPLETO - Validar apenas email
    if (email !== 'jeovauzumak@gmail.com') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar usuário diretamente do banco
    const { data: userData, error: userError } = await supabaseAdmin
      .from('auth.users')
      .select('id, email, encrypted_password, email_confirmed_at, created_at')
      .eq('email', email)
      .single();

    if (userError || !userData) {
      console.error('❌ Usuário não encontrado:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Usuário encontrado, gerando sessão...');

    // Buscar role do usuário
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role, company_id')
      .eq('user_id', userData.id)
      .single();

    // Criar JWT manualmente (BYPASS COMPLETO)
    const payload = {
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7), // 7 dias
      iat: Math.floor(Date.now() / 1000),
      iss: 'supabase',
      sub: userData.id,
      email: userData.email,
      phone: '',
      app_metadata: {
        provider: 'email',
        providers: ['email'],
        role: roleData?.role || 'super_admin'
      },
      user_metadata: {
        email: userData.email,
        email_verified: true,
        phone_verified: false,
        sub: userData.id
      },
      role: 'authenticated',
      aal: 'aal1',
      amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }],
      session_id: crypto.randomUUID()
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const accessToken = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    const refreshToken = crypto.randomUUID();

    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 604800,
      expires_at: Math.floor(Date.now() / 1000) + 604800,
      token_type: 'bearer',
      user: {
        id: userData.id,
        aud: 'authenticated',
        role: 'authenticated',
        email: userData.email,
        email_confirmed_at: userData.email_confirmed_at,
        phone: '',
        confirmed_at: userData.email_confirmed_at,
        created_at: userData.created_at,
        app_metadata: payload.app_metadata,
        user_metadata: payload.user_metadata,
        identities: [],
        updated_at: new Date().toISOString()
      }
    };

    console.log('✅ Sessão JWT criada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true,
        session,
        user: session.user,
        role: roleData?.role || 'super_admin',
        company_id: roleData?.company_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
