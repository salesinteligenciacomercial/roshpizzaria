import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { numero, mensagem, tipo_mensagem, mediaUrl } = await req.json();

    console.log("📨 Recebido pedido de envio:", { numero, mensagem, tipo_mensagem, mediaUrl });

    if (!numero || (!mensagem && !mediaUrl)) {
      console.error("❌ Número e mensagem/mídia são obrigatórios");
      return new Response(
        JSON.stringify({ error: "Número e mensagem/mídia são obrigatórios" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Buscar configurações dos secrets
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const EVOLUTION_INSTANCE = Deno.env.get("EVOLUTION_INSTANCE");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
      console.error("❌ Variáveis de ambiente não configuradas");
      return new Response(
        JSON.stringify({ error: "Configuração da Evolution API incompleta" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Formatar número no formato correto
    const numeroFormatado = numero.includes("@s.whatsapp.net")
      ? numero
      : `${numero}@s.whatsapp.net`;

    console.log("📞 Número formatado:", numeroFormatado);

    let evolutionUrl: string;
    let body: any;

    // Verificar se é mídia ou texto
    if (mediaUrl) {
      // Enviar mídia
      evolutionUrl = `${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE}`;
      body = {
        number: numeroFormatado,
        mediaUrl: mediaUrl,
        caption: mensagem || "",
      };
      console.log("📸 Enviando mídia:", body);
    } else {
      // Enviar texto
      evolutionUrl = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;
      body = {
        number: numeroFormatado,
        text: mensagem,
      };
      console.log("💬 Enviando texto:", body);
    }

    console.log("🌐 Enviando para:", evolutionUrl);

    // Enviar para Evolution API
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": EVOLUTION_API_KEY,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("❌ Erro Evolution API:", result);
      return new Response(
        JSON.stringify({
          error: "Falha ao enviar mensagem para Evolution API",
          detalhes: result,
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log("✅ Mensagem enviada com sucesso:", result);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Mensagem enviada com sucesso",
        data: result 
      }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ Erro geral:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ 
        error: "Erro interno ao processar requisição", 
        detalhes: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
