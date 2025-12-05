import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verificar assinatura do webhook do Meta
async function verifyWebhookSignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  if (!signature || !appSecret) {
    console.warn('Assinatura ou App Secret não fornecidos');
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );

  const computedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedSignature === signature;
}

// Transformar payload do Meta para formato interno
function transformMetaPayload(entry: any) {
  const messages: any[] = [];
  
  for (const change of entry.changes || []) {
    if (change.field !== 'messages') continue;
    
    const value = change.value;
    const metadata = value.metadata;
    const phoneNumberId = metadata?.phone_number_id;
    const displayPhoneNumber = metadata?.display_phone_number;
    
    for (const message of value.messages || []) {
      const contact = value.contacts?.find((c: any) => c.wa_id === message.from);
      
      let messageType = 'text';
      let messageContent = '';
      let mediaUrl = '';
      let mediaType = '';
      
      switch (message.type) {
        case 'text':
          messageType = 'text';
          messageContent = message.text?.body || '';
          break;
        case 'image':
          messageType = 'image';
          messageContent = message.image?.caption || '[Imagem]';
          mediaUrl = message.image?.id; // ID da mídia, precisa buscar URL
          break;
        case 'video':
          messageType = 'video';
          messageContent = message.video?.caption || '[Vídeo]';
          mediaUrl = message.video?.id;
          break;
        case 'audio':
          messageType = 'audio';
          messageContent = '[Áudio]';
          mediaUrl = message.audio?.id;
          break;
        case 'document':
          messageType = 'document';
          messageContent = message.document?.caption || message.document?.filename || '[Documento]';
          mediaUrl = message.document?.id;
          break;
        case 'sticker':
          messageType = 'image';
          messageContent = '[Sticker]';
          mediaUrl = message.sticker?.id;
          break;
        case 'location':
          messageType = 'text';
          messageContent = `📍 Localização: ${message.location?.latitude}, ${message.location?.longitude}`;
          break;
        case 'contacts':
          messageType = 'text';
          const contactNames = message.contacts?.map((c: any) => c.name?.formatted_name).join(', ');
          messageContent = `📇 Contato(s): ${contactNames}`;
          break;
        case 'button':
          messageType = 'text';
          messageContent = message.button?.text || '[Botão]';
          break;
        case 'interactive':
          messageType = 'text';
          messageContent = message.interactive?.button_reply?.title || 
                          message.interactive?.list_reply?.title || 
                          '[Resposta interativa]';
          break;
        default:
          messageType = 'text';
          messageContent = `[${message.type}]`;
      }

      messages.push({
        message_id: message.id,
        from: message.from,
        timestamp: message.timestamp,
        type: messageType,
        content: messageContent,
        media_id: mediaUrl,
        contact_name: contact?.profile?.name || contact?.wa_id || message.from,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
        context: message.context, // Para respostas a mensagens
        is_from_me: false,
      });
    }
    
    // Processar status de mensagens (enviadas, entregues, lidas)
    for (const status of value.statuses || []) {
      console.log('Status de mensagem:', JSON.stringify(status, null, 2));
      // Aqui você pode atualizar o status das mensagens enviadas
    }
  }
  
  return messages;
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Verificação do webhook (GET request do Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    console.log('Meta Webhook Verification:', { mode, token, challenge });
    
    // Buscar token de verificação do banco
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Buscar qualquer conexão com token de verificação
    const { data: connections } = await supabase
      .from('whatsapp_connections')
      .select('meta_webhook_verify_token, company_id')
      .not('meta_webhook_verify_token', 'is', null);
    
    const validToken = connections?.find(c => c.meta_webhook_verify_token === token);
    
    if (mode === 'subscribe' && validToken) {
      console.log('Webhook verificado com sucesso para company:', validToken.company_id);
      return new Response(challenge, { status: 200 });
    }
    
    console.warn('Falha na verificação do webhook');
    return new Response('Forbidden', { status: 403 });
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // POST - Receber mensagens
  if (req.method === 'POST') {
    try {
      const rawBody = await req.text();
      const signature = req.headers.get('x-hub-signature-256');
      
      console.log('Meta Webhook - Payload recebido');
      
      const body = JSON.parse(rawBody);
      
      // Verificar se é do WhatsApp
      if (body.object !== 'whatsapp_business_account') {
        console.log('Payload não é do WhatsApp Business');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      for (const entry of body.entry || []) {
        const messages = transformMetaPayload(entry);
        
        for (const msg of messages) {
          // Buscar conexão pelo phone_number_id
          const { data: connection } = await supabase
            .from('whatsapp_connections')
            .select('company_id, meta_access_token')
            .eq('meta_phone_number_id', msg.phone_number_id)
            .single();
          
          if (!connection) {
            console.warn('Conexão não encontrada para phone_number_id:', msg.phone_number_id);
            continue;
          }

          const company_id = connection.company_id;
          
          // Formatar número
          let formattedNumber = msg.from.replace(/[^0-9]/g, '');
          if (!formattedNumber.startsWith('55') && formattedNumber.length <= 11) {
            formattedNumber = '55' + formattedNumber;
          }

          // Buscar lead existente
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id, name')
            .eq('company_id', company_id)
            .or(`telefone.ilike.%${formattedNumber}%,phone.ilike.%${formattedNumber}%`)
            .limit(1)
            .single();

          // Preparar dados para inserção
          const conversaData = {
            numero: formattedNumber,
            telefone_formatado: formattedNumber,
            mensagem: msg.content,
            tipo_mensagem: msg.type,
            origem: 'WhatsApp',
            status: 'Recebida',
            fromme: false,
            company_id: company_id,
            lead_id: existingLead?.id || null,
            nome_contato: existingLead?.name || msg.contact_name || formattedNumber,
            midia_url: msg.media_id || null, // Por enquanto salva o ID da mídia
            is_group: false,
          };

          console.log('Inserindo conversa Meta:', JSON.stringify(conversaData, null, 2));

          const { error: insertError } = await supabase
            .from('conversas')
            .insert(conversaData);

          if (insertError) {
            console.error('Erro ao inserir conversa:', insertError);
          } else {
            console.log('Conversa inserida com sucesso');
          }
        }
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
      
    } catch (error) {
      console.error('Meta Webhook - Erro:', error);
      return new Response('OK', { status: 200, headers: corsHeaders }); // Sempre retornar 200 para o Meta
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
