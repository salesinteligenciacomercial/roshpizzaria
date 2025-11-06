import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createMediaResponse(arrayBuffer: ArrayBuffer, tipoMensagem: string) {
  let contentType = 'application/octet-stream';
  if (tipoMensagem === 'image') {
    contentType = 'image/jpeg';
  } else if (tipoMensagem === 'video') {
    contentType = 'video/mp4';
  } else if (tipoMensagem === 'audio') {
    contentType = 'audio/ogg';
  }

  const blob = new Blob([arrayBuffer], { type: contentType });
  
  return new Response(blob, {
    headers: {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 [DOWNLOAD-MEDIA] Iniciando download de mídia...');

    const { messageId } = await req.json();
    
    if (!messageId) {
      throw new Error('messageId é obrigatório');
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mensagem no banco
    console.log('🔍 [DOWNLOAD-MEDIA] Buscando mensagem:', messageId);
    const { data: message, error: msgError } = await supabase
      .from('conversas')
      .select('midia_url, tipo_mensagem, arquivo_nome, numero, company_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      throw new Error('Mensagem não encontrada');
    }

    if (!message.midia_url) {
      throw new Error('Mensagem não possui mídia');
    }

    console.log('📱 [DOWNLOAD-MEDIA] Tipo:', message.tipo_mensagem);

    // Buscar configuração da Evolution API para esta company
    const { data: whatsappConfig } = await supabase
      .from('whatsapp_instances')
      .select('instance_name')
      .eq('company_id', message.company_id)
      .eq('status', 'connected')
      .single();

    if (!whatsappConfig?.instance_name) {
      throw new Error('Instância WhatsApp não configurada');
    }

    const evolutionUrl = Deno.env.get('VITE_EVOLUTION_API')!;
    const evolutionKey = Deno.env.get('VITE_EVOLUTION_KEY')!;

    // Fazer download da mídia através da Evolution API
    console.log('🔄 [DOWNLOAD-MEDIA] Baixando mídia via Evolution API...');
    
    const downloadUrl = `${evolutionUrl}/message/download-media/${whatsappConfig.instance_name}`;
    
    const response = await fetch(downloadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify({
        url: message.midia_url
      })
    });

    if (!response.ok) {
      console.error('❌ [DOWNLOAD-MEDIA] Erro da Evolution API:', response.status);
      // Tentar fazer fetch direto como fallback
      console.log('⚠️ [DOWNLOAD-MEDIA] Tentando download direto...');
      const directResponse = await fetch(message.midia_url);
      if (!directResponse.ok) {
        throw new Error('Erro ao baixar mídia');
      }
      const binaryData = await directResponse.arrayBuffer();
      return createMediaResponse(binaryData, message.tipo_mensagem);
    }

    console.log('✅ [DOWNLOAD-MEDIA] Mídia baixada com sucesso');

    // Retornar os dados binários diretamente
    const binaryData = await response.arrayBuffer();

    // Determinar content-type e retornar
    return createMediaResponse(binaryData, message.tipo_mensagem);

  } catch (error) {
    console.error('❌ [DOWNLOAD-MEDIA] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
