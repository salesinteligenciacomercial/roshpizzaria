import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const enviarWhatsAppSchema = z.object({
  numero: z.string()
    .regex(/^[0-9]{10,15}$/, 'Número deve ter entre 10-15 dígitos')
    .transform(val => val.replace(/[^0-9]/g, '')),
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
  company_id: z.string().uuid('Company ID deve ser UUID válido').optional()
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

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      console.error("❌ Variáveis de ambiente da Evolution API não configuradas");
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
    
    if (validatedData.company_id) {
      console.log("🔍 Buscando instância WhatsApp para company:", validatedData.company_id);
      
      // Criar cliente Supabase
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Buscar conexão WhatsApp ativa da company
      const { data: connection, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('instance_name, whatsapp_number')
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
      console.log("⚠️ Usando instância padrão:", EVOLUTION_INSTANCE);
    }

    // Formatar número no formato correto
    const numeroFormatado = validatedData.numero.includes("@s.whatsapp.net")
      ? validatedData.numero
      : `${validatedData.numero}@s.whatsapp.net`;

    console.log("📞 Número formatado");

    let evolutionUrl: string;
    let bodyPayload: any;

    // Verificar se é mídia (base64, URL) ou texto
    if (validatedData.mediaBase64) {
      // Enviar mídia via base64
      evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
      
      // Normalizar tipo de mídia
      let mediaType = validatedData.tipo_mensagem || 'document';
      if (mediaType === 'texto') mediaType = 'text';
      // PDF e document são mantidos como document
      if (mediaType === 'pdf') mediaType = 'document';
      
      // Definir mimeType baseado no tipo de mídia e extensão do arquivo
      let mimeType = validatedData.mimeType;
      if (!mimeType) {
        const fileName = validatedData.fileName?.toLowerCase() || '';
        
        // Detectar por tipo de mídia primeiro
        if (mediaType === 'image') {
          if (fileName.endsWith('.png')) mimeType = 'image/png';
          else if (fileName.endsWith('.gif')) mimeType = 'image/gif';
          else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
          else mimeType = 'image/jpeg'; // default para imagens
        } else if (mediaType === 'audio') {
          if (fileName.endsWith('.ogg')) mimeType = 'audio/ogg';
          else if (fileName.endsWith('.wav')) mimeType = 'audio/wav';
          else if (fileName.endsWith('.m4a')) mimeType = 'audio/mp4';
          else mimeType = 'audio/mpeg'; // default para áudio
        } else if (mediaType === 'video') {
          if (fileName.endsWith('.mov')) mimeType = 'video/quicktime';
          else if (fileName.endsWith('.avi')) mimeType = 'video/x-msvideo';
          else if (fileName.endsWith('.webm')) mimeType = 'video/webm';
          else mimeType = 'video/mp4'; // default para vídeo
        } else if (validatedData.tipo_mensagem === 'pdf' || fileName.endsWith('.pdf')) {
          mimeType = 'application/pdf';
        } else {
          // Detectar por extensão para documentos
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
            mimeType = 'application/octet-stream'; // fallback genérico
          }
        }
        
        console.log(`📄 MIME type detectado: ${mimeType} (arquivo: ${fileName})`);
      }
      
      bodyPayload = {
        number: numeroFormatado,
        mediatype: mediaType,
        mimetype: mimeType,
        caption: validatedData.caption || validatedData.mensagem || "",
        fileName: validatedData.fileName || 'arquivo',
        media: validatedData.mediaBase64,
      };
      console.log(`📸 Enviando mídia base64 (${mediaType})`);
    } else if (validatedData.mediaUrl) {
      // Enviar mídia via URL
      evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
      bodyPayload = {
        number: numeroFormatado,
        mediaUrl: validatedData.mediaUrl,
        caption: validatedData.mensagem || validatedData.caption || "",
      };
      console.log("📸 Enviando mídia via URL");
    } else {
      // Enviar texto
      evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      bodyPayload = {
        number: numeroFormatado,
        text: validatedData.mensagem,
      };
      console.log("💬 Enviando texto");
    }

    // Enviar para Evolution API
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify(bodyPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Erro Evolution API");
      return new Response(
        JSON.stringify({
          error: "Falha ao enviar mensagem",
          code: "EXTERNAL_API_ERROR"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Mensagem enviada com sucesso");
    
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