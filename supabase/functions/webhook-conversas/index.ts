import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('📩 Webhook recebido do N8n:', body);

    const { numero, mensagem, origem = 'WhatsApp', tipo_mensagem = 'text', midia_url, nome_contato } = body;

    if (!numero || !mensagem) {
      console.error('❌ Dados incompletos:', body);
      return new Response(
        JSON.stringify({ error: 'Número e mensagem são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Salvar conversa no Supabase
    const { data, error } = await supabase
      .from('conversas')
      .insert([{
        numero,
        mensagem,
        origem,
        status: 'Recebida',
        tipo_mensagem,
        midia_url,
        nome_contato,
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar conversa:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar conversa no banco', details: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('✅ Conversa salva com sucesso:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conversa registrada com sucesso',
        conversa: data,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (err) {
    console.error('⚠️ Erro interno:', err);
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar conversa', details: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
