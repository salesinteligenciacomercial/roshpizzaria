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
  mensagem: z.string().max(65536, 'Mensagem muito longa').optional(),
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
  // Template support for Meta API (required for first message / mass dispatch)
  template_name: z.string().optional(),
  template_language: z.string().optional(),
  template_components: z.array(z.any()).optional(),
}).refine(data => data.mensagem || data.mediaUrl || data.mediaBase64 || data.template_name, {
  message: 'Mensagem, mídia URL, mídia Base64 ou template é obrigatório'
});

// Send template message via Meta API
async function sendMetaTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  language: string = 'pt_BR',
  components?: any[]
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
    
    const templatePayload: any = {
      name: templateName,
      language: { code: language },
    };
    
    if (components && components.length > 0) {
      templatePayload.components = components;
    }

    console.log("📤 Meta API - Enviando template:", templateName);
    
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
        type: 'template',
        template: templatePayload
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Meta API Template Error:', data);
      return { success: false, provider: 'meta', error: data.error?.message || 'Erro ao enviar template Meta API' };
    }

    console.log("✅ Meta API - Template enviado:", data.messages?.[0]?.id);
    return { success: true, provider: 'meta', data };
  } catch (error) {
    console.error('Meta API Template Exception:', error);
    return { success: false, provider: 'meta', error: String(error) };
  }
}

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

// Upload media to Meta API and get media_id
async function uploadMetaMedia(
  phoneNumberId: string,
  accessToken: string,
  base64Data: string,
  mimeType: string,
  fileName: string
): Promise<{ success: boolean; media_id?: string; error?: string }> {
  try {
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Convert base64 to binary
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create form data for upload
    const formData = new FormData();
    const blob = new Blob([bytes], { type: mimeType });
    formData.append('file', blob, fileName);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);
    
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/media`;
    
    console.log("📤 Meta API - Uploading media:", fileName, mimeType);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Meta API Upload Error:', data);
      return { success: false, error: data.error?.message || 'Erro upload mídia Meta API' };
    }

    console.log("✅ Meta API - Media uploaded:", data.id);
    return { success: true, media_id: data.id };
  } catch (error) {
    console.error('Meta API Upload Exception:', error);
    return { success: false, error: String(error) };
  }
}

// Send media using media_id (uploaded) or URL
async function sendMetaMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  mediaUrlOrId: string,
  mediaType: 'image' | 'video' | 'audio' | 'document',
  caption?: string,
  isMediaId: boolean = false
): Promise<{ success: boolean; provider: string; data?: any; error?: string }> {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/messages`;
    
    // Use 'id' for uploaded media or 'link' for URL
    const mediaPayload: any = isMediaId ? { id: mediaUrlOrId } : { link: mediaUrlOrId };
    if (caption && ['image', 'video', 'document'].includes(mediaType)) {
      mediaPayload.caption = caption;
    }
    // For audio, add filename if document
    if (mediaType === 'document' && !mediaPayload.filename) {
      mediaPayload.filename = 'documento';
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
      
      // ⚠️ Meta API com base64 - tentar upload para Meta, fallback para Evolution
      if (validatedData.mediaBase64 && hasMetaCredentials) {
        console.log("📤 Base64 detectado - Tentando upload para Meta API...");
        
        let mediaType = validatedData.tipo_mensagem || 'document';
        if (mediaType === 'texto') mediaType = 'text';
        if (mediaType === 'pdf') mediaType = 'document';
        
        const mimeType = validatedData.mimeType || 'application/octet-stream';
        const fileName = validatedData.fileName || 'arquivo';
        
        // Upload media to Meta
        const uploadResult = await uploadMetaMedia(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          validatedData.mediaBase64,
          mimeType,
          fileName
        );
        
        if (uploadResult.success && uploadResult.media_id) {
          // Send message with uploaded media_id
          result = await sendMetaMediaMessage(
            connection.meta_phone_number_id,
            connection.meta_access_token,
            formattedNumber,
            uploadResult.media_id,
            mediaType as 'image' | 'video' | 'audio' | 'document',
            validatedData.mensagem || validatedData.caption,
            true // isMediaId = true
          );
        } else {
          console.log("⚠️ Upload Meta falhou:", uploadResult.error);
          // Fallback para Evolution se disponível
          if (hasEvolutionConfig) {
            console.log("🔄 Tentando Evolution como fallback...");
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
            result = { success: false, provider: 'meta', error: uploadResult.error || 'Falha no upload de mídia' };
          }
        }
      }
      // Base64 sem credenciais Meta - usar Evolution direto
      else if (validatedData.mediaBase64 && hasEvolutionConfig) {
        console.log("📤 Base64 sem Meta - usando Evolution API...");
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
      // Template message (para primeira mensagem / disparo em massa)
      else if (hasMetaCredentials && validatedData.template_name) {
        console.log("📘 Tentando Meta API com template:", validatedData.template_name);
        result = await sendMetaTemplateMessage(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          formattedNumber,
          validatedData.template_name,
          validatedData.template_language || 'pt_BR',
          validatedData.template_components
        );
        
        // Fallback para Evolution se Meta falhar e provider for "both"
        if (!result.success && apiProvider === 'both' && hasEvolutionConfig) {
          console.log("🔄 Template Meta falhou, tentando Evolution como fallback...");
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
      }
      else if (hasMetaCredentials && validatedData.mediaUrl) {
        console.log("📘 Tentando Meta API com URL de mídia...");
        
        let mediaType = validatedData.tipo_mensagem || 'image';
        if (mediaType === 'texto') mediaType = 'text';
        if (mediaType === 'pdf') mediaType = 'document';
        
        result = await sendMetaMediaMessage(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          formattedNumber,
          validatedData.mediaUrl,
          mediaType as 'image' | 'video' | 'audio' | 'document',
          validatedData.mensagem || validatedData.caption,
          false // isMediaId = false (using URL)
        );
        
        // Detectar erro de janela de 24h e sugerir template
        if (!result.success && result.error?.includes('Re-engagement message')) {
          console.log("⚠️ Janela de 24h expirada - necessário usar template");
          result.error = 'JANELA_24H_EXPIRADA: Este contato não enviou mensagem nas últimas 24h. Para enviar a primeira mensagem, use um template aprovado.';
        }
      } else if (hasMetaCredentials && validatedData.mensagem) {
        console.log("📘 Tentando Meta API com texto...");
        result = await sendMetaTextMessage(
          connection.meta_phone_number_id,
          connection.meta_access_token,
          formattedNumber,
          validatedData.mensagem
        );

        // Detectar erro de janela de 24h e sugerir template
        if (!result.success && (result.error?.includes('Re-engagement message') || result.error?.includes('outside the allowed window'))) {
          console.log("⚠️ Janela de 24h expirada - necessário usar template");
          result.error = 'JANELA_24H_EXPIRADA: Este contato não enviou mensagem nas últimas 24h. Para enviar a primeira mensagem, use um template aprovado.';
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
      } else if (hasEvolutionConfig) {
        // Sem credenciais Meta mas Evolution disponível - usar Evolution
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
        // Sem mensagem nem mídia válida e sem Evolution
        console.log("⚠️ Sem mensagem/mídia válida e sem Evolution");
        result = { success: false, provider: 'meta', error: 'Mensagem, mídia, template ou Evolution API é obrigatória' };
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