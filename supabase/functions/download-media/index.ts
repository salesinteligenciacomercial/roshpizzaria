import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createMediaResponse(base64Data: string, mimetype: string) {
  // Converter base64 para ArrayBuffer
  const base64Clean = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimetype });
  
  return new Response(blob, {
    headers: {
      ...corsHeaders,
      'Content-Type': mimetype,
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

    const body = await req.json();
    
    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Validar dados recebidos
    if (!body.company_id || !body.messageId) {
      throw new Error('company_id e messageId são obrigatórios');
    }

    console.log('🔓 [DOWNLOAD-MEDIA] Baixando mídia via Evolution API');
    console.log('📡 [DOWNLOAD-MEDIA] MessageID:', body.messageId);
    console.log('🏢 [DOWNLOAD-MEDIA] CompanyID:', body.company_id);
    
    // Buscar configuração da instância WhatsApp
    const { data: whatsappConfig, error: configError } = await supabase
      .from('whatsapp_connections')
      .select('instance_name, evolution_api_url, evolution_api_key')
      .eq('company_id', body.company_id)
      .eq('status', 'connected')
      .single();

    if (configError || !whatsappConfig) {
      console.error('❌ [DOWNLOAD-MEDIA] Instância não encontrada:', configError);
      throw new Error('Instância WhatsApp não configurada');
    }

    console.log('✅ [DOWNLOAD-MEDIA] Instância encontrada:', whatsappConfig.instance_name);
    
    // Endpoint correto da Evolution API v2 para baixar mídia em base64
    const evolutionUrl = `${whatsappConfig.evolution_api_url}/chat/getBase64FromMediaMessage/${whatsappConfig.instance_name}`;
    
    console.log('📞 [DOWNLOAD-MEDIA] Chamando Evolution API:', evolutionUrl);
    console.log('📦 [DOWNLOAD-MEDIA] Payload:', JSON.stringify({
      message: {
        key: {
          id: body.messageId
        }
      }
    }));
    
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': whatsappConfig.evolution_api_key,
      },
      body: JSON.stringify({
        message: {
          key: {
            id: body.messageId
          }
        },
        convertToMp4: body.type === 'video'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [DOWNLOAD-MEDIA] Erro Evolution API:', response.status, errorText);
      
      // Retornar erro específico para mídia expirada/indisponível
      if (response.status === 400 || response.status === 404) {
        return new Response(
          JSON.stringify({ 
            error: 'media_expired', 
            message: 'Mídia expirada ou indisponível. Mídias do WhatsApp expiram após alguns dias.' 
          }),
          { 
            status: 410, // Gone - indica que o recurso não está mais disponível
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      throw new Error(`Erro ao baixar mídia da Evolution API: ${response.status}`);
    }

    const mediaData = await response.json();
    console.log('✅ [DOWNLOAD-MEDIA] Resposta Evolution API recebida');

    if (mediaData.base64) {
      console.log('✅ [DOWNLOAD-MEDIA] Mídia em base64 recebida');
      // Detectar mimetype do base64
      let mimetype = 'application/octet-stream';
      if (mediaData.base64.startsWith('data:')) {
        const match = mediaData.base64.match(/data:([^;]+);/);
        if (match) mimetype = match[1];
      } else {
        // Usar tipo baseado no tipo da mensagem ou mimetype enviado
        if (body.mimetype) {
          mimetype = body.mimetype;
        } else if (body.type === 'image') {
          mimetype = 'image/jpeg';
        } else if (body.type === 'video') {
          mimetype = 'video/mp4';
        } else if (body.type === 'audio') {
          mimetype = 'audio/ogg; codecs=opus';
        } else if (body.type === 'document') {
          mimetype = 'application/pdf';
        }
      }
      
      console.log('📤 [DOWNLOAD-MEDIA] Retornando base64 com mimetype:', mimetype);
      
      // Retornar JSON com base64 para o frontend processar
      return new Response(
        JSON.stringify({ 
          base64: mediaData.base64.includes(',') ? mediaData.base64.split(',')[1] : mediaData.base64,
          mimetype: mimetype 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw new Error('Mídia não retornada pela Evolution API');

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
