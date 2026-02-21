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

// Helper: extrair array de mensagens de diferentes formatos de resposta
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

// Helper: fazer fetch com retry
async function fetchWithRetry(url: string, options: RequestInit, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      console.warn(`⚠️ Tentativa ${i + 1} falhou com status ${res.status}`);
    } catch (e) {
      console.warn(`⚠️ Tentativa ${i + 1} erro:`, e);
    }
  }
  return null;
}

// Helper: filtrar mensagens por número de telefone
function filterByPhone(messages: any[], phoneDigits: string): any[] {
  return messages.filter((msg: any) => {
    const msgJid = (msg.key?.remoteJid || msg.remoteJid || "")
      .replace("@s.whatsapp.net", "")
      .replace("@g.us", "");
    return msgJid.includes(phoneDigits) || phoneDigits.includes(msgJid);
  });
}

// Helper: deduplicar mensagens por ID
function deduplicateMessages(messages: any[]): any[] {
  const seen = new Set<string>();
  return messages.filter((msg) => {
    const id = msg.key?.id || msg.id || "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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

    const phoneDigits = phoneNumber.replace(/[^0-9]/g, "");
    const formattedNumber = phoneDigits + "@s.whatsapp.net";
    const evolutionUrl = `${baseUrl}/chat/findMessages/${instanceName}`;
    const headers = { "apikey": apiKey, "Content-Type": "application/json" };

    console.log("📤 Chamando Evolution API:", evolutionUrl);

    // =====================================================
    // ESTRATÉGIA DUPLA: Buscar ENVIADAS e RECEBIDAS separadamente
    // Bug conhecido da Evolution API: findMessages com remoteJid 
    // pode não funcionar corretamente. Usamos múltiplas abordagens.
    // =====================================================
    
    let allMessages: any[] = [];

    // ── ABORDAGEM 1: Buscar com filtro por remoteJid (enviadas + recebidas juntas) ──
    console.log("🔍 Abordagem 1: Filtro key.remoteJid...");
    const res1 = await fetchWithRetry(evolutionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        where: { key: { remoteJid: formattedNumber } },
        limit: limit,
      }),
    });
    if (res1) {
      const data1 = await res1.json();
      const msgs1 = extractMessages(data1);
      const filtered1 = filterByPhone(msgs1, phoneDigits);
      console.log(`📊 Abordagem 1: ${msgs1.length} brutas → ${filtered1.length} filtradas`);
      
      const sent1 = filtered1.filter((m: any) => m.key?.fromMe === true).length;
      const recv1 = filtered1.filter((m: any) => m.key?.fromMe === false).length;
      console.log(`📊 Abordagem 1 detalhe: ${sent1} enviadas, ${recv1} recebidas`);
      
      allMessages.push(...filtered1);
    }

    // ── ABORDAGEM 2: Buscar EXPLICITAMENTE recebidas (fromMe: false) ──
    // Isso garante que mensagens recebidas sejam incluídas
    console.log("🔍 Abordagem 2: Buscar recebidas explicitamente (fromMe: false)...");
    const res2 = await fetchWithRetry(evolutionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        where: { key: { remoteJid: formattedNumber, fromMe: false } },
        limit: limit,
      }),
    });
    if (res2) {
      const data2 = await res2.json();
      const msgs2 = extractMessages(data2);
      const filtered2 = filterByPhone(msgs2, phoneDigits);
      console.log(`📊 Abordagem 2 (recebidas): ${msgs2.length} brutas → ${filtered2.length} filtradas`);
      allMessages.push(...filtered2);
    }

    // ── ABORDAGEM 3: Buscar EXPLICITAMENTE enviadas (fromMe: true) ──
    console.log("🔍 Abordagem 3: Buscar enviadas explicitamente (fromMe: true)...");
    const res3 = await fetchWithRetry(evolutionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        where: { key: { remoteJid: formattedNumber, fromMe: true } },
        limit: limit,
      }),
    });
    if (res3) {
      const data3 = await res3.json();
      const msgs3 = extractMessages(data3);
      const filtered3 = filterByPhone(msgs3, phoneDigits);
      console.log(`📊 Abordagem 3 (enviadas): ${msgs3.length} brutas → ${filtered3.length} filtradas`);
      allMessages.push(...filtered3);
    }

    // ── ABORDAGEM 4: remoteJid sem wrapper key ──
    if (allMessages.length === 0) {
      console.log("🔍 Abordagem 4: remoteJid direto (sem wrapper key)...");
      const res4 = await fetchWithRetry(evolutionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          where: { remoteJid: formattedNumber },
          limit: limit * 3,
        }),
      });
      if (res4) {
        const data4 = await res4.json();
        const msgs4 = extractMessages(data4);
        const filtered4 = filterByPhone(msgs4, phoneDigits);
        console.log(`📊 Abordagem 4: ${msgs4.length} brutas → ${filtered4.length} filtradas`);
        allMessages.push(...filtered4);
      }
    }

    // ── ABORDAGEM 5: VARREDURA TOTAL - Buscar TUDO e filtrar client-side ──
    // Último recurso se nenhuma abordagem anterior trouxe recebidas
    const uniqueBeforeSweep = deduplicateMessages(allMessages);
    const recvBeforeSweep = uniqueBeforeSweep.filter((m: any) => 
      (m.key?.fromMe === false) || (m.fromMe === false)
    ).length;
    
    if (recvBeforeSweep === 0) {
      console.log("⚠️ Nenhuma mensagem recebida ainda - Abordagem 5: VARREDURA TOTAL...");
      const res5 = await fetchWithRetry(evolutionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          where: {},
          limit: Math.min(limit * 5, 2000),
        }),
      });
      if (res5) {
        const data5 = await res5.json();
        const allRaw = extractMessages(data5);
        console.log(`📊 Abordagem 5: ${allRaw.length} mensagens totais no banco`);
        
        const filtered5 = filterByPhone(allRaw, phoneDigits);
        console.log(`📊 Abordagem 5 filtrada: ${filtered5.length} mensagens do contato ${phoneDigits}`);
        
        const sent5 = filtered5.filter((m: any) => m.key?.fromMe === true || m.fromMe === true).length;
        const recv5 = filtered5.filter((m: any) => m.key?.fromMe === false || m.fromMe === false).length;
        console.log(`📊 Abordagem 5 detalhe: ${sent5} enviadas, ${recv5} recebidas`);
        
        allMessages.push(...filtered5);
      }
    }

    // ── DEDUPLICAR e NORMALIZAR ──
    const deduplicated = deduplicateMessages(allMessages);
    const normalizedMessages = deduplicated
      .map((msg: any) => normalizeMessage(msg, formattedNumber))
      .slice(0, limit);

    // Log final detalhado
    const sentCount = normalizedMessages.filter((m: any) => m.key.fromMe === true).length;
    const receivedCount = normalizedMessages.filter((m: any) => m.key.fromMe === false).length;
    console.log(`✅ RESULTADO FINAL: ${normalizedMessages.length} mensagens (${sentCount} enviadas, ${receivedCount} recebidas)`);
    
    if (receivedCount === 0 && normalizedMessages.length > 0) {
      console.warn("⚠️ ATENÇÃO: Nenhuma mensagem recebida encontrada! A Evolution API pode não estar armazenando mensagens recebidas. Verifique se STORE_MESSAGES está habilitado na instância.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        messages: normalizedMessages,
        count: normalizedMessages.length,
        sent: sentCount,
        received: receivedCount,
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
