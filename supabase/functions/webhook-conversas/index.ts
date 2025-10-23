import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Detectar se o payload é da Evolution API
function isEvolutionAPIPayload(body: any): boolean {
  return body.event === 'messages.upsert' && body.data?.key?.remoteJid;
}

// Transformar payload da Evolution API para formato do CRM
function transformEvolutionPayload(body: any) {
  const data = body.data;
  
  // Extrair número (remover @s.whatsapp.net)
  const numero = data.key.remoteJid.replace('@s.whatsapp.net', '');
  
  // Extrair mensagem e tipo
  let mensagem = '';
  let tipo_mensagem = 'text';
  let midia_url = null;
  
  if (data.message.conversation) {
    mensagem = data.message.conversation;
    tipo_mensagem = 'texto';
  } else if (data.message.extendedTextMessage?.text) {
    mensagem = data.message.extendedTextMessage.text;
    tipo_mensagem = 'texto';
  } else if (data.message.imageMessage) {
    mensagem = data.message.imageMessage.caption || '[Imagem]';
    tipo_mensagem = 'image';
    midia_url = data.message.imageMessage.url || null;
  } else if (data.message.audioMessage) {
    mensagem = '[Áudio]';
    tipo_mensagem = 'audio';
    midia_url = data.message.audioMessage.url || null;
  } else if (data.message.videoMessage) {
    mensagem = data.message.videoMessage.caption || '[Vídeo]';
    tipo_mensagem = 'video';
    midia_url = data.message.videoMessage.url || null;
  } else if (data.message.documentMessage) {
    mensagem = `[Documento: ${data.message.documentMessage.fileName || 'arquivo'}]`;
    tipo_mensagem = 'document';
    midia_url = data.message.documentMessage.url || null;
  } else {
    mensagem = '[Mensagem não suportada]';
    tipo_mensagem = 'text';
  }
  
  return {
    numero,
    mensagem,
    origem: 'WhatsApp',
    tipo_mensagem,
    midia_url,
    nome_contato: data.pushName || 'Desconhecido'
  };
}

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
    
    // Detectar origem do payload
    const isEvolutionAPI = isEvolutionAPIPayload(body);
    console.log('📩 Webhook recebido:', {
      origem: isEvolutionAPI ? 'Evolution API (direto)' : 'N8N',
      payload: body
    });

    // Transformar payload se vier da Evolution API
    let payload = body;
    if (isEvolutionAPI) {
      try {
        payload = transformEvolutionPayload(body);
        console.log('✅ Payload transformado:', payload);
      } catch (transformError) {
        console.error('❌ Erro ao transformar payload da Evolution API:', transformError);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao processar payload da Evolution API',
            details: transformError instanceof Error ? transformError.message : 'Erro desconhecido'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    const { numero, mensagem, origem = 'WhatsApp', tipo_mensagem = 'text', midia_url, nome_contato } = payload;

    // Validações N8N (apenas se não vier da Evolution API)
    if (!isEvolutionAPI) {
      const hasUnsubstitutedVars = (value: string) => {
        return value?.includes('{{') || value?.includes('$json') || value?.includes('=$json');
      };

      const isInvalidData = (value: string) => {
        return !value || value.trim() === '' || value === '=' || value === '[object Object]' || value.startsWith('=');
      };

      if (hasUnsubstitutedVars(numero) || hasUnsubstitutedVars(mensagem) || hasUnsubstitutedVars(nome_contato || '')) {
        console.error('❌ Variáveis N8n não substituídas detectadas:', body);
        return new Response(
          JSON.stringify({
            error: 'Variáveis não substituídas detectadas no N8n.',
            details: 'Configure o node "Set" corretamente. Exemplo: numero deve ser $json.numero (sem = no início)'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (isInvalidData(numero) || isInvalidData(mensagem)) {
        console.error('❌ Dados inválidos recebidos:', body);
        return new Response(
          JSON.stringify({
            error: 'Dados inválidos recebidos.',
            details: `numero: ${numero}, mensagem: ${mensagem}. Verifique o node Function no N8n.`,
            fix: 'O node Function deve retornar strings válidas, não objetos ou valores vazios.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // Validação geral (para ambos formatos)
    if (!numero || !mensagem) {
      console.error('❌ Dados incompletos:', payload);
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
