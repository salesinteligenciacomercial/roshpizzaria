import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const enviarWhatsAppSchema = z.object({
  // Aceita: somente dígitos (contato) OU JID completo de contato (@s.whatsapp.net) OU JID de grupo (@g.us)
  numero: z.string().refine((val) => {
    const isDigits = /^[0-9]{10,15}$/.test(val);
    const isGroupJid = /@g\.us$/.test(val);
    const isContactJid = /@s\.whatsapp\.net$/.test(val);
    return isDigits || isGroupJid || isContactJid;
  }, 'Informe dígitos (10-15), JID de contato @s.whatsapp.net ou grupo @g.us'),
  mensagem: z.string()
    .min(1, 'Mensagem não pode ser vazia')
    .max(4096, 'Mensagem muito longa')
    .optional(),
  tipo_mensagem: z.enum(['text', 'texto', 'image', 'audio', 'video', 'document', 'pdf']).optional(),
  mediaUrl: z.string().url('URL de mídia inválida').optional(),
  mediaBase64: z.string().optional(),
  fileName: z.string().optional(),
  mimeType: z.string().optional(),
  caption: z.string().optional(),
  company_id: z.string().uuid('Company ID deve ser UUID válido').optional(),
  quoted: z.object({
    key: z.object({
      id: z.string()
    }),
    message: z.object({
      conversation: z.string()
    })
  }).optional(),
  quotedMessageId: z.string().optional()
}).refine(data => data.mensagem || data.mediaUrl || data.mediaBase64, {
  message: 'Mensagem, mídia URL ou mídia Base64 é obrigatória'
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Validate input with Zod
    let validatedData;
    try {
      validatedData = enviarWhatsAppSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Dados de entrada inválidos:", error.errors);
        return new Response(
          JSON.stringify({ 
            error: 'Dados inválidos fornecidos',
            code: 'VALIDATION_ERROR',
            details: error.errors
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }

    console.log("📨 Pedido de envio validado");

    // Buscar configurações dos secrets
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!EVOLUTION_API_URL) {
      console.error("❌ EVOLUTION_API_URL não configurada");
      return new Response(
        JSON.stringify({ 
          error: "Configuração da Evolution API incompleta",
          code: "CONFIG_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar instância WhatsApp da company
    let EVOLUTION_INSTANCE: string;
    let INSTANCE_API_KEY: string | null = null;
    let INSTANCE_API_URL: string | null = null;
    
    if (validatedData.company_id) {
      console.log("🔍 Buscando instância WhatsApp para company:", validatedData.company_id);
      
      // Criar cliente Supabase
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Buscar conexão WhatsApp ativa da company (incluindo API key)
      const { data: connection, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('instance_name, whatsapp_number, evolution_api_key, evolution_api_url')
        .eq('company_id', validatedData.company_id)
        .eq('status', 'connected')
        .single();
      
      if (connError || !connection) {
        console.error("❌ Nenhuma conexão WhatsApp ativa encontrada para esta empresa");
        return new Response(
          JSON.stringify({ 
            error: "Nenhuma conexão WhatsApp ativa encontrada",
            code: "NO_WHATSAPP_CONNECTION"
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      EVOLUTION_INSTANCE = connection.instance_name;
      // Preferir URL específica da instância, se existir
      if (connection.evolution_api_url && typeof connection.evolution_api_url === 'string' && connection.evolution_api_url.length > 0) {
        INSTANCE_API_URL = connection.evolution_api_url;
        console.log("✅ Usando URL da instância:", INSTANCE_API_URL);
      }
      
      // Usar API key da conexão se disponível, senão fallback p/ env
      if (connection.evolution_api_key) {
        INSTANCE_API_KEY = connection.evolution_api_key;
        console.log("✅ Usando API key da conexão:", EVOLUTION_INSTANCE);
      } else if (EVOLUTION_API_KEY) {
        INSTANCE_API_KEY = EVOLUTION_API_KEY;
        console.log("⚠️ API key não definida na conexão. Usando EVOLUTION_API_KEY do ambiente");
      } else {
        console.error("❌ Nenhuma API key disponível (conexão/ambiente)");
        return new Response(
          JSON.stringify({
            error: "Nenhuma API key disponível para Evolution",
            code: "NO_API_KEY"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("✅ Instância encontrada:", EVOLUTION_INSTANCE, "- Número:", connection.whatsapp_number);
    } else {
      // Fallback para instância padrão (compatibilidade)
      EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE") || "";
      if (!EVOLUTION_INSTANCE) {
        console.error("❌ Instância não especificada e sem fallback");
        return new Response(
          JSON.stringify({ 
            error: "Instância WhatsApp não especificada",
            code: "NO_INSTANCE"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Resolver API key do ambiente nesse cenário
      if (EVOLUTION_API_KEY) {
        INSTANCE_API_KEY = EVOLUTION_API_KEY;
      } else {
        console.error("❌ EVOLUTION_API_KEY não definida no ambiente");
        return new Response(
          JSON.stringify({
            error: "Nenhuma API key disponível para Evolution",
            code: "NO_API_KEY"
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("⚠️ Usando instância padrão:", EVOLUTION_INSTANCE);
    }

    // Determinar alvo: contato (digits) ou grupo (JID @g.us)
    const isGroup = /@g\.us$/.test(validatedData.numero);
    const isContactJid = /@s\.whatsapp\.net$/.test(validatedData.numero);
    const numberDigits = String(validatedData.numero).replace(/[^0-9]/g, '');
    const target = isGroup
      ? { groupId: validatedData.numero }
      : { number: numberDigits };

    console.log("🎯 Alvo de envio:", isGroup ? { groupId: target.groupId } : { number: target.number });

    let evolutionUrl: string;
    let bodyPayload: any;

    // Verificar se é mídia (base64, URL) ou texto
    if (validatedData.mediaBase64) {
      // Enviar mídia via base64 - Formato Evolution API v1
      evolutionUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
      
      // Normalizar tipo de mídia
      let mediaType = validatedData.tipo_mensagem || 'document';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';
      
      // Definir mimeType baseado no tipo de mídia e extensão do arquivo
      let mimeType = validatedData.mimeType;
      if (!mimeType) {
        const fileName = validatedData.fileName?.toLowerCase() || '';
        if (mediaType === 'image') {
          if (fileName.endsWith('.png')) mimeType = 'image/png';
          else if (fileName.endsWith('.gif')) mimeType = 'image/gif';
          else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
          else mimeType = 'image/jpeg';
        } else if (mediaType === 'audio') {
          if (fileName.endsWith('.ogg')) mimeType = 'audio/ogg';
          else if (fileName.endsWith('.wav')) mimeType = 'audio/wav';
          else if (fileName.endsWith('.m4a')) mimeType = 'audio/mp4';
          else mimeType = 'audio/mpeg';
        } else if (mediaType === 'video') {
          if (fileName.endsWith('.mov')) mimeType = 'video/quicktime';
          else if (fileName.endsWith('.avi')) mimeType = 'video/x-msvideo';
          else if (fileName.endsWith('.webm')) mimeType = 'video/webm';
          else mimeType = 'video/mp4';
        } else if (validatedData.tipo_mensagem === 'pdf' || fileName.endsWith('.pdf')) {
          mimeType = 'application/pdf';
        } else {
          if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (fileName.endsWith('.txt')) {
            mimeType = 'text/plain';
          } else if (fileName.endsWith('.zip')) {
            mimeType = 'application/zip';
          } else {
            mimeType = 'application/octet-stream';
          }
        }
      }
      
      bodyPayload = {
        ...(isGroup ? { groupId: (target as any).groupId } : { number: (target as any).number }),
        mediaMessage: {
          mediatype: mediaType,
          mimetype: mimeType,
          caption: validatedData.caption || validatedData.mensagem || "",
          fileName: validatedData.fileName || 'arquivo',
          media: validatedData.mediaBase64,
        }
      };
      console.log(`📸 Enviando mídia base64 (${mediaType})`);
    } else if (validatedData.mediaUrl) {
      // Enviar mídia via URL - Formato Evolution API v1
      evolutionUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
      bodyPayload = {
        ...(isGroup ? { groupId: (target as any).groupId } : { number: (target as any).number }),
        mediaMessage: {
          mediaUrl: validatedData.mediaUrl,
          caption: validatedData.mensagem || validatedData.caption || ""
        }
      };
      console.log("📸 Enviando mídia via URL");
    } else {
      // Enviar texto - Formato correto da Evolution API v1
      evolutionUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      
      bodyPayload = {
        ...(isGroup ? { groupId: (target as any).groupId } : { number: (target as any).number }),
        textMessage: {
          text: validatedData.mensagem
        },
        ...(validatedData.quoted ? { 
          options: {
            quoted: validatedData.quoted 
          }
        } : {}),
      };
      console.log("💬 Enviando texto no formato Evolution API v1");
    }

    // Função auxiliar para tentativas com endpoints alternativos (compatibilidade Evolution)
    const tryPost = async (urls: string[], payload: any) => {
      let lastError: any = null;
      for (const url of urls) {
        try {
          if (!INSTANCE_API_KEY) {
            throw new Error('API key não configurada');
          }
          
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": INSTANCE_API_KEY,
            },
            body: JSON.stringify(payload),
          });
          let parsed: any = null;
          try { parsed = await res.json(); } catch {}
          if (res.ok) {
            console.log("✅ Evolution OK:", url, res.status);
            return { ok: true as const, res, parsed };
          }
          console.warn("⚠️ Evolution falhou:", url, res.status, parsed);
          lastError = { status: res.status, parsed, url };
        } catch (e) {
          console.warn("⚠️ Erro ao chamar Evolution:", url, e);
          lastError = { error: String(e), url };
        }
      }
      return { ok: false as const, lastError };
    };

    // Usar apenas o endpoint correto da Evolution API v1
    const base = (INSTANCE_API_URL || EVOLUTION_API_URL).replace(/\/$/, '');
    const candidates: string[] = [evolutionUrl]; // Apenas o endpoint principal
    
    console.log("📤 Enviando para:", evolutionUrl);

    const attempt = await tryPost(candidates, bodyPayload);
    if (!attempt.ok) {
      console.error("❌ Evolution API falhou em todos os endpoints candidatos:", attempt.lastError);
      
      // Mensagem de erro mais específica baseada no erro
      let errorMessage = "Falha ao enviar mensagem. ";
      if (attempt.lastError?.parsed?.response?.message?.[0]?.includes('does not exist')) {
        errorMessage = `A instância WhatsApp "${EVOLUTION_INSTANCE}" não existe ou foi desconectada. Por favor, reconecte o WhatsApp nas Configurações.`;
      } else if (attempt.lastError?.status === 404) {
        errorMessage = `WhatsApp não conectado. Por favor, verifique a conexão nas Configurações.`;
      }
      
      return new Response(
        JSON.stringify({
          error: errorMessage,
          code: "EXTERNAL_API_ERROR",
          details: attempt.lastError
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Mensagem enviada com sucesso (código)", attempt.res.status);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Mensagem enviada com sucesso"
      }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ Erro geral:", e);
    return new Response(
      JSON.stringify({ 
        error: "Erro interno ao processar requisição",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});