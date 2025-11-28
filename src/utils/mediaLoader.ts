import { supabase } from "@/integrations/supabase/client";

/**
 * Utilitário para carregar mídias do WhatsApp através da edge function
 */

export async function getMediaUrl(messageId: string, type?: string): Promise<string> {
  try {
    console.log('🔄 [MEDIA-LOADER] Carregando mídia:', { messageId, type });
    
    // Primeiro, buscar a mídia do banco
    const { data: message } = await supabase
      .from('conversas')
      .select('midia_url, tipo_mensagem, company_id')
      .eq('id', messageId)
      .single();

    if (!message?.midia_url) {
      console.error('❌ [MEDIA-LOADER] Mídia não encontrada no banco');
      throw new Error('Mídia não encontrada');
    }

    console.log('📦 [MEDIA-LOADER] Dados da mídia:', {
      tipo: typeof message.midia_url,
      tamanho: message.midia_url.length,
      inicio: message.midia_url.substring(0, 50)
    });

    // Se já for data URI (base64), retornar direto
    if (message.midia_url.startsWith('data:')) {
      console.log('✅ [MEDIA-LOADER] Usando data URI existente (base64)');
      return message.midia_url;
    }

    // Se for JSON com metadados de mídia criptografada
    try {
      const mediaData = JSON.parse(message.midia_url);
      if (mediaData.messageId && mediaData.url) {
        console.log('🔓 [MEDIA-LOADER] Baixando mídia via Evolution API:', {
          messageId: mediaData.messageId,
          tipo: mediaData.type,
          company_id: message.company_id
        });
        
        // Chamar edge function que usa Evolution API
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-media`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ 
              company_id: message.company_id,
              messageId: mediaData.messageId,
              type: mediaData.type || type || message.tipo_mensagem
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [MEDIA-LOADER] Erro na edge function:', {
            status: response.status,
            error: errorText
          });
          throw new Error(`Erro ao baixar mídia: ${response.status} - ${errorText}`);
        }

        // A edge function retorna o blob da mídia
        const blob = await response.blob();
        
        // Para áudio, garantir que o tipo MIME correto seja usado
        let finalBlob = blob;
        if (type === 'audio' || message.tipo_mensagem === 'audio') {
          // Se o blob não tem um tipo adequado, forçar o tipo correto
          if (!blob.type || blob.type === 'application/octet-stream') {
            finalBlob = new Blob([blob], { type: 'audio/ogg; codecs=opus' });
          }
        }
        
        const url = URL.createObjectURL(finalBlob);
        console.log('✅ [MEDIA-LOADER] Mídia carregada via Evolution API:', {
          blobSize: finalBlob.size,
          blobType: finalBlob.type,
          mediaType: type || message.tipo_mensagem
        });
        return url;
      }
    } catch (jsonError) {
      // Não é JSON, pode ser URL simples
      console.log('🌐 [MEDIA-LOADER] Não é JSON, tentando como URL simples');
    }

    // Fallback: tentar carregar URL diretamente
    const response = await fetch(message.midia_url);
    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      console.log('✅ [MEDIA-LOADER] Download direto bem-sucedido');
      return url;
    }

    throw new Error('Não foi possível carregar a mídia');
  } catch (error) {
    console.error('❌ [MEDIA-LOADER] Erro geral:', error);
    throw error;
  }
}
