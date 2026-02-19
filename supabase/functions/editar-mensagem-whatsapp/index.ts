import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, new_content, company_id } = await req.json();

    if (!message_id || !new_content || !company_id) {
      return new Response(
        JSON.stringify({ error: 'message_id, new_content e company_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar mensagem no banco para obter whatsapp_message_id e número
    const { data: mensagem, error: msgError } = await supabase
      .from('conversas')
      .select('id, whatsapp_message_id, numero, telefone_formatado, origem_api, company_id, fromme')
      .eq('id', message_id)
      .eq('company_id', company_id)
      .single();

    if (msgError || !mensagem) {
      console.error('❌ Mensagem não encontrada:', msgError);
      return new Response(
        JSON.stringify({ error: 'Mensagem não encontrada', code: 'MSG_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!mensagem.whatsapp_message_id) {
      console.log('⚠️ Mensagem sem whatsapp_message_id, apenas atualizando no banco');
      // Atualizar apenas no banco
      await supabase
        .from('conversas')
        .update({ mensagem: new_content })
        .eq('id', message_id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          edited_on_whatsapp: false, 
          reason: 'Mensagem sem ID do WhatsApp - editada apenas no CRM' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar conexão WhatsApp da empresa
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('company_id', company_id)
      .single();

    if (connError || !connection) {
      console.error('❌ Conexão WhatsApp não encontrada:', connError);
      return new Response(
        JSON.stringify({ error: 'Conexão WhatsApp não encontrada', code: 'NO_CONNECTION' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const origemApi = mensagem.origem_api || connection.api_provider || 'evolution';
    let editedOnWhatsApp = false;
    let editError = null;

    // Tentar editar via Evolution API
    if (origemApi === 'evolution' || origemApi === 'both') {
      const EVOLUTION_API_URL = connection.evolution_api_url || Deno.env.get("EVOLUTION_API_URL") || "";
      const EVOLUTION_API_KEY = connection.evolution_api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
      const instanceName = connection.instance_name;

      if (EVOLUTION_API_URL && EVOLUTION_API_KEY && instanceName) {
        try {
          const numero = mensagem.telefone_formatado || mensagem.numero;
          const remoteJid = numero.includes('@') ? numero : `${numero.replace(/[^0-9]/g, '')}@s.whatsapp.net`;

          const editUrl = `${EVOLUTION_API_URL}/chat/updateMessage/${instanceName}`;
          console.log('📝 [EDIT] Enviando edição para Evolution API:', editUrl);

          const response = await fetch(editUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': EVOLUTION_API_KEY,
            },
            body: JSON.stringify({
              number: remoteJid,
              text: new_content,
              key: {
                remoteJid: remoteJid,
                fromMe: true,
                id: mensagem.whatsapp_message_id,
              },
            }),
          });

          const result = await response.json();

          if (response.ok) {
            console.log('✅ [EDIT] Mensagem editada no WhatsApp via Evolution');
            editedOnWhatsApp = true;
          } else {
            console.error('❌ [EDIT] Erro ao editar via Evolution:', result);
            editError = result?.response?.message || 'Erro ao editar via Evolution API';
          }
        } catch (err) {
          console.error('❌ [EDIT] Exceção ao editar via Evolution:', err);
          editError = String(err);
        }
      }
    }

    // Meta API não suporta edição de mensagens
    if (origemApi === 'meta' && !editedOnWhatsApp) {
      editError = 'A API Oficial da Meta não suporta edição de mensagens enviadas';
    }

    // Atualizar conteúdo no banco independentemente
    const { error: updateError } = await supabase
      .from('conversas')
      .update({ mensagem: new_content })
      .eq('id', message_id);

    if (updateError) {
      console.error('❌ [EDIT] Erro ao atualizar no banco:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        edited_on_whatsapp: editedOnWhatsApp,
        error: editError,
        message: editedOnWhatsApp 
          ? 'Mensagem editada no WhatsApp e no CRM' 
          : `Mensagem editada apenas no CRM. ${editError || ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ [EDIT] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
