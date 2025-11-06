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

    console.log('🔍 [DOWNLOAD-MEDIA] Buscando mensagem:', messageId);

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar mensagem no banco
    const { data: message, error: msgError } = await supabase
      .from('conversas')
      .select('midia_url, tipo_mensagem, arquivo_nome, numero, company_id')
      .eq('id', messageId)
      .single();

    if (msgError || !message) {
      console.error('❌ [DOWNLOAD-MEDIA] Mensagem não encontrada:', msgError);
      throw new Error('Mensagem não encontrada');
    }

    if (!message.midia_url) {
      throw new Error('Mensagem não possui mídia');
    }

    console.log('📱 [DOWNLOAD-MEDIA] Tipo:', message.tipo_mensagem);
    console.log('📎 [DOWNLOAD-MEDIA] URL:', message.midia_url);

    // Buscar configuração da instância WhatsApp
    const { data: whatsappConfig } = await supabase
      .from('whatsapp_connections')
      .select('instance_name, evolution_api_url, evolution_api_key')
      .eq('company_id', message.company_id)
      .eq('status', 'connected')
      .single();

    if (!whatsappConfig) {
      console.warn('⚠️ [DOWNLOAD-MEDIA] Instância não encontrada, tentando acesso direto...');
      // Tentar acesso direto como fallback
      const response = await fetch(message.midia_url);
      if (response.ok) {
        const binaryData = await response.arrayBuffer();
        return createMediaResponse(binaryData, message.tipo_mensagem);
      }
      throw new Error('Instância WhatsApp não configurada e acesso direto falhou');
    }

    console.log('🔄 [DOWNLOAD-MEDIA] Baixando via Evolution API...');
    console.log('📡 [DOWNLOAD-MEDIA] Instância:', whatsappConfig.instance_name);
    console.log('🔗 [DOWNLOAD-MEDIA] URL da mídia:', message.midia_url);

    // Usar Evolution API para baixar mídia criptografada
    const evolutionUrl = `${whatsappConfig.evolution_api_url}/message/downloadMedia/${whatsappConfig.instance_name}`;
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': whatsappConfig.evolution_api_key,
      },
      body: JSON.stringify({
        url: message.midia_url,
        convertToMp4: message.tipo_mensagem === 'video'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [DOWNLOAD-MEDIA] Erro Evolution API:', response.status, errorText);
      
      // Tentar download direto como fallback
      console.log('⚠️ [DOWNLOAD-MEDIA] Tentando acesso direto como fallback...');
      const directResponse = await fetch(message.midia_url);
      if (directResponse.ok) {
        const binaryData = await directResponse.arrayBuffer();
        return createMediaResponse(binaryData, message.tipo_mensagem);
      }
      
      throw new Error(`Erro ao baixar mídia: ${response.status}`);
    }

    const mediaData = await response.json();
    console.log('✅ [DOWNLOAD-MEDIA] Resposta Evolution API recebida');

    if (!mediaData.base64) {
      throw new Error('Mídia não retornada pela API');
    }

    console.log('🎯 [DOWNLOAD-MEDIA] Convertendo base64 para binário...');

    // Converter base64 para ArrayBuffer
    const base64Data = mediaData.base64.includes(',') 
      ? mediaData.base64.split(',')[1] 
      : mediaData.base64;
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('✅ [DOWNLOAD-MEDIA] Mídia processada com sucesso');

    // Retornar mídia
    return createMediaResponse(bytes.buffer, message.tipo_mensagem);

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
