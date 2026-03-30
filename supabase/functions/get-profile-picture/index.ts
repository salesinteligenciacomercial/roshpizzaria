import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// TEMPORARIAMENTE DESABILITADO
// Esta função estava sobrecarregando o servidor Evolution API
// e esgotando a concorrência das Edge Functions, impedindo
// o envio e recebimento de mensagens.
// 
// Retorna null imediatamente sem fazer nenhuma chamada externa.
// =====================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('⏸️ [PROFILE-PICTURE] Função desabilitada temporariamente - retornando null');

  return new Response(
    JSON.stringify({ profilePictureUrl: null, disabled: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
