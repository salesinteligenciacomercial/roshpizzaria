import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, company_id, redirect_uri } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Código de autorização não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('❌ [GMAIL-OAUTH] Credenciais não configuradas');
      return new Response(
        JSON.stringify({ error: 'Credenciais do Gmail não configuradas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 [GMAIL-OAUTH] Trocando código por tokens...');

    // Trocar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect_uri || 'https://wazecrm.lovable.app/oauth/gmail/callback',
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ [GMAIL-OAUTH] Erro ao obter tokens:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao obter tokens do Gmail', details: errorText }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokens = await tokenResponse.json();
    console.log('✅ [GMAIL-OAUTH] Tokens obtidos com sucesso');

    // Obter informações do usuário
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      console.error('❌ [GMAIL-OAUTH] Erro ao obter informações do usuário');
      return new Response(
        JSON.stringify({ error: 'Erro ao obter informações do usuário' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userInfo = await userInfoResponse.json();
    console.log('✅ [GMAIL-OAUTH] Email obtido:', userInfo.email);

    // Calcular expiração do token
    const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

    // Salvar no banco
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: updateError } = await supabase
      .from('tenant_integrations')
      .update({
        gmail_access_token: tokens.access_token,
        gmail_refresh_token: tokens.refresh_token,
        gmail_token_expires_at: expiresAt.toISOString(),
        gmail_email: userInfo.email,
        gmail_status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', company_id);

    if (updateError) {
      console.error('❌ [GMAIL-OAUTH] Erro ao salvar tokens:', updateError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar tokens', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [GMAIL-OAUTH] Integração Gmail configurada com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        email: userInfo.email,
        message: 'Gmail conectado com sucesso!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ [GMAIL-OAUTH] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
