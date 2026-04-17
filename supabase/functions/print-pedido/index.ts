import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { pedidoId } = await req.json();
    if (!pedidoId) {
      return new Response(JSON.stringify({ success: false, error: "pedidoId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .select("*")
      .eq("id", pedidoId)
      .single();
    if (pedidoError) throw pedidoError;

    const { data: itens, error: itensError } = await supabase
      .from("pedido_itens")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at");
    if (itensError) throw itensError;

    const { data: loja } = await supabase
      .from("loja_configuracoes")
      .select("*")
      .eq("company_id", pedido.company_id)
      .maybeSingle();

    const payload = {
      tipo: "pedido_pizzaria",
      pedido,
      itens,
      loja,
      printed_at: new Date().toISOString(),
    };

    const targetUrl = loja?.print_bridge_url || Deno.env.get("PRINT_BRIDGE_URL");

    if (targetUrl) {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Bridge de impressão respondeu com erro: ${body}`);
      }
    }

    await supabase.from("pedido_eventos").insert({
      pedido_id: pedido.id,
      company_id: pedido.company_id,
      status: pedido.status,
      descricao: targetUrl
        ? "Pedido enviado para o bridge de impressão"
        : "Payload de impressão gerado sem bridge configurado",
      metadata: payload,
    });

    return new Response(JSON.stringify({
      success: true,
      bridge_configured: Boolean(targetUrl),
      payload,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[print-pedido]", error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Erro interno",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
