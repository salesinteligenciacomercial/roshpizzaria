import { supabase } from "@/integrations/supabase/client";

/**
 * Utilitário para carregar mídias do WhatsApp através da edge function
 * Suporta tanto Evolution API quanto Meta API
 */

// Cache para URLs permanentes (evita reprocessamento)
const permanentUrlCache = new Map<string, string>();

export async function getMediaUrl(messageId: string, type?: string): Promise<string> {
  try {
    // Verificar cache primeiro
    const cachedUrl = permanentUrlCache.get(messageId);
    if (cachedUrl) {
      console.log('✅ [MEDIA-LOADER] URL do cache:', { messageId, url: cachedUrl.substring(0, 50) });
      return cachedUrl;
    }
    
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
      inicio: message.midia_url.substring(0, 100)
    });

    // ⚡ PRIORIDADE 1: Se for URL do Supabase Storage, retornar direto (URL permanente)
    if (message.midia_url.includes('supabase.co/storage/') || 
        message.midia_url.includes('/storage/v1/object/')) {
      console.log('✅ [MEDIA-LOADER] URL permanente do Supabase Storage detectada');
      permanentUrlCache.set(messageId, message.midia_url);
      return message.midia_url;
    }

    // Se já for data URI (base64), retornar direto
    if (message.midia_url.startsWith('data:')) {
      console.log('✅ [MEDIA-LOADER] Usando data URI existente (base64)');
      return message.midia_url;
    }

    // Se for JSON com metadados de mídia
    try {
      const mediaData = JSON.parse(message.midia_url);
      
      // Verificar se tem URL do Storage dentro do JSON
      if (mediaData.storageUrl || mediaData.storage_url) {
        const storageUrl = mediaData.storageUrl || mediaData.storage_url;
        console.log('✅ [MEDIA-LOADER] URL de Storage encontrada no JSON');
        permanentUrlCache.set(messageId, storageUrl);
        return storageUrl;
      }
      
      // Detectar se é mídia da Meta API
      if (mediaData.source === 'meta' && mediaData.media_id) {
        console.log('🔓 [MEDIA-LOADER] Baixando mídia via Meta API:', {
          media_id: mediaData.media_id,
          mimetype: mediaData.mimetype,
          company_id: message.company_id
        });
        
        try {
          const response = await supabase.functions.invoke('download-media', {
            body: { 
              company_id: message.company_id,
              media_id: mediaData.media_id,
              source: 'meta',
              mimetype: mediaData.mimetype || type || message.tipo_mensagem,
            }
          });

          if (response.data?.error === 'media_expired') {
            console.warn('⚠️ [MEDIA-LOADER] Mídia Meta expirada:', response.data.message);
            throw new Error('MEDIA_EXPIRED');
          }

          if (response.error) {
            console.error('❌ [MEDIA-LOADER] Erro na edge function Meta:', response.error);
            throw new Error(`Erro ao baixar mídia Meta: ${response.error.message}`);
          }

          const base64Data = response.data?.base64;
          const mimeType = response.data?.mimetype || mediaData.mimetype || 'application/octet-stream';
          
          if (!base64Data) {
            console.error('❌ [MEDIA-LOADER] Edge function não retornou base64');
            throw new Error('Edge function não retornou dados');
          }

          // Converter base64 para blob
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          
          const url = URL.createObjectURL(blob);
          console.log('✅ [MEDIA-LOADER] Mídia Meta carregada:', {
            blobSize: blob.size,
            blobType: blob.type
          });
          return url;
        } catch (downloadError: any) {
          console.error('❌ [MEDIA-LOADER] Erro ao baixar mídia Meta:', downloadError);
          if (downloadError.message === 'MEDIA_EXPIRED') {
            throw downloadError;
          }
          throw downloadError;
        }
      }
      
      // Mídia Evolution API (formato antigo)
      if (mediaData.url || mediaData.mediaKey || mediaData.messageId) {
        console.log('🔓 [MEDIA-LOADER] Baixando mídia via Evolution API:', {
          messageId: mediaData.messageId,
          tipo: mediaData.type,
          company_id: message.company_id,
          hasUrl: !!mediaData.url,
          hasMediaKey: !!mediaData.mediaKey
        });
        
        try {
          const response = await supabase.functions.invoke('download-media', {
            body: { 
              company_id: message.company_id,
              messageId: mediaData.messageId,
              url: mediaData.url,
              mediaKey: mediaData.mediaKey,
              mimetype: mediaData.mimetype || type || message.tipo_mensagem,
              type: mediaData.type || type || message.tipo_mensagem
            }
          });

          if (response.data?.error === 'media_expired') {
            console.warn('⚠️ [MEDIA-LOADER] Mídia Evolution expirada:', response.data.message);
            throw new Error('MEDIA_EXPIRED');
          }

          if (response.error) {
            console.error('❌ [MEDIA-LOADER] Erro na edge function Evolution:', response.error);
            throw new Error(`Erro ao baixar mídia: ${response.error.message}`);
          }

          const base64Data = response.data?.base64;
          const mimeType = response.data?.mimetype || mediaData.mimetype || 'audio/ogg; codecs=opus';
          
          if (!base64Data) {
            console.error('❌ [MEDIA-LOADER] Edge function não retornou base64');
            throw new Error('Edge function não retornou dados');
          }

          // Converter base64 para blob
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          
          const url = URL.createObjectURL(blob);
          console.log('✅ [MEDIA-LOADER] Mídia Evolution carregada:', {
            blobSize: blob.size,
            blobType: blob.type,
            mediaType: type || message.tipo_mensagem
          });
          return url;
        } catch (downloadError: any) {
          console.error('❌ [MEDIA-LOADER] Erro ao baixar mídia Evolution:', downloadError);
          if (downloadError.message === 'MEDIA_EXPIRED') {
            throw downloadError;
          }
          throw downloadError;
        }
      }
    } catch (jsonError) {
      // Não é JSON, pode ser URL simples
      console.log('🌐 [MEDIA-LOADER] Não é JSON, tentando como URL simples');
    }

    // Fallback: tentar carregar URL diretamente
    // Se for uma URL HTTP válida, usar diretamente (é permanente)
    if (message.midia_url.startsWith('http://') || message.midia_url.startsWith('https://')) {
      console.log('✅ [MEDIA-LOADER] Usando URL HTTP diretamente (permanente)');
      permanentUrlCache.set(messageId, message.midia_url);
      return message.midia_url;
    }
    
    // Último recurso: fetch e criar blob
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

/**
 * Verifica se uma URL é permanente (não expira)
 */
export function isPermanentUrl(url: string): boolean {
  if (!url) return false;
  
  // URLs do Supabase Storage são permanentes
  if (url.includes('supabase.co/storage/') || url.includes('/storage/v1/object/')) {
    return true;
  }
  
  // URLs HTTP normais são permanentes
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Exceto blob URLs que expiram
    if (url.startsWith('blob:')) return false;
    return true;
  }
  
  // Data URIs são permanentes (estão embutidas)
  if (url.startsWith('data:')) {
    return true;
  }
  
  return false;
}
