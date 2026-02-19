import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://evo.continuum.tec.br";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

// Helper: extrair array de mensagens de diferentes formatos de resposta da Evolution API
function extractMessages(responseData: any): any[] {
  if (!responseData) return [];
  if (Array.isArray(responseData)) return responseData;
  if (responseData?.messages?.messages?.records) return responseData.messages.messages.records;
  if (responseData?.messages?.records) return responseData.messages.records;
  if (responseData?.messages && Array.isArray(responseData.messages)) return responseData.messages;
  if (responseData?.records && Array.isArray(responseData.records)) return responseData.records;
  return [];
}

// Helper: normalizar uma mensagem para formato consistente
function normalizeMessage(msg: any, defaultJid: string): any {
  const remoteJid = msg.key?.remoteJid || msg.remoteJid || defaultJid;
  const fromMe = msg.key?.fromMe ?? msg.fromMe ?? false;

  let messageContent = "[Mídia]";
  if (msg.message?.conversation) {
    messageContent = msg.message.conversation;
  } else if (msg.message?.extendedTextMessage?.text) {
    messageContent = msg.message.extendedTextMessage.text;
  } else if (msg.message?.imageMessage?.caption) {
    messageContent = msg.message.imageMessage.caption || "[Imagem]";
  } else if (msg.message?.videoMessage?.caption) {
    messageContent = msg.message.videoMessage.caption || "[Vídeo]";
  } else if (msg.message?.audioMessage) {
    messageContent = "[Áudio]";
  } else if (msg.message?.documentMessage?.fileName) {
    messageContent = `[Documento: ${msg.message.documentMessage.fileName}]`;
  } else if (msg.message?.stickerMessage) {
    messageContent = "[Sticker]";
  } else if (msg.message?.contactMessage) {
    messageContent = "[Contato]";
  } else if (msg.message?.locationMessage) {
    messageContent = "[Localização]";
  } else if (msg.body) {
    messageContent = msg.body;
  } else if (typeof msg.message === 'string') {
    messageContent = msg.message;
  }

  const timestamp = msg.messageTimestamp || msg.timestamp || Math.floor(Date.now() / 1000);

  return {
    key: {
      id: msg.key?.id || msg.id || crypto.randomUUID(),
      remoteJid,
      fromMe,
    },
    message: msg.message || { conversation: messageContent },
    messageTimestamp: timestamp,
    pushName: msg.pushName || msg.senderName || null,
    _originalFromMe: fromMe,
    _messageContent: messageContent,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phoneNumber, companyId, limit = 200 } = await req.json();

    if (!phoneNumber || !companyId) {
      return new Response(
        JSON.stringify({ error: "phoneNumber e companyId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📱 Buscando mensagens do WhatsApp:", { phoneNumber, companyId, limit });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: connection, error: connectionError } = await supabase
      .from("whatsapp_connections")
      .select("instance_name, evolution_api_url, evolution_api_key, status")
      .eq("company_id", companyId)
      .single();

    if (connectionError || !connection) {
      console.error("❌ Conexão WhatsApp não encontrada:", connectionError);
      return new Response(
        JSON.stringify({ error: "Conexão WhatsApp não configurada", code: "NO_CONNECTION" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instanceName = connection.instance_name;
    const rawBaseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
    const baseUrl = rawBaseUrl.replace(/\/(manager|api|v1|v2)?\/?$/i, '').replace(/\/$/, '');
    const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;

    if (!instanceName || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Instância WhatsApp não configurada corretamente", code: "INVALID_CONFIG" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔗 Configuração Evolution:", { instanceName, baseUrl, hasApiKey: !!apiKey });

    const formattedNumber = phoneNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    const evolutionUrl = `${baseUrl}/chat/findMessages/${instanceName}`;
    console.log("📤 Chamando Evolution API:", evolutionUrl);

    // ⚡ CORREÇÃO: Bug conhecido do findMessages - tentar múltiplas estratégias
    let messagesFromResponse: any[] = [];

    // Estratégia 1: where.key.remoteJid (padrão documentado)
    try {
      const res1 = await fetch(evolutionUrl, {
        method: "POST",
        headers: { "apikey": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          where: { key: { remoteJid: formattedNumber } },
          limit,
        }),
      });
      if (res1.ok) {
        const data1 = await res1.json();
        messagesFromResponse = extractMessages(data1);
        console.log(`📊 Estratégia 1 (key.remoteJid): ${messagesFromResponse.length} mensagens`);
      }
    } catch (e) {
      console.warn("⚠️ Estratégia 1 falhou:", e);
    }

    // Estratégia 2: where.remoteJid direto (sem wrapper key)
    if (messagesFromResponse.length === 0) {
      try {
        const res2 = await fetch(evolutionUrl, {
          method: "POST",
          headers: { "apikey": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            where: { remoteJid: formattedNumber },
            limit: limit * 5,
          }),
        });
        if (res2.ok) {
          const data2 = await res2.json();
          let msgs2 = extractMessages(data2);
          console.log(`📊 Estratégia 2 (remoteJid direto): ${msgs2.length} mensagens brutas`);
          
          // ⚡ CORREÇÃO: Evolution API pode ignorar o filtro - filtrar client-side
          const phoneDigits = phoneNumber.replace(/[^0-9]/g, "");
          msgs2 = msgs2.filter((msg: any) => {
            const msgJid = (msg.key?.remoteJid || msg.remoteJid || "").replace("@s.whatsapp.net", "").replace("@g.us", "");
            return msgJid.includes(phoneDigits) || phoneDigits.includes(msgJid);
          }).slice(0, limit);
          
          messagesFromResponse = msgs2;
          console.log(`📊 Estratégia 2 filtrada: ${messagesFromResponse.length} mensagens`);
        }
      } catch (e) {
        console.warn("⚠️ Estratégia 2 falhou:", e);
      }
    }

    // Estratégia 3: Buscar TODAS as mensagens e filtrar client-side (workaround para bug)
    if (messagesFromResponse.length === 0) {
      console.log("⚠️ Tentando buscar todas e filtrar client-side...");
      try {
        const res3 = await fetch(evolutionUrl, {
          method: "POST",
          headers: { "apikey": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            where: {},
            limit: Math.min(limit * 5, 1000),
          }),
        });
        if (res3.ok) {
          const data3 = await res3.json();
          const allMessages = extractMessages(data3);
          console.log(`📊 Estratégia 3: ${allMessages.length} mensagens totais retornadas`);

          const phoneDigits = phoneNumber.replace(/[^0-9]/g, "");
          messagesFromResponse = allMessages.filter((msg: any) => {
            const msgJid = (msg.key?.remoteJid || msg.remoteJid || "").replace("@s.whatsapp.net", "").replace("@g.us", "");
            return msgJid.includes(phoneDigits) || phoneDigits.includes(msgJid);
          }).slice(0, limit);

          console.log(`📊 Estratégia 3 filtrada: ${messagesFromResponse.length} mensagens para ${phoneDigits}`);
        }
      } catch (e) {
        console.warn("⚠️ Estratégia 3 falhou:", e);
      }
    }

    // Normalizar mensagens
    const normalizedMessages = messagesFromResponse.map((msg: any) => normalizeMessage(msg, formattedNumber));

    // Log para debug
    if (normalizedMessages.length > 0) {
      const sentCount = normalizedMessages.filter((m: any) => m.key.fromMe === true).length;
      const receivedCount = normalizedMessages.filter((m: any) => m.key.fromMe === false).length;
      console.log(`📊 Enviadas: ${sentCount}, Recebidas: ${receivedCount}`);
    }

    console.log(`✅ ${normalizedMessages.length} mensagens encontradas e normalizadas`);

    return new Response(
      JSON.stringify({
        success: true,
        messages: normalizedMessages,
        count: normalizedMessages.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Erro ao buscar mensagens:", error);
    return new Response(
      JSON.stringify({ error: String(error), code: "INTERNAL_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});