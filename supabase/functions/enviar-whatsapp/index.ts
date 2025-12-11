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
      // Normalizar tipo de mídia
      let mediaType = validatedData.tipo_mensagem || 'document';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';
      
      // ✅ CORREÇÃO: Usar endpoint específico para áudio (PTT/Voz)
      if (mediaType === 'audio') {
        // Endpoint específico para áudio de voz (Push To Talk)
        // Usar sendWhatsAppAudio que envia como áudio de voz gravado
        const baseUrl = INSTANCE_API_URL || EVOLUTION_API_URL;
        evolutionUrl = `${baseUrl}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`;
        
        bodyPayload = {
          number: isGroup ? (target as any).groupId : (target as any).number,
          audio: validatedData.mediaBase64, // ⚡ Base64 puro sem prefixo
          delay: 1200, // Delay para simular digitação
        };
        console.log(`🎤 Enviando áudio PTT via sendWhatsAppAudio para: ${bodyPayload.number}`);
      } else {
        // Enviar outras mídias via sendMedia - Formato Evolution API
        evolutionUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
        
        // Definir mimeType baseado no tipo de mídia e extensão do arquivo
        let mimeType = validatedData.mimeType;
        if (!mimeType) {
          const fileName = validatedData.fileName?.toLowerCase() || '';
          if (mediaType === 'image') {
            if (fileName.endsWith('.png')) mimeType = 'image/png';
            else if (fileName.endsWith('.gif')) mimeType = 'image/gif';
            else if (fileName.endsWith('.webp')) mimeType = 'image/webp';
            else mimeType = 'image/jpeg';
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
        
        // ⚡ CORREÇÃO: Para PDF/documentos, usar caption vazio se não fornecido
        const captionToUse = validatedData.caption || validatedData.mensagem || '';
        
        bodyPayload = {
          number: isGroup ? (target as any).groupId : (target as any).number,
          mediatype: mediaType,
          mimetype: mimeType,
          caption: captionToUse,
          fileName: validatedData.fileName || 'arquivo',
          media: validatedData.mediaBase64,
        };
        console.log(`📸 [EDGE-PDF-SEND] Enviando mídia base64 (${mediaType}):`, {
          caption: captionToUse,
          fileName: validatedData.fileName,
          mimeType,
          temBase64: !!validatedData.mediaBase64,
          base64Length: validatedData.mediaBase64?.length || 0,
          base64Inicio: validatedData.mediaBase64?.substring(0, 50) || 'VAZIO',
          targetNumber: bodyPayload.number
        });
      }
    } else if (validatedData.mediaUrl) {
      // Enviar mídia via URL - Formato Evolution API
      evolutionUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
      
      // Determinar mediatype baseado no tipo_mensagem
      let mediaType = validatedData.tipo_mensagem || 'image';
      if (mediaType === 'texto') mediaType = 'text';
      if (mediaType === 'pdf') mediaType = 'document';
      
      bodyPayload = {
        number: isGroup ? (target as any).groupId : (target as any).number,
        mediatype: mediaType,
        media: validatedData.mediaUrl,
        caption: validatedData.mensagem || validatedData.caption || ""
      };
      console.log(`📸 Enviando mídia via URL (${mediaType}):`, validatedData.mediaUrl);
    } else {
      // Enviar texto - Formato Evolution API
      evolutionUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      
      bodyPayload = {
        number: isGroup ? (target as any).groupId : (target as any).number,
        text: validatedData.mensagem,
        ...(validatedData.quoted ? { 
          options: {
            quoted: validatedData.quoted 
          }
        } : {}),
      };
      console.log("💬 Enviando texto com formato correto da Evolution API");
    }

    // Função auxiliar para tentativas com endpoints alternativos (compatibilidade Evolution)
    const tryPost = async (urls: string[], payload: any, isAudio: boolean = false) => {
      let lastError: any = null;
      const targetNumber = isGroup ? (target as any).groupId : (target as any).number;
      
      for (const url of urls) {
        try {
          if (!INSTANCE_API_KEY) {
            throw new Error('API key não configurada');
          }
          
          // Ajustar payload para diferentes endpoints de áudio
          let currentPayload = payload;
          if (isAudio && validatedData.mediaBase64) {
            if (url.includes('sendWhatsAppAudio')) {
              currentPayload = {
                number: targetNumber,
                audio: validatedData.mediaBase64, // ⚡ Base64 puro
                delay: 1200,
              };
            } else if (url.includes('sendPtv')) {
              currentPayload = {
                number: targetNumber,
                video: validatedData.mediaBase64, // ⚡ PTV usa campo 'video'
              };
            } else if (url.includes('sendMedia')) {
              currentPayload = {
                number: targetNumber,
                mediatype: 'audio',
                mimetype: 'audio/ogg',
                caption: '',
                fileName: 'audio.ogg',
                media: validatedData.mediaBase64, // ⚡ Base64 puro
              };
            }
            console.log(`🎤 Tentando endpoint: ${url}`);
          }
          
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": INSTANCE_API_KEY,
            },
            body: JSON.stringify(currentPayload),
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

    // Usar apenas o endpoint correto da Evolution API
    const base = (INSTANCE_API_URL || EVOLUTION_API_URL).replace(/\/$/, '');
    let candidates: string[] = [evolutionUrl];
    
    // Para áudio, adicionar endpoints alternativos caso o primeiro falhe
    if (validatedData.tipo_mensagem === 'audio' && validatedData.mediaBase64) {
      candidates = [
        `${base}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE}`,
        `${base}/message/sendPtv/${EVOLUTION_INSTANCE}`, // Endpoint alternativo para PTT
        `${base}/message/sendMedia/${EVOLUTION_INSTANCE}`, // Fallback para sendMedia
      ];
      console.log("🎤 Tentando endpoints de áudio:", candidates);
    }
    
    console.log("📤 Enviando para:", candidates[0]);

    const isAudioMessage = validatedData.tipo_mensagem === 'audio' && !!validatedData.mediaBase64;
    const attempt = await tryPost(candidates, bodyPayload, isAudioMessage);
    if (!attempt.ok) {
      console.error("❌ Evolution API falhou:", attempt.lastError);
      
      // Se der erro 404 de instância não existir, tentar listar instâncias disponíveis
      if (attempt.lastError?.parsed?.response?.message?.[0]?.includes('does not exist')) {
        console.log("🔍 Tentando listar instâncias disponíveis...");
        try {
          const listUrl = `${INSTANCE_API_URL || EVOLUTION_API_URL}/instance/fetchInstances`;
          const listRes = await fetch(listUrl, {
            method: "GET",
            headers: {
              "apikey": INSTANCE_API_KEY!,
            },
          });
          if (listRes.ok) {
            const instances = await listRes.json();
            console.log("📋 Instâncias disponíveis:", JSON.stringify(instances, null, 2));
            
            // Extrair nomes das instâncias
            const instanceNames = instances.map((i: any) => i.instance?.instanceName).filter(Boolean);
            console.log("📝 Nomes das instâncias:", instanceNames);
            
            return new Response(
              JSON.stringify({
                error: `A instância "${EVOLUTION_INSTANCE}" não existe. Instâncias disponíveis: ${instanceNames.join(', ')}`,
                code: "INSTANCE_NOT_FOUND",
                availableInstances: instanceNames,
                details: attempt.lastError
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (listError) {
          console.error("⚠️ Erro ao listar instâncias:", listError);
        }
      }
      
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
