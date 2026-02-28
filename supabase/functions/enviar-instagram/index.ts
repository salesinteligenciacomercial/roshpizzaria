import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Buscar configuração Instagram da empresa
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('instagram_access_token, instagram_account_id, instagram_username')
      .eq('company_id', company_id)
      .not('instagram_access_token', 'is', null)
      .limit(1)
      .single();

    if (connError || !connection) {
      console.error('❌ Conexão Instagram não encontrada:', connError);
      return new Response(
        JSON.stringify({ error: 'Conexão Instagram não configurada para esta empresa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { instagram_access_token } = connection;

    if (!instagram_access_token) {
      return new Response(
        JSON.stringify({ error: 'Token de acesso do Instagram não configurado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar mensagem via Instagram Messaging API (Graph API)
    // Instagram uses the same Messages endpoint as Facebook Page messaging
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/me/messages`;

    console.log('📸 [INSTAGRAM-SEND] Enviando para:', recipient_id);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${instagram_access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipient_id },
        message: { text: mensagem },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Instagram API Error:', data);
      
      // If the /me/messages endpoint fails, try the Instagram-specific endpoint
      // Instagram Business API uses page_id/messages
      if (connection.instagram_account_id) {
        console.log('🔄 [INSTAGRAM-SEND] Tentando endpoint alternativo com account_id...');
        const altUrl = `${META_API_BASE_URL}/${META_API_VERSION}/${connection.instagram_account_id}/messages`;
        
        const altResponse = await fetch(altUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${instagram_access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: recipient_id },
            message: { text: mensagem },
          }),
        });

        const altData = await altResponse.json();

        if (!altResponse.ok) {
          console.error('❌ Instagram API Alt Error:', altData);
          return new Response(
            JSON.stringify({ 
              error: altData.error?.message || 'Erro ao enviar mensagem via Instagram',
              details: altData 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('✅ [INSTAGRAM-SEND] Mensagem enviada via endpoint alternativo:', altData);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message_id: altData.message_id,
            provider: 'instagram',
            data: altData 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: data.error?.message || 'Erro ao enviar mensagem via Instagram',
          details: data 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

  } catch (error: unknown) {
    console.error('❌ Instagram Send - Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno ao enviar mensagem';
    return new Response(
      JSON.stringify({ error: errorMessage, provider: 'instagram' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
