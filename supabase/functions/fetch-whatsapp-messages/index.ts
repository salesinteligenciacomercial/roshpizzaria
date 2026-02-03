import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Fallback Evolution API config from environment
const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL") || "https://evo.continuum.tec.br";
const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phoneNumber, companyId, limit = 50 } = await req.json();

    if (!phoneNumber || !companyId) {
      return new Response(
        JSON.stringify({ error: "phoneNumber e companyId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("📱 Buscando mensagens do WhatsApp:", { phoneNumber, companyId, limit });

    // Criar cliente Supabase com service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar configuração da conexão WhatsApp
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
    // Sanitizar URL removendo paths extras
    const rawBaseUrl = connection.evolution_api_url || EVOLUTION_API_URL;
    const baseUrl = rawBaseUrl.replace(/\/(manager|api|v1|v2)?\/?$/i, '').replace(/\/$/, '');
    const apiKey = connection.evolution_api_key || EVOLUTION_API_KEY;

    if (!instanceName || !apiKey) {
      console.error("❌ Instância ou API Key não configurada");
      return new Response(
        JSON.stringify({ error: "Instância WhatsApp não configurada corretamente", code: "INVALID_CONFIG" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("🔗 Configuração Evolution:", { instanceName, baseUrl, hasApiKey: !!apiKey });

    // Formatar número para o padrão do WhatsApp
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

    // Chamar Evolution API para buscar mensagens
    const evolutionUrl = `${baseUrl}/chat/findMessages/${instanceName}`;
    console.log("📤 Chamando Evolution API:", evolutionUrl);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "apikey": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        where: {
          key: {
            remoteJid: formattedNumber,
          },
        },
        limit,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Erro Evolution API:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: `Erro ao buscar mensagens: ${response.statusText}`, 
          code: "EVOLUTION_ERROR",
          details: errorText 
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const responseData = await response.json();
    
    // Evolution API retorna estrutura aninhada: { messages: { records: [...] } } ou { messages: { messages: { records: [...] } } }
    let messagesArray: any[] = [];
    
    if (Array.isArray(responseData)) {
      // Resposta direta como array
      messagesArray = responseData;
    } else if (responseData?.messages?.messages?.records) {
      // Estrutura nova: { messages: { messages: { records: [...] } } }
      messagesArray = responseData.messages.messages.records;
    } else if (responseData?.messages?.records) {
      // Estrutura alternativa: { messages: { records: [...] } }
      messagesArray = responseData.messages.records;
    } else if (responseData?.messages && Array.isArray(responseData.messages)) {
      // Estrutura: { messages: [...] }
      messagesArray = responseData.messages;
    } else if (responseData?.records && Array.isArray(responseData.records)) {
      // Estrutura: { records: [...] }
      messagesArray = responseData.records;
    }
    
    console.log(`✅ ${messagesArray.length} mensagens encontradas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messages: messagesArray,
        count: messagesArray.length 
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
