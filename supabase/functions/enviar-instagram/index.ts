import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const META_API_VERSION = 'v23.0';
const INSTAGRAM_API_BASE_URL = 'https://graph.instagram.com';
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

    // Para Instagram Messaging API, usar instagram_access_token (IGAAT) como preferência
    // O endpoint correto é graph.instagram.com (NÃO graph.facebook.com)
    // Ref: https://developers.facebook.com/community/threads/1030645562609158/
    const igToken = connection.instagram_access_token;
    const metaToken = connection.meta_access_token;
    const accountId = connection.instagram_account_id;

    if (!igToken && !metaToken) {
      return new Response(
        JSON.stringify({ error: 'Token de acesso do Instagram não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📸 [INSTAGRAM-SEND] Enviando para:', recipient_id, 'account_id:', accountId);
    console.log('📸 [INSTAGRAM-SEND] Tem IG token:', !!igToken, '| Tem Meta token:', !!metaToken);

    // Estratégia de endpoints em ordem de prioridade:
    // 1. graph.instagram.com/me/messages com IG token (endpoint correto para Instagram Business Login)
    // 2. graph.facebook.com/{account_id}/messages com Meta token (fallback)
    // 3. graph.facebook.com/me/messages com Meta token (último recurso)
    const endpoints: Array<{ url: string; token: string }> = [];
    
    if (igToken) {
      endpoints.push({ 
        url: `${INSTAGRAM_API_BASE_URL}/${META_API_VERSION}/me/messages`, 
        token: igToken 
      });
    }
    if (metaToken && accountId) {
      endpoints.push({ 
        url: `${META_API_BASE_URL}/${META_API_VERSION}/${accountId}/messages`, 
        token: metaToken 
      });
    }
    if (metaToken) {
      endpoints.push({ 
        url: `${META_API_BASE_URL}/${META_API_VERSION}/me/messages`, 
        token: metaToken 
      });
    }

    let lastError: any = null;

    for (const ep of endpoints) {
      console.log('📸 [INSTAGRAM-SEND] Tentando endpoint:', ep.url);
      
      const response = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ep.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text: mensagem },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ [INSTAGRAM-SEND] Mensagem enviada com sucesso via:', ep.url, data);
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

      console.warn('⚠️ [INSTAGRAM-SEND] Falha no endpoint:', ep.url, JSON.stringify(data));
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
