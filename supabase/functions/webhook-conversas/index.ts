import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature',
};

// Input validation schemas - more permissive for webhook compatibility
const webhookPayloadSchema = z.object({
  numero: z.string().min(10, 'Número muito curto').max(100, 'Número muito longo'), // Suporta grupos do WhatsApp
  mensagem: z.string().min(1).max(4096, 'Mensagem muito longa'),
  origem: z.string().default('WhatsApp'),
  tipo_mensagem: z.string().default('text'),
  midia_url: z.string().nullable().optional(),
  nome_contato: z.string().max(100).nullable().optional(),
  arquivo_nome: z.string().max(255).nullable().optional(),
  company_id: z.string().uuid().optional()
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
function transformEvolutionPayload(body: any) {
  const data = body.data;
  
  // Extrair número (remover @s.whatsapp.net ou @g.us para grupos)
  const numero = data.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  
  // Extrair mensagem e tipo
  let mensagem = '';
  let tipo_mensagem = 'text';
  let midia_url = null;
  let arquivo_nome = null;
  
  if (data.message.conversation) {
    mensagem = data.message.conversation;
    tipo_mensagem = 'texto';
  } else if (data.message.extendedTextMessage?.text) {
    mensagem = data.message.extendedTextMessage.text;
    tipo_mensagem = 'texto';
  } else if (data.message.imageMessage) {
    const img = data.message.imageMessage;
    mensagem = img.caption || '[Imagem]';
    tipo_mensagem = 'image';
    const base64Content = data.message.base64 || img.base64;
    if (base64Content) {
      const cleanBase64 = base64Content.replace(/^data:.*?;base64,/, '');
      midia_url = `data:${img.mimetype || 'image/jpeg'};base64,${cleanBase64}`;
    } else {
      midia_url = img.url || null;
    }
  } else if (data.message.audioMessage) {
    const audio = data.message.audioMessage;
    mensagem = '[Áudio]';
    tipo_mensagem = 'audio';
    const base64Content = data.message.base64 || audio.base64;
    if (base64Content) {
      const cleanBase64 = base64Content.replace(/^data:.*?;base64,/, '');
      midia_url = `data:${audio.mimetype || 'audio/ogg'};base64,${cleanBase64}`;
    } else {
      midia_url = audio.url || null;
    }
  } else if (data.message.videoMessage) {
    const video = data.message.videoMessage;
    mensagem = video.caption || '[Vídeo]';
    tipo_mensagem = 'video';
    const base64Content = data.message.base64 || video.base64;
    if (base64Content) {
      const cleanBase64 = base64Content.replace(/^data:.*?;base64,/, '');
      midia_url = `data:${video.mimetype || 'video/mp4'};base64,${cleanBase64}`;
    } else {
      midia_url = video.url || null;
    }
  } else if (data.message.documentMessage) {
    const doc = data.message.documentMessage;
    arquivo_nome = doc.fileName || 'arquivo';
    mensagem = `[Documento: ${arquivo_nome}]`;
    tipo_mensagem = 'document';
    const base64Content = data.message.base64 || doc.base64;
    if (base64Content) {
      const cleanBase64 = base64Content.replace(/^data:.*?;base64,/, '');
      midia_url = `data:${doc.mimetype || 'application/pdf'};base64,${cleanBase64}`;
    } else {
      midia_url = doc.url || null;
    }
  } else {
    mensagem = '[Mensagem não suportada]';
    tipo_mensagem = 'text';
  }
  
  return {
    numero,
    mensagem,
    origem: 'WhatsApp',
    tipo_mensagem,
    midia_url,
    nome_contato: data.pushName || 'Desconhecido',
    arquivo_nome
  };
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

    // Extrair nome da instância da URL (ex: ?instance=DO2)
    const url = new URL(req.url);
    const instanceName = url.searchParams.get('instance');
    console.log('📡 Instância identificada:', instanceName || 'não especificada');

    // Get raw body for signature verification
    const rawBody = await req.text();
    let body;
    
    try {
      body = JSON.parse(rawBody);
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
        payload = transformEvolutionPayload(body);
        console.log('✅ Payload transformado');
      } catch (transformError) {
        console.error('❌ Erro ao transformar payload da Evolution API');
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
      
      const { data: whatsappConnection } = await supabase
        .from('whatsapp_connections')
        .select('company_id')
        .eq('instance_name', instanceName)
        .eq('status', 'connected')
        .single();
      
      if (whatsappConnection) {
        companyId = whatsappConnection.company_id;
        console.log('✅ Company encontrada pela instância:', companyId);
      } else {
        console.warn('⚠️ Instância não encontrada ou não conectada:', instanceName);
      }
    }

    // Limpar número para buscar lead (remover caracteres especiais)
    const numeroLimpo = validatedData.numero.replace(/[^0-9]/g, '');
    console.log('🔍 Buscando lead com número:', numeroLimpo);

    // Se temos company_id, buscar lead apenas nessa company
    if (companyId) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, company_id')
        .eq('company_id', companyId)
        .or(`telefone.eq.${numeroLimpo},phone.eq.${numeroLimpo}`)
        .limit(1)
        .single();
      
      if (existingLead) {
        leadId = existingLead.id;
        console.log('📌 Lead encontrado na company:', { leadId, companyId });
      }
    } else {
      // Se não temos company, tentar encontrar lead em qualquer company
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, company_id')
        .or(`telefone.eq.${numeroLimpo},phone.eq.${numeroLimpo}`)
        .limit(1)
        .single();

      if (existingLead) {
        companyId = existingLead.company_id;
        leadId = existingLead.id;
        console.log('📌 Lead encontrado:', { leadId, companyId });
      }
    }

    // Se ainda não encontrou company, buscar a primeira company ativa
    if (!companyId) {
      console.warn('⚠️ Company não identificada - buscando company ativa');
      
      const { data: activeCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('status', 'active')
        .limit(1)
        .single();
      
      if (activeCompany) {
        companyId = activeCompany.id;
        console.log('📌 Usando company ativa do sistema:', companyId);
      } else {
        console.error('❌ Nenhuma company ativa encontrada');
        return new Response(
          JSON.stringify({ 
            error: 'Sistema não configurado - nenhuma empresa ativa',
            code: 'NO_ACTIVE_COMPANY'
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Salvar conversa no Supabase
    const { data, error } = await supabase
      .from('conversas')
      .insert([{
        numero: validatedData.numero,
        mensagem: validatedData.mensagem,
        origem: validatedData.origem,
        status: 'Recebida',
        tipo_mensagem: validatedData.tipo_mensagem,
        midia_url: validatedData.midia_url,
        nome_contato: validatedData.nome_contato,
        arquivo_nome: validatedData.arquivo_nome,
        company_id: companyId,
        lead_id: leadId,
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar conversa:', error);
      
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

    console.log('✅ Conversa salva com sucesso');

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