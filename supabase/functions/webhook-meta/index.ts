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

// Construir JSON estruturado para mídia Meta API
function buildMetaMediaJson(mediaId: string, mimeType?: string, sha256?: string, fileName?: string) {
  return JSON.stringify({
    media_id: mediaId,
    source: 'meta',
    mimetype: mimeType || null,
    sha256: sha256 || null,
    file_name: fileName || null,
  });
}

// Transformar payload do WhatsApp Meta para formato interno
function transformWhatsAppPayload(entry: any) {
  const messages: any[] = [];
  
  for (const change of entry.changes || []) {
    const value = change.value;
    const metadata = value.metadata;
    const phoneNumberId = metadata?.phone_number_id;
    const displayPhoneNumber = metadata?.display_phone_number;
    
    // Processar mensagens recebidas (field = messages)
    if (change.field === 'messages') {
      for (const message of value.messages || []) {
        const contact = value.contacts?.find((c: any) => c.wa_id === message.from);
        
        // Capturar foto de perfil do contato (Meta API envia no webhook)
        const profilePictureUrl = contact?.profile?.picture || null;
        
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = '';
        let fileName = '';
        
        switch (message.type) {
          case 'text':
            messageType = 'text';
            messageContent = message.text?.body || '';
            break;
          case 'image':
            messageType = 'image';
            messageContent = message.image?.caption || '[Imagem]';
            mediaUrl = buildMetaMediaJson(
              message.image?.id,
              message.image?.mime_type,
              message.image?.sha256
            );
            break;
          case 'video':
            messageType = 'video';
            messageContent = message.video?.caption || '[Vídeo]';
            mediaUrl = buildMetaMediaJson(
              message.video?.id,
              message.video?.mime_type,
              message.video?.sha256
            );
            break;
          case 'audio':
            messageType = 'audio';
            messageContent = '[Áudio]';
            mediaUrl = buildMetaMediaJson(
              message.audio?.id,
              message.audio?.mime_type || 'audio/ogg; codecs=opus',
              message.audio?.sha256
            );
            break;
          case 'document':
            messageType = 'document';
            fileName = message.document?.filename || 'documento';
            messageContent = message.document?.caption || fileName || '[Documento]';
            mediaUrl = buildMetaMediaJson(
              message.document?.id,
              message.document?.mime_type,
              message.document?.sha256,
              fileName
            );
            break;
          case 'sticker':
            messageType = 'image';
            messageContent = '[Sticker]';
            mediaUrl = buildMetaMediaJson(
              message.sticker?.id,
              message.sticker?.mime_type || 'image/webp',
              message.sticker?.sha256
            );
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
          case 'template':
            messageType = 'text';
            messageContent = '[Template]';
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
          media_url: mediaUrl,
          file_name: fileName,
          contact_name: contact?.profile?.name || contact?.wa_id || message.from,
          profile_picture_url: profilePictureUrl,
          phone_number_id: phoneNumberId,
          display_phone_number: displayPhoneNumber,
          context: message.context,
          is_from_me: false,
          source: 'whatsapp',
        });
      }
      
      // Processar status de mensagens
      for (const status of value.statuses || []) {
        console.log('📊 Status de mensagem WhatsApp:', JSON.stringify(status, null, 2));
      }
    }
    
    // Processar message_echoes (mensagens enviadas pelo CRM/Templates)
    if (change.field === 'message_echoes') {
      console.log('📤 [MESSAGE_ECHOES] Processando mensagens enviadas:', JSON.stringify(value, null, 2));
      
      for (const message of value.messages || []) {
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = '';
        let fileName = '';
        
        // Destino da mensagem (para quem foi enviada)
        const recipientWaId = message.to;
        
        switch (message.type) {
          case 'text':
            messageType = 'text';
            messageContent = message.text?.body || '';
            break;
          case 'template':
            messageType = 'text';
            // Extrair conteúdo do template
            const templateName = message.template?.name || 'template';
            const templateComponents = message.template?.components || [];
            let templateBody = '';
            for (const component of templateComponents) {
              if (component.type === 'body' && component.parameters) {
                templateBody = component.parameters.map((p: any) => p.text || '').join(' ');
              }
            }
            messageContent = templateBody || `[Template: ${templateName}]`;
            break;
          case 'image':
            messageType = 'image';
            messageContent = message.image?.caption || '[Imagem enviada]';
            if (message.image?.id) {
              mediaUrl = buildMetaMediaJson(message.image.id, message.image.mime_type);
            }
            break;
          case 'video':
            messageType = 'video';
            messageContent = message.video?.caption || '[Vídeo enviado]';
            if (message.video?.id) {
              mediaUrl = buildMetaMediaJson(message.video.id, message.video.mime_type);
            }
            break;
          case 'audio':
            messageType = 'audio';
            messageContent = '[Áudio enviado]';
            if (message.audio?.id) {
              mediaUrl = buildMetaMediaJson(message.audio.id, message.audio.mime_type);
            }
            break;
          case 'document':
            messageType = 'document';
            fileName = message.document?.filename || 'documento';
            messageContent = message.document?.caption || fileName;
            if (message.document?.id) {
              mediaUrl = buildMetaMediaJson(message.document.id, message.document.mime_type, undefined, fileName);
            }
            break;
          default:
            messageType = 'text';
            messageContent = `[${message.type} enviado]`;
        }

        messages.push({
          message_id: message.id,
          from: recipientWaId,
          timestamp: message.timestamp,
          type: messageType,
          content: messageContent,
          media_url: mediaUrl,
          file_name: fileName,
          contact_name: recipientWaId,
          phone_number_id: phoneNumberId,
          display_phone_number: displayPhoneNumber,
          context: message.context,
          is_from_me: true,
          source: 'whatsapp',
        });
      }
    }
    
    // Processar message_template_status_update
    if (change.field === 'message_template_status_update') {
      console.log('📋 [TEMPLATE_STATUS] Status de template:', JSON.stringify(value, null, 2));
      // Apenas log por enquanto - não cria mensagem
    }
  }
  
  return messages;
}

// Transformar payload do Instagram para formato interno
function transformInstagramPayload(entry: any) {
  const messages: any[] = [];
  const instagramAccountId = entry.id;
  
  console.log('📸 [INSTAGRAM] Processando entry para account:', instagramAccountId);
  
  for (const change of entry.changes || []) {
    console.log('📸 [INSTAGRAM] Change field:', change.field);
    
    // Instagram mensagens chegam no field "messages"
    if (change.field === 'messages') {
      const value = change.value;
      console.log('📸 [INSTAGRAM] Mensagem value:', JSON.stringify(value, null, 2));
      
      // Estrutura do webhook Instagram Messaging
      const senderId = value.sender?.id;
      const recipientId = value.recipient?.id;
      const messageData = value.message;
      
      if (messageData) {
        let messageType = 'text';
        let messageContent = '';
        let mediaUrl = '';
        
        // Texto
        if (messageData.text) {
          messageType = 'text';
          messageContent = messageData.text;
        }
        // Imagem
        else if (messageData.attachments) {
          for (const attachment of messageData.attachments) {
            if (attachment.type === 'image') {
              messageType = 'image';
              messageContent = '[Imagem Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'video') {
              messageType = 'video';
              messageContent = '[Vídeo Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'audio') {
              messageType = 'audio';
              messageContent = '[Áudio Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'file') {
              messageType = 'document';
              messageContent = '[Arquivo Instagram]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'share') {
              messageType = 'text';
              messageContent = '[Post compartilhado]';
              mediaUrl = attachment.payload?.url || '';
            } else if (attachment.type === 'story_mention') {
              messageType = 'text';
              messageContent = '[Menção em Story]';
              mediaUrl = attachment.payload?.url || '';
            }
          }
        }
        // Story reply
        else if (messageData.reply_to?.story) {
          messageType = 'text';
          messageContent = `[Resposta ao Story] ${messageData.text || ''}`;
        }
        // Reação
        else if (messageData.reaction) {
          messageType = 'text';
          messageContent = `[Reação: ${messageData.reaction}]`;
        }
        
        messages.push({
          message_id: messageData.mid || `ig_${Date.now()}`,
          from: senderId,
          timestamp: value.timestamp || Math.floor(Date.now() / 1000),
          type: messageType,
          content: messageContent || '[Mensagem Instagram]',
          media_id: mediaUrl,
          contact_name: senderId, // Será atualizado com o username se disponível
          instagram_account_id: instagramAccountId,
          recipient_id: recipientId,
          is_from_me: false,
          source: 'instagram',
        });
      }
    }
    
    // Comments (menções em comentários)
    if (change.field === 'comments') {
      const value = change.value;
      console.log('📸 [INSTAGRAM] Comentário:', JSON.stringify(value, null, 2));
      
      messages.push({
        message_id: value.id || `ig_comment_${Date.now()}`,
        from: value.from?.id || 'unknown',
        timestamp: value.created_time ? new Date(value.created_time).getTime() / 1000 : Math.floor(Date.now() / 1000),
        type: 'text',
        content: `[Comentário] ${value.text || ''}`,
        media_id: null,
        contact_name: value.from?.username || value.from?.id || 'Usuário Instagram',
        instagram_account_id: instagramAccountId,
        is_from_me: false,
        source: 'instagram_comment',
      });
    }
  }
  
  // Também processar messaging diretamente se existir (formato alternativo)
  for (const messaging of entry.messaging || []) {
    console.log('📸 [INSTAGRAM] Messaging direto:', JSON.stringify(messaging, null, 2));
    
    const senderId = messaging.sender?.id;
    const recipientId = messaging.recipient?.id;
    const messageData = messaging.message;
    
    if (messageData && senderId !== recipientId) {
      let messageType = 'text';
      let messageContent = '';
      let mediaUrl = '';
      
      if (messageData.text) {
        messageType = 'text';
        messageContent = messageData.text;
      } else if (messageData.attachments) {
        for (const attachment of messageData.attachments) {
          messageType = attachment.type || 'image';
          messageContent = `[${attachment.type || 'Anexo'} Instagram]`;
          mediaUrl = attachment.payload?.url || '';
        }
      }
      
      messages.push({
        message_id: messageData.mid || `ig_${Date.now()}`,
        from: senderId,
        timestamp: messaging.timestamp || Math.floor(Date.now() / 1000),
        type: messageType,
        content: messageContent || '[Mensagem Instagram]',
        media_id: mediaUrl,
        contact_name: senderId,
        instagram_account_id: instagramAccountId,
        recipient_id: recipientId,
        is_from_me: false,
        source: 'instagram',
      });
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
    
    console.log('🔐 Meta Webhook Verification:', { mode, token, challenge });
    
    // Usar token master global para validação (SaaS multi-tenant)
    const MASTER_VERIFY_TOKEN = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'wazecrm_master_2024';
    
    if (mode === 'subscribe' && token === MASTER_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado com sucesso usando token master global');
      return new Response(challenge, { status: 200 });
    }
    
    console.warn('❌ Falha na verificação do webhook - token inválido');
    console.warn('Token recebido:', token);
    console.warn('Token esperado: [MASTER_TOKEN]');
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
      
      console.log('📨 Meta Webhook - Payload recebido');
      
      const body = JSON.parse(rawBody);
      console.log('📨 Meta Webhook - Object type:', body.object);
      console.log('📨 Meta Webhook - Entry count:', body.entry?.length);

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Processar WhatsApp Business
      if (body.object === 'whatsapp_business_account') {
        console.log('📱 Processando mensagens WhatsApp...');
        
        for (const entry of body.entry || []) {
          const messages = transformWhatsAppPayload(entry);
          
          for (const msg of messages) {
            const { data: connection } = await supabase
              .from('whatsapp_connections')
              .select('company_id, meta_access_token')
              .eq('meta_phone_number_id', msg.phone_number_id)
              .single();
            
            if (!connection) {
              console.warn('❌ Conexão não encontrada para phone_number_id:', msg.phone_number_id);
              continue;
            }

            const company_id = connection.company_id;
            
            let formattedNumber = msg.from.replace(/[^0-9]/g, '');
            if (!formattedNumber.startsWith('55') && formattedNumber.length <= 11) {
              formattedNumber = '55' + formattedNumber;
            }

            const { data: existingLead } = await supabase
              .from('leads')
              .select('id, name, profile_picture_url')
              .eq('company_id', company_id)
              .or(`telefone.ilike.%${formattedNumber}%,phone.ilike.%${formattedNumber}%`)
              .limit(1)
              .single();

            // Se temos foto de perfil do webhook e o lead não tem, atualizar
            if (msg.profile_picture_url && existingLead?.id && !existingLead.profile_picture_url) {
              console.log('📷 Atualizando foto de perfil do lead:', existingLead.id);
              await supabase
                .from('leads')
                .update({ profile_picture_url: msg.profile_picture_url })
                .eq('id', existingLead.id);
            }

            const conversaData = {
              numero: formattedNumber,
              telefone_formatado: formattedNumber,
              mensagem: msg.content,
              tipo_mensagem: msg.type,
              origem: 'WhatsApp Meta',
              status: msg.is_from_me ? 'Enviada' : 'Recebida',
              fromme: msg.is_from_me || false,
              company_id: company_id,
              lead_id: existingLead?.id || null,
              nome_contato: existingLead?.name || msg.contact_name || formattedNumber,
              midia_url: msg.media_url || null,
              arquivo_nome: msg.file_name || null,
              is_group: false,
            };

            console.log('💾 Inserindo conversa WhatsApp Meta:', JSON.stringify(conversaData, null, 2));

            const { error: insertError } = await supabase
              .from('conversas')
              .insert(conversaData);

            if (insertError) {
              console.error('❌ Erro ao inserir conversa WhatsApp:', insertError);
            } else {
              console.log('✅ Conversa WhatsApp inserida com sucesso');
            }
          }
        }
      }
      
      // Processar Instagram
      else if (body.object === 'instagram') {
        console.log('📸 Processando mensagens Instagram...');
        
        for (const entry of body.entry || []) {
          const messages = transformInstagramPayload(entry);
          console.log('📸 Mensagens Instagram transformadas:', messages.length);
          
          for (const msg of messages) {
            // Buscar conexão pelo instagram_account_id
            let connection = null;
            
            // Primeiro tentar pelo instagram_account_id
            if (msg.instagram_account_id) {
              const { data: conn } = await supabase
                .from('whatsapp_connections')
                .select('company_id, instagram_access_token, instagram_username')
                .eq('instagram_account_id', msg.instagram_account_id)
                .single();
              
              connection = conn;
            }
            
            // Se não encontrar, tentar buscar qualquer conexão com Instagram configurado
            if (!connection) {
              const { data: conn } = await supabase
                .from('whatsapp_connections')
                .select('company_id, instagram_access_token, instagram_username')
                .not('instagram_account_id', 'is', null)
                .limit(1)
                .single();
              
              connection = conn;
            }
            
            if (!connection) {
              console.warn('❌ Conexão Instagram não encontrada para account_id:', msg.instagram_account_id);
              continue;
            }

            const company_id = connection.company_id;
            
            // Usar o sender ID como número (Instagram não tem telefone)
            const instagramUserId = msg.from || 'instagram_user';

            // Buscar lead existente pelo Instagram ID ou criar identificador
            const { data: existingLead } = await supabase
              .from('leads')
              .select('id, name')
              .eq('company_id', company_id)
              .or(`telefone.eq.${instagramUserId},phone.eq.${instagramUserId}`)
              .limit(1)
              .single();

            const conversaData = {
              numero: instagramUserId,
              telefone_formatado: instagramUserId,
              mensagem: msg.content,
              tipo_mensagem: msg.type === 'text' ? 'texto' : msg.type,
              origem: 'Instagram',
              status: 'Recebida',
              fromme: false,
              company_id: company_id,
              lead_id: existingLead?.id || null,
              nome_contato: existingLead?.name || msg.contact_name || `Instagram ${instagramUserId}`,
              midia_url: msg.media_id || null,
              is_group: false,
            };

            console.log('💾 Inserindo conversa Instagram:', JSON.stringify(conversaData, null, 2));

            const { error: insertError } = await supabase
              .from('conversas')
              .insert(conversaData);

            if (insertError) {
              console.error('❌ Erro ao inserir conversa Instagram:', insertError);
            } else {
              console.log('✅ Conversa Instagram inserida com sucesso');
            }
          }
        }
      }
      
      // Processar Page (Facebook Messenger - para futuro)
      else if (body.object === 'page') {
        console.log('📘 Processando mensagens Facebook Messenger (não implementado ainda)...');
      }
      
      else {
        console.log('⚠️ Tipo de objeto não reconhecido:', body.object);
        console.log('📨 Payload completo:', JSON.stringify(body, null, 2));
      }

      return new Response('OK', { status: 200, headers: corsHeaders });
      
    } catch (error) {
      console.error('❌ Meta Webhook - Erro:', error);
      return new Response('OK', { status: 200, headers: corsHeaders });
    }
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders });
});
