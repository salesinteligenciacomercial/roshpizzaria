import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Meta API Configuration
const META_API_VERSION = 'v18.0';
const META_API_BASE_URL = 'https://graph.facebook.com';

// Input validation schema
const enviarWhatsAppSchema = z.object({
  numero: z.string().refine((val) => {
    const isDigits = /^[0-9]{10,15}$/.test(val);
    const isGroupJid = /@g\.us$/.test(val);
    const isContactJid = /@s\.whatsapp\.net$/.test(val);
    return isDigits || isGroupJid || isContactJid;
  }, 'Informe dígitos (10-15), JID de contato @s.whatsapp.net ou grupo @g.us'),
  mensagem: z.string().max(4096, 'Mensagem muito longa').optional(),
  tipo_mensagem: z.enum(['text', 'texto', 'image', 'audio', 'video', 'document', 'pdf']).optional(),
  mediaUrl: z.string().url('URL de mídia inválida').optional(),
  mediaBase64: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  company_id: z.string().uuid('Company ID deve ser UUID válido').optional(),
  quoted: z.object({
    key: z.object({ id: z.string() }),
    message: z.object({ conversation: z.string() })
  }).optional(),
  quotedMessageId: z.string().optional(),
  force_provider: z.enum(['evolution', 'meta']).optional(),
}).refine(data => data.mensagem || data.mediaUrl || data.mediaBase64, {
  message: 'Mensagem, mídia URL ou mídia Base64 é obrigatória'
});

// ============= META API FUNCTIONS =============
async function sendMetaTextMessage(
  phoneNumberId: string, 
  accessToken: string, 
  to: string, 
  text: string
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text }
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Meta API Error:', data);
      return { success: false, provider: 'meta', error: data.error?.message || 'Erro Meta API' };
    }

    console.log("✅ Meta API - Mensagem enviada:", data.messages?.[0]?.id);
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta API Exception:', error);
    return { success: false, provider: 'meta', error: String(error) };
  }
}

async function sendMetaMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'audio' | 'document',
  caption?: string
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
    
    const mediaPayload: any = { link: mediaUrl };
    if (caption && ['image', 'video', 'document'].includes(mediaType)) {
      mediaPayload.caption = caption;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: mediaType,
        [mediaType]: mediaPayload
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Meta API Media Error:', data);
      return { success: false, provider: 'meta', error: data.error?.message || 'Erro Meta API Media' };
    }

    console.log("✅ Meta API - Mídia enviada:", data.messages?.[0]?.id);
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta API Media Exception:', error);
    return { success: false, provider: 'meta', error: String(error) };
  }
}

// ============= EVOLUTION API FUNCTIONS =============
async function sendEvolutionMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  target: string,
  isGroup: boolean,
  validatedData: any
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    let evolutionUrl: string;
    let bodyPayload: any;
    const targetNumber = isGroup ? target : target.replace(/[^0-9]/g, '');

    // Verificar se é mídia (base64, URL) ou texto
    if (validatedData.mediaBase64) {
      let mediaType = validatedData.tipo_mensagem || 'document';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';
      
      if (mediaType === 'audio') {
        evolutionUrl = `${baseUrl}/message/sendWhatsAppAudio/${instanceName}`;
        bodyPayload = {
          number: targetNumber,
          audio: validatedData.mediaBase64,
          delay: 1200,
        };
      } else {
        evolutionUrl = `${baseUrl}/message/sendMedia/${instanceName}`;
        
        let mimeType = validatedData.mimeType;
        if (!mimeType) {
          const fileName = validatedData.fileName?.toLowerCase() || '';
          if (mediaType === 'image') {
            mimeType = fileName.endsWith('.png') ? 'image/png' : 
                      fileName.endsWith('.gif') ? 'image/gif' : 
                      fileName.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
          } else if (mediaType === 'video') {
            mimeType = 'video/mp4';
          } else {
            mimeType = fileName.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
          }
        }
        
        bodyPayload = {
          number: targetNumber,
          mediatype: mediaType,
          mimetype: mimeType,
          caption: validatedData.caption || validatedData.mensagem || '',
          fileName: validatedData.fileName || 'arquivo',
          media: validatedData.mediaBase64,
        };
      }
    } else if (validatedData.mediaUrl) {
      evolutionUrl = `${baseUrl}/message/sendMedia/${instanceName}`;
      let mediaType = validatedData.tipo_mensagem || 'image';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';
      
      bodyPayload = {
        number: targetNumber,
        mediatype: mediaType,
        media: validatedData.mediaUrl,
        caption: validatedData.mensagem || validatedData.caption || ""
      };
    } else {
      evolutionUrl = `${baseUrl}/message/sendText/${instanceName}`;
      bodyPayload = {
        number: targetNumber,
        text: validatedData.mensagem,
        ...(validatedData.quoted ? { options: { quoted: validatedData.quoted } } : {}),
      };
    }

    console.log("📤 Evolution API - Enviando para:", evolutionUrl);
    
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(bodyPayload),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Evolution API Error:", data);
      return { success: false, provider: 'evolution', error: data.response?.message?.[0] || 'Erro Evolution API' };
    }

    console.log("✅ Evolution API - Mensagem enviada");
    return { success: true, provider: 'evolution', data };
  } catch (error) {
    console.error('Evolution API Exception:', error);
    return { success: false, provider: 'evolution', error: String(error) };
  }
}

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate input
    let validatedData;
    try {
      validatedData = enviarWhatsAppSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Dados inválidos:", error.errors);
        return new Response(
          JSON.stringify({ error: 'Dados inválidos', code: 'VALIDATION_ERROR', details: error.errors }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    console.log("📨 Pedido de envio validado para:", validatedData.numero);

    // Environment variables
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "";
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar conexão WhatsApp da company
    if (!validatedData.company_id) {
      return new Response(
        JSON.stringify({ error: "company_id é obrigatório", code: "NO_COMPANY_ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('company_id', validatedData.company_id)
      .eq('status', 'connected')
      .single();

    if (connError || !connection) {
      console.error("❌ Conexão não encontrada:", connError);
      return new Response(
        JSON.stringify({ error: "Nenhuma conexão WhatsApp ativa", code: "NO_WHATSAPP_CONNECTION" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determinar provider a usar
    const apiProvider = validatedData.force_provider || connection.api_provider || 'evolution';
    const isGroup = /@g\.us$/.test(validatedData.numero);
    
    // Formatar número para Meta API (adicionar código do país)
    let formattedNumber = validatedData.numero.replace(/[^0-9]/g, '');
    if (!formattedNumber.startsWith('55') && formattedNumber.length <= 11) {
      formattedNumber = '55' + formattedNumber;
    }

    console.log("🔀 Router - Provider:", apiProvider, "| Grupo:", isGroup);

    // ============= ROTEAMENTO DE MENSAGENS =============
    let result: { success: boolean; provider: string; data?: any; error?: string };

    // Meta API não suporta grupos - usar Evolution automaticamente
    if (isGroup) {
      console.log("📱 Grupo detectado - Usando Evolution API (Meta não suporta grupos)");
      const baseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
      const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;
      
      if (!baseUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: "Evolution API não configurada para grupos", code: "NO_EVOLUTION_CONFIG" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      result = await sendEvolutionMessage(
        baseUrl.replace(/\/$/, ''),
        connection.instance_name,
        apiKey,
        validatedData.numero,
        true,
        validatedData
      );
    }
    // Meta API
    else if (apiProvider === 'meta' || apiProvider === 'both') {
      const hasMetaCredentials = connection.meta_phone_number_id && connection.meta_access_token;
      const hasEvolutionConfig = (connection.evolution_api_url || EVOLUTION_API_URL) && 
                                  (connection.evolution_api_key || EVOLUTION_API_KEY);
      
      // ⚠️ Meta API não suporta base64 - forçar fallback para Evolution quando tem mediaBase64
      if (validatedData.mediaBase64 && hasEvolutionConfig) {
        console.log("📤 Base64 detectado - Meta API não suporta, usando Evolution API...");
        const baseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
        const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;
        
        result = await sendEvolutionMessage(
          baseUrl.replace(/\/$/, ''),
          connection.instance_name,
          apiKey,
          validatedData.numero,
          false,
          validatedData
        );
      }
      else if (hasMetaCredentials) {
        console.log("📘 Tentando Meta API...");
        
        if (validatedData.mediaUrl) {
          let mediaType = validatedData.tipo_mensagem || 'image';
          if (mediaType === 'texto') mediaType = 'text';
          if (mediaType === 'pdf') mediaType = 'document';
          
          result = await sendMetaMediaMessage(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            formattedNumber,
            validatedData.mediaUrl,
            mediaType as 'image' | 'video' | 'audio' | 'document',
            validatedData.mensagem || validatedData.caption
          );
        } else if (validatedData.mensagem) {
          result = await sendMetaTextMessage(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            formattedNumber,
            validatedData.mensagem
          );
        } else {
          // Sem mensagem nem mídia válida
          console.log("⚠️ Sem mensagem nem mídia URL");
          result = { success: false, provider: 'meta', error: 'Mensagem ou mídia URL é obrigatória' };
        }

        // Fallback para Evolution se Meta falhar e provider for "both"
        if (!result.success && apiProvider === 'both' && hasEvolutionConfig) {
          console.log("🔄 Meta falhou, tentando Evolution como fallback...");
          const baseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
          const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;
          
          result = await sendEvolutionMessage(
            baseUrl.replace(/\/$/, ''),
            connection.instance_name,
            apiKey,
            validatedData.numero,
            false,
            validatedData
          );
        }
      } else if (apiProvider === 'both' && hasEvolutionConfig) {
        // Sem credenciais Meta mas provider é "both" - usar Evolution
        console.log("⚠️ Sem credenciais Meta - usando Evolution");
        const baseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
        const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;
        
        result = await sendEvolutionMessage(
          baseUrl.replace(/\/$/, ''),
          connection.instance_name,
          apiKey,
          validatedData.numero,
          false,
          validatedData
        );
      } else {
        return new Response(
          JSON.stringify({ error: "Credenciais Meta não configuradas e Evolution indisponível", code: "NO_API_CREDENTIALS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Evolution API
    else {
      console.log("📗 Usando Evolution API...");
      const baseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
      const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;
      
      if (!baseUrl || !apiKey) {
        return new Response(
          JSON.stringify({ error: "Evolution API não configurada", code: "NO_EVOLUTION_CONFIG" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      result = await sendEvolutionMessage(
        baseUrl.replace(/\/$/, ''),
        connection.instance_name,
        apiKey,
        validatedData.numero,
        false,
        validatedData
      );
    }

    // ============= RESPOSTA =============
    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          provider: result.provider,
          message_id: result.data?.messages?.[0]?.id || result.data?.key?.id,
          data: result.data 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      return new Response(
        JSON.stringify({ 
          error: result.error || "Falha ao enviar mensagem",
          provider: result.provider,
          code: "SEND_FAILED"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: unknown) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});