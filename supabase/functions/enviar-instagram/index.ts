import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_VERSION = 'v18.0';
const META_API_BASE_URL = 'https://graph.facebook.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('📸 [INSTAGRAM-SEND] Payload recebido:', JSON.stringify(payload, null, 2));

    const { recipient_id, mensagem, company_id } = payload;

    if (!recipient_id || !company_id) {
      return new Response(
        JSON.stringify({ error: 'recipient_id e company_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mensagem) {
      return new Response(
        JSON.stringify({ error: 'mensagem é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configuração Instagram da empresa (aceitar com ou sem instagram_access_token)
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('instagram_access_token, instagram_account_id, instagram_username, meta_access_token')
      .eq('company_id', company_id)
      .not('instagram_account_id', 'is', null)
      .limit(1)
      .single();

    if (connError || !connection) {
      console.error('❌ Conexão Instagram não encontrada:', connError);
      return new Response(
        JSON.stringify({ error: 'Conexão Instagram não configurada para esta empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar meta_access_token como preferência (Page Token válido para Instagram Messaging API)
    // instagram_access_token (IGG tokens) NÃO funcionam para envio de mensagens via Graph API
    const accessToken = connection.meta_access_token || connection.instagram_access_token;
    const accountId = connection.instagram_account_id;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Token de acesso do Instagram não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📸 [INSTAGRAM-SEND] Enviando para:', recipient_id, 'account_id:', accountId);

    // Instagram Messaging API: tentar endpoints em ordem
    // 1. {account_id}/messages (endpoint correto para Instagram Business)
    // 2. /me/messages (fallback)
    const endpoints = [
      accountId ? `${META_API_BASE_URL}/${META_API_VERSION}/${accountId}/messages` : null,
      `${META_API_BASE_URL}/${META_API_VERSION}/me/messages`,
    ].filter(Boolean) as string[];

    let lastError: any = null;

    for (const url of endpoints) {
      console.log('📸 [INSTAGRAM-SEND] Tentando endpoint:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text: mensagem },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ [INSTAGRAM-SEND] Mensagem enviada com sucesso:', data);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message_id: data.message_id,
            provider: 'instagram',
            data 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.warn('⚠️ [INSTAGRAM-SEND] Falha no endpoint:', url, JSON.stringify(data));
      lastError = data;
    }

    // Todos os endpoints falharam
    console.error('❌ [INSTAGRAM-SEND] Todos os endpoints falharam. Último erro:', JSON.stringify(lastError));
    return new Response(
      JSON.stringify({ 
        error: lastError?.error?.message || 'Erro ao enviar mensagem via Instagram. Verifique as permissões do app Meta.',
        details: lastError 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('❌ Instagram Send - Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao enviar mensagem';
    return new Response(
      JSON.stringify({ error: errorMessage, provider: 'instagram' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
