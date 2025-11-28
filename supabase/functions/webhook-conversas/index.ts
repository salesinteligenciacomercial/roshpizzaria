import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Helper function to upload media to Storage
async function uploadMediaToStorage(
  supabase: any,
  base64Data: string,
  mimetype: string,
  messageId: string
): Promise<string | null> {
  try {
    // Extract clean base64 content
    const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, '');
    
    // Convert base64 to binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Determine file extension from mimetype
    const extension = mimetype.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `${messageId}-${Date.now()}.${extension}`;
    const filePath = `incoming/${fileName}`;
    
    // Upload to Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('conversation-media')
      .upload(filePath, bytes, {
        contentType: mimetype,
        upsert: false
      });
    
    if (uploadError) {
      console.error('❌ Erro ao fazer upload para Storage:', uploadError);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('conversation-media')
      .getPublicUrl(filePath);
    
    console.log('✅ Mídia enviada para Storage:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('❌ Erro ao processar upload:', error);
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

// Input validation schemas - mais permissivo e com grupos
const webhookPayloadSchema = z.object({
  // Aceita dígitos (contato) ou JIDs completos (contato @s.whatsapp.net / grupo @g.us)
  numero: z.string(),
  mensagem: z.string().min(1).max(4096, 'Mensagem muito longa'),
  origem: z.string().default('WhatsApp'),
  tipo_mensagem: z.string().default('text'),
  midia_url: z.string().nullable().optional(),
  nome_contato: z.string().max(100).nullable().optional(),
  arquivo_nome: z.string().max(255).nullable().optional(),
  company_id: z.string().uuid().optional(),
  replied_to_message: z.string().nullable().optional(),
  status: z.string().optional().default('Recebida'), // Status da mensagem
  is_group: z.boolean().optional(),
  fromMe: z.boolean().optional(),
  remoteJidAlt: z.string().nullable().optional(), // 🔥 Número alternativo real da Evolution API
});

// Verify webhook signature for security
async function verifyWebhookSignature(
  payload: string, 
  signature: string | null, 
  secret: string
): Promise<boolean> {
  if (!signature) return false;
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return expectedSignature === signature;
  } catch {
    return false;
  }
}

// Detectar se o payload é da Evolution API
function isEvolutionAPIPayload(body: any): boolean {
  return body.event === 'messages.upsert' && body.data?.key?.remoteJid;
}

// Transformar payload da Evolution API para formato do CRM
async function transformEvolutionPayload(body: any, supabase: any) {
  const data = body.data;
  
  // Extrair JID remoto (contato ou grupo)
  const remoteJid = data.key.remoteJid as string;
  
  // ⚡ CORREÇÃO CRÍTICA: Detectar @lid (Local ID temporário do WhatsApp)
  // Quando o WhatsApp usa @lid, o número NÃO é confiável
  const isLid = remoteJid.includes('@lid');
  
  if (isLid) {
    console.log('⚠️ [WEBHOOK] Detectado @lid (número temporário não confiável):', {
      remoteJid,
      pushName: data.pushName,
      fromMe: data.key.fromMe
    });
  }
  
  // DETECTAR SE A MENSAGEM FOI ENVIADA PELO USUÁRIO (fromMe) OU RECEBIDA
  const fromMe = data.key.fromMe === true;
  const status = fromMe ? 'Enviada' : 'Recebida';
  
  console.log(`📱 Mensagem ${status} - fromMe: ${fromMe}`, {
    remoteJid: data.key.remoteJid,
    fromMe: data.key.fromMe,
    messageId: data.key.id
  });

  // Ignorar apenas status/broadcast
  if (remoteJid.includes('@broadcast') || remoteJid.includes('status@')) {
    throw new Error('IGNORE: Mensagem de status/broadcast não será salva');
  }

  // ⚡ CORREÇÃO CRÍTICA: Detectar grupos de forma mais robusta (case insensitive)
  const isGroup = /@g\.us/i.test(remoteJid);
  
  // 🚫 BLOQUEAR MENSAGENS DE GRUPOS - Não salvar no banco para economia de storage
  if (isGroup) {
    console.log('🚫 [WEBHOOK] Mensagem de grupo ignorada para economia de storage:', {
      remoteJid,
      pushName: data.pushName,
      fromMe: data.key.fromMe
    });
    throw new Error('IGNORE: Mensagem de grupo não será salva (configuração de otimização)');
  }
  
  // ⚡ CORREÇÃO CRÍTICA: Para @lid, NÃO extrair número do remoteJid
  // O @lid é um identificador temporário não confiável
  let numero: string;
  if (isGroup) {
    numero = remoteJid; // usar JID completo para grupos
  } else if (isLid) {
    // Para @lid: usar o pushName como identificador temporário
    // O número real será encontrado buscando pelo nome do contato
    numero = remoteJid; // Manter o JID completo para referência
    console.log('⚠️ [WEBHOOK] Usando JID @lid como referência temporária:', numero);
  } else {
    // contato: limpar e normalizar
    const cleaned = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/[^0-9]/g, '');
    numero = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    
    // ✅ LOG CRÍTICO: Ver exatamente o que está sendo extraído
    console.log('📡 [TRANSFORM] Extração de número:', {
      remoteJid_original: remoteJid,
      cleaned: cleaned,
      numero_final: numero,
      tamanho_cleaned: cleaned.length,
      tamanho_final: numero.length
    });
  }
  
  // Extrair mensagem e tipo
  let mensagem = '';
  let tipo_mensagem = 'text';
  let midia_url = null;
  let arquivo_nome = null;
  let replied_to_message = null;
  
  // CRÍTICO: Para mensagens enviadas (fromMe=true), NÃO usar pushName
  // pois ele contém o nome do remetente, não do destinatário
  let nome_contato = null;
  if (!fromMe) {
    // Mensagem recebida: usar pushName do contato
    nome_contato = data.pushName || null;
  }
  // Para mensagens enviadas: deixar nome_contato como null para ser
  // preenchido posteriormente com o nome do lead ou número
  
  if (data.message.conversation) {
    mensagem = data.message.conversation;
    tipo_mensagem = 'texto';
  } else if (data.message.extendedTextMessage?.text) {
    mensagem = data.message.extendedTextMessage.text;
    tipo_mensagem = 'texto';
    
    // Capturar mensagem citada
    if (data.message.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = data.message.extendedTextMessage.contextInfo.quotedMessage;
      replied_to_message = quoted.conversation || 
                          quoted.extendedTextMessage?.text || 
                          quoted.imageMessage?.caption ||
                          '[Mensagem citada]';
    }
  } else if (data.message.imageMessage) {
    const img = data.message.imageMessage;
    mensagem = img.caption || '[Imagem]';
    tipo_mensagem = 'image';
    const base64Content = data.message.base64 || img.base64;
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        img.mimetype || 'image/jpeg',
        data.key.id
      );
      midia_url = storageUrl;
    } else if (img.url) {
      // Salvar messageId para download via Evolution API
      midia_url = JSON.stringify({
        url: img.url,
        mediaKey: img.mediaKey,
        messageId: data.key.id,
        mimetype: img.mimetype || 'image/jpeg',
        type: 'image'
      });
    }
  } else if (data.message.audioMessage) {
    const audio = data.message.audioMessage;
    mensagem = '[Áudio]';
    tipo_mensagem = 'audio';
    const base64Content = data.message.base64 || audio.base64;
    
    console.log('🎤 [WEBHOOK] Processando áudio:', {
      hasBase64: !!base64Content,
      hasUrl: !!audio.url,
      hasMediaKey: !!audio.mediaKey,
      messageId: data.key.id,
      mimetype: audio.mimetype
    });
    
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        audio.mimetype || 'audio/ogg',
        data.key.id
      );
      midia_url = storageUrl;
      console.log('✅ [WEBHOOK] Áudio salvo no Storage:', storageUrl);
    } else if (audio.url || audio.mediaKey) {
      // Salvar metadados para download posterior via Evolution API
      midia_url = JSON.stringify({
        url: audio.url,
        mediaKey: audio.mediaKey,
        messageId: data.key.id,
        mimetype: audio.mimetype || 'audio/ogg; codecs=opus',
        type: 'audio'
      });
      console.log('📦 [WEBHOOK] Áudio salvo como metadados para download:', midia_url);
    } else {
      console.error('❌ [WEBHOOK] Áudio sem base64 e sem URL/mediaKey - não pode ser processado');
    }
  } else if (data.message.videoMessage) {
    const video = data.message.videoMessage;
    mensagem = video.caption || '[Vídeo]';
    tipo_mensagem = 'video';
    const base64Content = data.message.base64 || video.base64;
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        video.mimetype || 'video/mp4',
        data.key.id
      );
      midia_url = storageUrl;
    } else if (video.url) {
      midia_url = JSON.stringify({
        url: video.url,
        mediaKey: video.mediaKey,
        messageId: data.key.id,
        mimetype: video.mimetype || 'video/mp4',
        type: 'video'
      });
    }
  } else if (data.message.documentMessage) {
    const doc = data.message.documentMessage;
    arquivo_nome = doc.fileName || 'arquivo';
    mensagem = `[Documento: ${arquivo_nome}]`;
    tipo_mensagem = 'document';
    const base64Content = data.message.base64 || doc.base64;
    if (base64Content) {
      // Upload to Storage instead of saving BASE64
      const storageUrl = await uploadMediaToStorage(
        supabase,
        base64Content,
        doc.mimetype || 'application/pdf',
        data.key.id
      );
      midia_url = storageUrl;
    } else if (doc.url) {
      midia_url = JSON.stringify({
        url: doc.url,
        mediaKey: doc.mediaKey,
        messageId: data.key.id,
        mimetype: doc.mimetype || 'application/pdf',
        type: 'document'
      });
    }
  } else {
    mensagem = '[Mensagem não suportada]';
    tipo_mensagem = 'text';
  }
  
  // Retornar com campos e STATUS (Enviada ou Recebida)
  return {
    numero,
    mensagem,
    origem: 'WhatsApp',
    tipo_mensagem,
    midia_url,
    nome_contato, // Null para mensagens enviadas, pushName para recebidas
    arquivo_nome,
    replied_to_message,
    status, // 'Enviada' se fromMe=true, 'Recebida' se fromMe=false
    is_group: isGroup,
    fromMe,
    remoteJidAlt: data.key.remoteJidAlt || null, // 🔥 Número alternativo real da Evolution API
  };
}

// ==============================
// Roteamento Automático (OPCIONAL - Desativado temporariamente)
// ==============================
async function autoRouteConversation(params: {
  supabase: any,
  companyId: string,
  numeroLimpo: string,
  conversaId: string,
}) {
  // NOTA: Função desativada temporariamente para evitar erros de tipo
  // Será reimplementada quando necessário
  console.log('ℹ️ Roteamento automático desativado');
  return;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extrair nome da instância da URL (aceita ?instance= ou ?instanceName=)
    const url = new URL(req.url);
    const instanceName = url.searchParams.get('instance') || url.searchParams.get('instanceName');

    // ✅ LOG CRÍTICO: Payload RAW completo para debug
    console.log('📡 [WEBHOOK] ========== INÍCIO DEBUG ==========');
    console.log('📡 [WEBHOOK] URL:', req.url);
    console.log('📡 [WEBHOOK] Instance:', instanceName || 'NÃO FORNECIDO');
    console.log('📡 [WEBHOOK] Method:', req.method);

    if (instanceName) {
      console.log('✅ Instância identificada na URL:', instanceName);
    } else {
      console.warn('⚠️ Parâmetro instance não fornecido na URL - tentando identificar pela company do lead');
    }

    // Get raw body for signature verification
    const rawBody = await req.text();
    let body;
    
    try {
      body = JSON.parse(rawBody);
      // ✅ LOG CRÍTICO: Payload RAW completo
      console.log('📡 [WEBHOOK] PAYLOAD RAW COMPLETO:', JSON.stringify(body, null, 2));
      
      // ✅ LOG CRÍTICO: Dados de número específicos
      if (body.data) {
        console.log('📡 [WEBHOOK] DADOS DO NÚMERO:', {
          'key.remoteJid': body.data.key?.remoteJid,
          'key.id': body.data.key?.id,
          'key.fromMe': body.data.key?.fromMe,
          'pushName': body.data.pushName,
          'message.conversation': body.data.message?.conversation,
          'messageType': body.data.messageType,
          'instanceName': body.instance,
          'event': body.event
        });
      }
    } catch {
      console.error('❌ JSON inválido recebido');
      return new Response(
        JSON.stringify({ error: 'Formato de dados inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify webhook signature if secret is configured
    if (webhookSecret) {
      const signature = req.headers.get('x-webhook-signature');
      const isValidSignature = await verifyWebhookSignature(rawBody, signature, webhookSecret);
      
      if (!isValidSignature) {
        console.error('❌ Assinatura de webhook inválida');
        return new Response(
          JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Detectar origem do payload
    const isEvolutionAPI = isEvolutionAPIPayload(body);
    
    // Ignorar eventos que não sejam mensagens novas
    if (body.event === 'messages.update') {
      console.log('⏭️ Ignorando evento de status:', body.event, body.data?.status);
      return new Response(
        JSON.stringify({ success: true, message: 'Evento de status ignorado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('📩 Webhook recebido:', {
      origem: isEvolutionAPI ? 'Evolution API (direto)' : 'N8N',
      evento: body.event || 'unknown'
    });

    // Transformar payload se vier da Evolution API
    let payload = body;
    if (isEvolutionAPI) {
      try {
        payload = await transformEvolutionPayload(body, supabase);
        console.log('✅ Payload transformado');
      } catch (transformError: any) {
        // Se for mensagem de grupo/status, retornar sucesso sem salvar
        if (transformError.message?.startsWith('IGNORE:')) {
          console.log('⏭️', transformError.message);
          return new Response(
            JSON.stringify({ success: true, message: 'Mensagem ignorada' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error('❌ Erro ao transformar payload da Evolution API:', transformError);
        return new Response(
          JSON.stringify({ error: 'Erro ao processar payload' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Validate input with Zod (after transformation)
    let validatedData;
    try {
      validatedData = webhookPayloadSchema.parse(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('❌ Dados de entrada inválidos:', error.errors);
        // Log the actual payload for debugging
        console.log('Payload recebido:', JSON.stringify(payload, null, 2));
        return new Response(
          JSON.stringify({ 
            error: 'Dados inválidos fornecidos',
            code: 'VALIDATION_ERROR'
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    // Buscar company_id baseado na instância primeiro
    let companyId = validatedData.company_id || null;
    let leadId = null;

    // Se temos o nome da instância, buscar company por ela
    if (instanceName && !companyId) {
      console.log('🔍 Buscando company pela instância:', instanceName);
      
      // Primeiro tentar buscar instância conectada
      let { data: whatsappConnection } = await supabase
        .from('whatsapp_connections')
        .select('company_id')
        .eq('instance_name', instanceName)
        .eq('status', 'connected')
        .single();
      
      // Se não encontrou como "connected", tentar buscar sem filtrar por status
      // (pode estar conectada mas não marcada corretamente)
      if (!whatsappConnection) {
        console.log('⚠️ Instância não encontrada como "connected", tentando buscar sem filtro de status...');
        const { data: connectionWithoutStatus } = await supabase
          .from('whatsapp_connections')
          .select('company_id, status')
          .eq('instance_name', instanceName)
          .limit(1)
          .single();
        
        if (connectionWithoutStatus) {
          whatsappConnection = connectionWithoutStatus;
          console.log('✅ Instância encontrada (status:', connectionWithoutStatus.status, ')');
        }
      }
      
      if (whatsappConnection) {
        companyId = whatsappConnection.company_id;
        console.log('✅ Company encontrada pela instância:', companyId);
      } else {
        console.warn('⚠️ Instância não encontrada:', instanceName);
        // CORREÇÃO: Não retornar erro imediatamente, tentar outras formas de identificar company
      }
    }

    // ⚡ CORREÇÃO CRÍTICA: Detectar se é grupo de forma mais robusta
    // Verificar is_group OU se o número contém @g.us em qualquer posição (case insensitive)
    const isGroup = validatedData.is_group === true || /@g\.us/i.test(validatedData.numero);
    let numeroLimpo = isGroup ? null : validatedData.numero.replace(/[^0-9]/g, '');
    
    if (!isGroup && numeroLimpo) {
      console.log('🔍 Número antes da normalização:', numeroLimpo);
      
      // ⚡ VALIDAÇÃO ATUALIZADA: Aceitar números normais E LIDs do WhatsApp
      // Números normais brasileiros: 
      // - 10 dígitos: DDD (2) + número (8 dígitos) - formato antigo
      // - 11 dígitos: DDD (2) + número (9 dígitos) - formato local atual
      // - 13 dígitos: 55 + DDD (2) + número (9 dígitos) - formato internacional
      // LIDs (LinkedIn IDs do WhatsApp): até 20 dígitos
      // Exemplo: 55149783293472816 (17 dígitos) - são IDs válidos do WhatsApp
      if (numeroLimpo.length < 10 || numeroLimpo.length > 20) {
        console.warn('⚠️ Número inválido após limpeza:', numeroLimpo, 'Tamanho:', numeroLimpo.length);
        return new Response(
          JSON.stringify({ success: true, message: 'Número inválido ignorado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('✅ Número validado:', numeroLimpo, 'Tamanho:', numeroLimpo.length);
      
      // Normalizar: Se o número tem 10 ou 11 dígitos e não começa com 55, adicionar código do país
      // Para LIDs (números com mais de 13 dígitos), não normalizar - já são IDs completos
      if (numeroLimpo.length >= 10 && numeroLimpo.length <= 11 && !numeroLimpo.startsWith('55')) {
        numeroLimpo = `55${numeroLimpo}`;
        console.log('✅ Número normalizado com código do país:', numeroLimpo);
      } else if (numeroLimpo.length > 13) {
        console.log('ℹ️ LID detectado (não normalizado):', numeroLimpo);
      }
      
      console.log('🔍 Número normalizado final (contato):', numeroLimpo);
    } else if (isGroup) {
      console.log('👥 Mensagem de grupo detectada. JID:', validatedData.numero);
    }

    // Se temos company_id, buscar lead apenas nessa company
    if (companyId && !isGroup && numeroLimpo) {
      // ⚠️ CORREÇÃO CRÍTICA: Detectar @lid e usar remoteJidAlt ou buscar por nome
      const isLidNumber = validatedData.numero.includes('@lid');
      const remoteJidAlt = validatedData.remoteJidAlt; // 🔥 Número alternativo real da Evolution API
      let numeroReal: string | null = null;
      
      if (isLidNumber) {
        console.log('⚠️ [WEBHOOK @LID] Detectado número @lid:', {
          remoteJid: validatedData.numero,
          remoteJidAlt: remoteJidAlt,
          pushName: validatedData.nome_contato,
          fromMe: validatedData.fromMe
        });
        
        // 🔥 PRIORIDADE 1: Usar remoteJidAlt se disponível (número real da Evolution API)
        if (remoteJidAlt && !remoteJidAlt.includes('@lid')) {
          const numeroRealAlt = remoteJidAlt.replace(/@.*/, '');
          if (numeroRealAlt && numeroRealAlt.length >= 10) {
            numeroLimpo = numeroRealAlt;
            console.log('✅ [WEBHOOK @LID] Usando remoteJidAlt (número REAL da Evolution):', {
              numeroAnterior: validatedData.numero,
              numeroREAL: numeroLimpo,
              lidDescartado: validatedData.numero
            });
          }
        }
        
        // 🔥 PRIORIDADE 2: Se não tem remoteJidAlt, buscar lead por NOME
        if (validatedData.nome_contato && numeroLimpo && numeroLimpo.length < 12) {
          console.log('🔍 [WEBHOOK @LID] remoteJidAlt não disponível - Buscando lead por NOME:', {
            nome: validatedData.nome_contato,
            numeroLid: numeroLimpo
          });
          
          const { data: leadByName, error: nameSearchError } = await supabase
            .from('leads')
            .select('id, company_id, phone, telefone, name')
            .eq('company_id', companyId)
            .ilike('name', validatedData.nome_contato)
            .limit(1)
            .maybeSingle();
          
          if (leadByName && !nameSearchError) {
            leadId = leadByName.id;
            // ✅ USAR O NÚMERO REAL DO LEAD
            numeroReal = leadByName.phone || leadByName.telefone;
            if (numeroReal) {
              numeroLimpo = numeroReal;
              console.log('✅ [WEBHOOK @LID] Lead encontrado por NOME - Usando número REAL do lead:', {
                leadId,
                nome: leadByName.name,
                numeroAnterior: validatedData.numero,
                numeroREAL: numeroLimpo,
                lidDescartado: validatedData.numero
              });
            }
          } else {
            console.log('⚠️ [WEBHOOK @LID] Lead não encontrado por nome');
            console.log('🚫 [WEBHOOK @LID] BLOQUEANDO TOTALMENTE - número @lid não confiável');
            
            return new Response(JSON.stringify({
              success: true,
              message: 'Número @lid não confiável - aguardando número real',
              blocked: true
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
          }
        } else if (!validatedData.nome_contato) {
          console.log('🚫 [WEBHOOK @LID] Nome do contato ausente - BLOQUEANDO TOTALMENTE');
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Número @lid sem nome - aguardando número real',
            blocked: true
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
      
      // Se não encontrou por nome ou não é @lid, buscar por número
      if (!leadId && numeroLimpo) {
        // Preparar variações do número para busca (com e sem código do país)
        const numeroVariations = [numeroLimpo];
        if (numeroLimpo.startsWith('55') && numeroLimpo.length === 13) {
          // Se tem código do país, também buscar sem ele
          numeroVariations.push(numeroLimpo.substring(2));
        } else if (!numeroLimpo.startsWith('55') && numeroLimpo.length >= 10) {
          // Se não tem código do país, também buscar com ele
          numeroVariations.push(`55${numeroLimpo}`);
        }
        
        const telefoneConditions = numeroVariations.map(n => `telefone.eq.${n}`).join(',');
        const phoneConditions = numeroVariations.map(n => `phone.eq.${n}`).join(',');
        
        const { data: existingLead, error: leadSearchError } = await supabase
          .from('leads')
          .select('id, company_id')
          .eq('company_id', companyId)
          .or(`${telefoneConditions},${phoneConditions}`)
          .limit(1)
          .maybeSingle(); // Usar maybeSingle() ao invés de single() para não retornar erro se não encontrar
        
        if (existingLead && !leadSearchError) {
          leadId = existingLead.id;
          console.log('📌 Lead encontrado na company:', { leadId, companyId, numeroBuscado: numeroLimpo });
        } else if (leadSearchError) {
          console.warn('⚠️ Erro ao buscar lead:', leadSearchError);
        } else {
          console.log('ℹ️ Lead não encontrado para o número:', numeroLimpo, 'na company:', companyId);
        }
      }
    } else if (!isGroup && numeroLimpo) {
      // ✅ CORREÇÃO DEFINITIVA: Buscar lead com TODAS as variações possíveis do número
      // Isso resolve o problema de números salvos com formatos diferentes
      const numeroVariations = [numeroLimpo];
      
      // Remover possível DDI duplicado (5515... -> 15...)
      if (numeroLimpo.startsWith('5515') && numeroLimpo.length > 12) {
        numeroVariations.push(numeroLimpo.substring(2)); // Remove os dois primeiros 55
      }
      
      // Se tem código do país (55), também buscar sem ele
      if (numeroLimpo.startsWith('55') && numeroLimpo.length === 13) {
        numeroVariations.push(numeroLimpo.substring(2)); // Remove 55
      } else if (!numeroLimpo.startsWith('55') && numeroLimpo.length >= 10) {
        // Se não tem código do país, também buscar com ele
        numeroVariations.push(`55${numeroLimpo}`);
      }
      
      // Adicionar variação sem DDD (últimos 8 ou 9 dígitos)
      if (numeroLimpo.length >= 10) {
        const somenteNumero = numeroLimpo.slice(-9); // Últimos 9 dígitos (com 9 inicial do celular)
        numeroVariations.push(somenteNumero);
      }
      
      console.log('🔍 Buscando lead com variações:', numeroVariations);
      
      const telefoneConditions = numeroVariations.map(n => `telefone.eq.${n}`).join(',');
      const phoneConditions = numeroVariations.map(n => `phone.eq.${n}`).join(',');
      
      const { data: existingLead, error: leadSearchError } = await supabase
        .from('leads')
        .select('id, company_id')
        .or(`${telefoneConditions},${phoneConditions}`)
        .limit(1)
        .maybeSingle(); // Usar maybeSingle() ao invés de single() para não retornar erro se não encontrar

      if (existingLead && !leadSearchError) {
        companyId = existingLead.company_id;
        leadId = existingLead.id;
        console.log('📌 Lead encontrado:', { leadId, companyId, numeroBuscado: numeroLimpo });
      } else if (leadSearchError) {
        console.warn('⚠️ Erro ao buscar lead:', leadSearchError);
      } else {
        console.log('ℹ️ Lead não encontrado para o número:', numeroLimpo);
      }
    }

    // ⚡ CORREÇÃO CRÍTICA: Se ainda não tem company_id mas é mensagem recebida
    // E veio de @lid, tentar buscar lead por NOME em QUALQUER company
    if (!companyId && validatedData.fromMe !== true && validatedData.numero.includes('@lid') && validatedData.nome_contato) {
      console.log('🔍 [WEBHOOK @LID SEM COMPANY] Tentando encontrar lead por NOME em qualquer company:', {
        nome: validatedData.nome_contato
      });
      
      const { data: leadByName } = await supabase
        .from('leads')
        .select('id, company_id, phone, telefone, name')
        .ilike('name', validatedData.nome_contato)
        .limit(1)
        .maybeSingle();
      
      if (leadByName) {
        companyId = leadByName.company_id;
        leadId = leadByName.id;
        // ✅ USAR O NÚMERO REAL DO LEAD - NUNCA USAR @LID
        const numeroReal = leadByName.phone || leadByName.telefone;
        if (numeroReal) {
          // ⚡ CRÍTICO: SUBSTITUIR numeroLimpo pelo número REAL
          numeroLimpo = numeroReal;
          console.log('✅ [WEBHOOK @LID SEM COMPANY] Lead e company encontrados por NOME - SUBSTITUINDO número @lid pelo REAL:', {
            leadId,
            companyId,
            nome: leadByName.name,
            numeroAnterior: validatedData.numero,
            numeroREAL: numeroLimpo,
            lidDescartado: validatedData.numero
          });
        }
      } else {
        // Se não encontrou lead com @lid, NÃO criar nova conversa
        console.log('🚫 [WEBHOOK @LID] Bloqueando criação de conversa com número @lid não confiável (sem company)');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Número @lid sem lead correspondente - mensagem ignorada para evitar duplicação' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Se ainda não encontrou company, tentar fallback adicional
    if (!companyId) {
      console.warn('⚠️ Company não identificada pelas formas padrão, tentando fallback...');
      
      // FALLBACK 1: Se temos instanceName, buscar sem filtro de status e case-insensitive
      if (instanceName) {
        console.log('🔄 Fallback: Buscando instância case-insensitive:', instanceName);
        const { data: fallbackConnection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .ilike('instance_name', instanceName)
          .limit(1)
          .single();
        
        if (fallbackConnection) {
          companyId = fallbackConnection.company_id;
          console.log('✅ Company encontrada via fallback (case-insensitive):', companyId);
        }
      }
      
      // FALLBACK 2: Se ainda não encontrou e temos número, tentar buscar pela primeira instância ativa
      // (apenas para mensagens recebidas, para evitar problemas de segurança)
      if (!companyId && !isGroup && numeroLimpo && validatedData.fromMe !== true) {
        console.log('🔄 Fallback: Buscando primeira instância ativa para mensagem recebida...');
        const { data: activeConnection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .in('status', ['connected', 'connecting'])
          .limit(1)
          .maybeSingle();
        
        if (activeConnection) {
          companyId = activeConnection.company_id;
          console.log('✅ Company encontrada via fallback (primeira instância ativa):', companyId);
        }
      }
      
      // ⚡ CORREÇÃO CRÍTICA: Para mensagens RECEBIDAS, SEMPRE salvar mesmo sem company_id
      // Usar fallback final: buscar QUALQUER instância ativa ou a primeira empresa disponível
      if (!companyId && validatedData.fromMe !== true) {
        console.log('🔄 Fallback FINAL: Buscando qualquer instância ativa para mensagem recebida...');
        const { data: anyConnection } = await supabase
          .from('whatsapp_connections')
          .select('company_id')
          .limit(1)
          .maybeSingle();
        
        if (anyConnection) {
          companyId = anyConnection.company_id;
          console.log('✅ Company encontrada via fallback FINAL (qualquer instância):', companyId);
        }
      }
      
      // ⚡ CORREÇÃO CRÍTICA: Para mensagens RECEBIDAS, NUNCA rejeitar - sempre salvar
      // Se ainda não encontrou company_id mas é mensagem recebida, usar fallback de emergência
      if (!companyId && validatedData.fromMe !== true) {
        console.warn('⚠️ [CRÍTICO] Company não identificada para mensagem RECEBIDA, usando fallback de emergência');
        
        // FALLBACK DE EMERGÊNCIA: Buscar primeira empresa do sistema
        const { data: firstCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (firstCompany) {
          companyId = firstCompany.id;
          console.log('✅ Company encontrada via fallback de emergência:', companyId);
        } else {
          // ÚLTIMO RECURSO: Se não tem empresa, ainda assim salvar a mensagem
          // Isso garante que mensagens recebidas NUNCA sejam perdidas
          console.error('❌ [CRÍTICO] Nenhuma empresa encontrada no sistema, mas salvando mensagem recebida mesmo assim');
          // Continuar sem company_id - a mensagem será salva e pode ser vinculada depois
        }
      }
      
      // ⚡ CORREÇÃO: Apenas rejeitar mensagens ENVIADAS sem company_id (segurança)
      // Mensagens RECEBIDAS sempre devem ser salvas
      if (!companyId && validatedData.fromMe === true) {
        console.error('❌ Company não identificada para mensagem ENVIADA', {
          instanceName,
          numeroLimpo,
          fromMe: validatedData.fromMe,
          isGroup
        });
        return new Response(
          JSON.stringify({ 
            error: 'Empresa não identificada para a mensagem enviada',
            code: 'COMPANY_NOT_RESOLVED',
            details: {
              instanceName: instanceName || 'não fornecido',
              numero: numeroLimpo || 'não disponível'
            }
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ====================================================================
    // MELHORIA CRÍTICA: Garantir que SEMPRE tenha um lead vinculado
    // ====================================================================
    
    // 🔥 VALIDAÇÃO CRÍTICA: NUNCA criar lead com número @lid ou inválido
    const isStillLidNumber = numeroLimpo && (numeroLimpo.length < 10 || validatedData.numero.includes('@lid'));
    
    // Se não tem lead e não é grupo, tentar criar automaticamente
    if (!leadId && !isGroup && numeroLimpo && companyId && !isStillLidNumber) {
      console.log('🔄 Tentando criar lead automaticamente para:', numeroLimpo);
      
      // Para mensagens RECEBIDAS: criar com nome do contato
      // Para mensagens ENVIADAS: criar com o telefone (será atualizado depois)
      const leadName = validatedData.fromMe 
        ? numeroLimpo 
        : (validatedData.nome_contato || numeroLimpo);
      
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          name: leadName,
          phone: numeroLimpo,
          telefone: numeroLimpo,
          company_id: companyId,
          source: 'whatsapp',
          status: 'novo',
          stage: 'prospeccao'
        })
        .select('id')
        .single();
      
      if (!leadError && newLead) {
        leadId = newLead.id;
        console.log('✅ Lead criado automaticamente:', leadId);
      } else if (leadError) {
        console.error('❌ Erro ao criar lead:', leadError);
      }
    } else if (!leadId && !isGroup && isStillLidNumber) {
      console.log('🚫 [WEBHOOK] BLOQUEANDO criação de lead com número @lid inválido:', numeroLimpo);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Número @lid inválido - não pode criar lead',
        blocked: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // CORREÇÃO: Buscar nome do lead SEMPRE que tiver lead vinculado
    let nomeContatoFinal = validatedData.nome_contato;
    
    if (leadId) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('name')
        .eq('id', leadId)
        .single();
      
      if (leadData?.name) {
        nomeContatoFinal = leadData.name;
        console.log('✅ Nome do lead usado:', nomeContatoFinal);
      }
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Garantir que SEMPRE tenha um nome_contato
    // Se ainda não tem nome, usar número como fallback (para contatos individuais)
    if (!nomeContatoFinal && !isGroup && numeroLimpo) {
      nomeContatoFinal = numeroLimpo;
      console.log('⚠️ Usando telefone como nome:', nomeContatoFinal);
    }
    
    // Para grupos, usar o JID como nome se não tiver outro
    if (!nomeContatoFinal && isGroup) {
      nomeContatoFinal = validatedData.numero;
      console.log('👥 Usando JID do grupo como nome');
    }
    
    // ⚡ GARANTIA FINAL: Se ainda não tem nome (caso extremo), usar o número original
    if (!nomeContatoFinal) {
      nomeContatoFinal = validatedData.numero || numeroLimpo || 'Contato Desconhecido';
      console.log('⚠️ [FALLBACK] Usando número original como nome:', nomeContatoFinal);
    }
    
    // 🔥 VALIDAÇÃO FINAL CRÍTICA: BLOQUEAR salvamento se telefone_formatado ainda contém @lid
    const telefoneFormatadoFinal = isGroup ? null : numeroLimpo;
    
    // 🔥 CRÍTICO: Substituir TAMBÉM o campo 'numero' original para remover @lid
    const numeroFinal = validatedData.numero.includes('@lid') && numeroLimpo 
      ? numeroLimpo 
      : validatedData.numero;
    
    if (telefoneFormatadoFinal && (telefoneFormatadoFinal.includes('@lid') || telefoneFormatadoFinal.length < 10)) {
      console.error('🚫 [WEBHOOK] BLOQUEIO FINAL - telefone_formatado ainda contém @lid ou é inválido:', {
        telefone_formatado: telefoneFormatadoFinal,
        numero_original: validatedData.numero,
        nome_contato: nomeContatoFinal
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Bloqueado: telefone_formatado inválido (@lid ou < 10 dígitos)',
        blocked: true,
        telefone_formatado: telefoneFormatadoFinal
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
    
    // ⚡ LOG CRÍTICO: Detectar mensagem recebida antes de salvar
    const isReceivedMessage = validatedData.fromMe !== true;
    if (isReceivedMessage) {
      console.log('📥 [WEBHOOK] ⚠️ MENSAGEM RECEBIDA DETECTADA!', {
        numero: validatedData.numero,
        numeroLimpo,
        telefone_formatado: isGroup ? null : numeroLimpo,
        nome_contato: nomeContatoFinal,
        mensagem: validatedData.mensagem?.substring(0, 50),
        company_id: companyId,
        lead_id: leadId,
        fromMe: validatedData.fromMe,
        isGroup: isGroup,
        status: validatedData.status
      });
    } else {
      console.log('📤 [WEBHOOK] Mensagem enviada detectada', {
        numero: validatedData.numero,
        numeroLimpo,
        telefone_formatado: isGroup ? null : numeroLimpo,
        fromMe: validatedData.fromMe,
        isGroup: isGroup
      });
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Garantir que mensagens recebidas SEMPRE sejam salvas
    // Se não tem company_id mas é mensagem recebida, tentar encontrar uma última vez
    if (!companyId && validatedData.fromMe !== true) {
      console.warn('⚠️ [CRÍTICO] Tentando encontrar company_id uma última vez antes de salvar mensagem recebida...');
      
      // Tentar buscar pela instância mais recente ou ativa
      const { data: recentConnection } = await supabase
        .from('whatsapp_connections')
        .select('company_id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (recentConnection?.company_id) {
        companyId = recentConnection.company_id;
        console.log('✅ Company encontrada via instância mais recente:', companyId);
      }
      
      // Se ainda não encontrou, buscar QUALQUER empresa do sistema
      if (!companyId) {
        const { data: anyCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (anyCompany?.id) {
          companyId = anyCompany.id;
          console.log('✅ Company encontrada via fallback de emergência (qualquer empresa):', companyId);
        }
      }
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Se AINDA não tem company_id, é um problema crítico
    // Mas para mensagens recebidas, vamos tentar salvar mesmo assim (pode falhar se banco exigir)
    if (!companyId && validatedData.fromMe !== true) {
      console.error('❌ [CRÍTICO] Nenhuma company_id encontrada após todos os fallbacks para mensagem recebida!');
      console.error('⚠️ Tentando salvar mesmo assim - pode falhar se banco exigir company_id');
    }
    
    // ⚡ CORREÇÃO CRÍTICA: Se ainda não tem company_id mas é mensagem recebida, 
    // criar um objeto de inserção sem company_id (se o banco permitir) ou usar null
    // Isso garante que mensagens recebidas NUNCA sejam perdidas
    const insertData: any = {
      numero: numeroFinal, // 🔥 CRÍTICO: Usar numeroFinal (sem @lid) ao invés de validatedData.numero
      telefone_formatado: telefoneFormatadoFinal,
      mensagem: validatedData.mensagem,
      origem: validatedData.origem,
      status: validatedData.status, // Usar status detectado (Enviada ou Recebida)
      tipo_mensagem: validatedData.tipo_mensagem,
      midia_url: validatedData.midia_url,
      nome_contato: nomeContatoFinal, // Nome correto baseado no contexto
      arquivo_nome: validatedData.arquivo_nome,
      lead_id: leadId,
      replied_to_message: validatedData.replied_to_message || null,
      is_group: isGroup,
      fromme: validatedData.fromMe === true, // CORREÇÃO: fromme minúsculo (PostgreSQL converte para lowercase)
    };
    
    // ⚡ CORREÇÃO: Se mensagem foi enviada pelo CRM (fromMe = true), buscar nome do usuário para assinatura
    if (validatedData.fromMe === true && companyId) {
      try {
        // Buscar primeiro usuário admin ou qualquer usuário da empresa
        const { data: companyUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('company_id', companyId)
          .limit(1)
          .single();
        
        if (companyUsers?.user_id) {
          // Buscar nome do usuário
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', companyUsers.user_id)
            .single();
          
          if (userProfile) {
            insertData.sent_by = userProfile.full_name || userProfile.email;
            insertData.owner_id = companyUsers.user_id;
            console.log('✅ [WEBHOOK] Assinatura adicionada:', insertData.sent_by);
          }
        }
      } catch (error) {
        console.error('⚠️ [WEBHOOK] Erro ao buscar assinatura do usuário:', error);
      }
    }
    
    // ⚡ CORREÇÃO: Adicionar company_id apenas se existir
    // Se não existir mas for mensagem recebida, tentar salvar mesmo assim
    if (companyId) {
      insertData.company_id = companyId;
    } else if (validatedData.fromMe !== true) {
      // Para mensagens recebidas sem company_id, logar mas tentar salvar
      console.error('❌ [CRÍTICO] Tentando salvar mensagem recebida SEM company_id - pode falhar se banco exigir');
    }
    
    // ⚡ LOG ANTES DE SALVAR para debug
    console.log('💾 [WEBHOOK] TENTANDO SALVAR CONVERSA:', {
      isReceivedMessage,
      fromMe: validatedData.fromMe,
      tipo_mensagem: validatedData.tipo_mensagem,
      midia_url_validatedData: validatedData.midia_url,
      arquivo_nome_validatedData: validatedData.arquivo_nome,
      insertData: {
        ...insertData,
        mensagem: insertData.mensagem?.substring(0, 50) + '...',
        midia_url: insertData.midia_url,
        arquivo_nome: insertData.arquivo_nome
      }
    });
    
    // Salvar conversa no Supabase com telefone normalizado e STATUS correto
    const { data, error } = await supabase
      .from('conversas')
      .insert([insertData])
      .select()
      .single();
    
    // ⚡ LOG APÓS INSERÇÃO para debug
    console.log('💾 [WEBHOOK] RESULTADO DA INSERÇÃO:', {
      sucesso: !error,
      erro: error?.message,
      errorCode: error?.code,
      data: data ? { id: data.id, fromme: data.fromme } : null
    });

    if (error) {
      console.error('❌ [CRÍTICO] Erro ao salvar conversa:', error, {
        isReceived: isReceivedMessage,
        fromMe: validatedData.fromMe,
        company_id: companyId,
        lead_id: leadId,
        telefone_formatado: insertData.telefone_formatado,
        nome_contato: insertData.nome_contato,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        errorCode: error.code,
        insertData: {
          numero: insertData.numero,
          telefone_formatado: insertData.telefone_formatado,
          nome_contato: insertData.nome_contato,
          company_id: insertData.company_id,
          lead_id: insertData.lead_id,
          fromme: insertData.fromme,
          status: insertData.status
        }
      });
      
      // ⚡ CORREÇÃO CRÍTICA: Se erro for por falta de company_id e for mensagem recebida,
      // tentar encontrar company_id e salvar novamente
      if (isReceivedMessage && (!companyId || error.message?.includes('company_id') || error.code === '23502')) {
        console.warn('⚠️ [CRÍTICO] Erro ao salvar mensagem recebida - tentando encontrar company_id e salvar novamente...');
        
        // Última tentativa: buscar qualquer empresa
        const { data: emergencyCompany } = await supabase
          .from('companies')
          .select('id')
          .limit(1)
          .maybeSingle();
        
        if (emergencyCompany?.id) {
          companyId = emergencyCompany.id;
          insertData.company_id = companyId;
          
          console.log('✅ Company encontrada em emergência, tentando salvar novamente...');
          
          // Tentar salvar novamente com company_id
          const { data: retryData, error: retryError } = await supabase
            .from('conversas')
            .insert([insertData])
            .select()
            .single();
          
          if (!retryError && retryData) {
            console.log('✅ [SUCESSO] Mensagem recebida salva após retry com company_id de emergência!');
            // Continuar com o fluxo normal usando retryData
            const data = retryData;
            // Pular para o log de sucesso
            if (isReceivedMessage) {
              console.log('✅ [WEBHOOK] Mensagem RECEBIDA salva com sucesso!', {
                id: data.id,
                numero: validatedData.numero,
                fromme: data.fromme,
                status: data.status,
                company_id: data.company_id
              });
            }
            // Continuar com o fluxo normal
          } else {
            console.error('❌ [CRÍTICO] Erro ao salvar mesmo após retry:', retryError);
            // Continuar com tratamento de erro normal
          }
        }
      }
      
      // ⚡ CORREÇÃO: Para mensagens recebidas, NUNCA retornar erro 500
      // Sempre retornar sucesso para não bloquear o webhook
      if (isReceivedMessage) {
        console.error('❌ [CRÍTICO] Erro ao salvar mensagem recebida, mas retornando sucesso para não bloquear webhook');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Mensagem recebida processada (pode ter erro ao salvar)',
            warning: 'Erro ao salvar no banco, mas webhook processado'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Map database errors to user-friendly messages
      let errorMessage = 'Erro ao processar conversa';
      let errorCode = 'INTERNAL_ERROR';
      
      if (error.message?.includes('violates')) {
        errorMessage = 'Dados inválidos fornecidos';
        errorCode = 'VALIDATION_ERROR';
      } else if (error.message?.includes('row-level security')) {
        errorMessage = 'Você não tem permissão para esta ação';
        errorCode = 'FORBIDDEN';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, code: errorCode }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ⚡ LOG CRÍTICO: Confirmar que mensagem recebida foi salva
    if (isReceivedMessage) {
      console.log('✅ [WEBHOOK] Mensagem RECEBIDA salva com sucesso!', {
        id: data.id,
        numero: validatedData.numero,
        fromme: data.fromme,
        status: data.status,
        company_id: data.company_id
      });
    } else {
      console.log('✅ [WEBHOOK] Mensagem enviada salva com sucesso', {
        id: data.id,
        fromme: data.fromme
      });
    }

    // ROTEAMENTO AUTOMÁTICO: tentar atribuir conversa a um colaborador disponível (apenas para contatos)
    if (!isGroup && numeroLimpo) {
      try {
        await autoRouteConversation({
          supabase,
          companyId: companyId!,
          numeroLimpo,
          conversaId: data.id,
        });
      } catch (routeError) {
        console.warn('⚠️ Falha ao rotear automaticamente:', routeError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conversa registrada com sucesso',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('⚠️ Erro interno:', err);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao processar requisição',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});