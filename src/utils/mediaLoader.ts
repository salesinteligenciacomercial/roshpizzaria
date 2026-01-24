import { supabase } from "@/integrations/supabase/client";

/**
 * Utilitário para carregar mídias do WhatsApp através da edge function
 * Suporta tanto Evolution API quanto Meta API
 * 
 * ⚡ CORREÇÃO: Agora salva mídias permanentemente no Supabase Storage
 * para que PDFs e outros arquivos não desapareçam ao recarregar a página
 */

// Cache para URLs permanentes (evita reprocessamento)
const permanentUrlCache = new Map<string, string>();

// Set para evitar uploads duplicados em paralelo
const uploadingMedia = new Set<string>();

/**
 * Salva mídia no Supabase Storage e retorna URL permanente
 */
async function saveMediaToStorage(
  messageId: string,
  base64Data: string,
  mimeType: string,
  companyId: string
): Promise<string | null> {
  try {
    // Evitar uploads duplicados
    if (uploadingMedia.has(messageId)) {
      console.log('⏳ [MEDIA-LOADER] Upload já em andamento para:', messageId);
      return null;
    }
    
    uploadingMedia.add(messageId);
    
    // Normalizar mimeType para Storage (remove codecs que não são suportados)
    let normalizedMimeType = mimeType;
    if (mimeType.includes('audio/ogg')) {
      normalizedMimeType = 'audio/ogg';
    }
    
    // Determinar extensão do arquivo baseado no mimeType
    const extensionMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    };
    
    const extension = extensionMap[normalizedMimeType] || 'bin';
    const fileName = `${companyId}/${messageId}.${extension}`;
    
    console.log('💾 [MEDIA-LOADER] Salvando mídia no Storage:', {
      messageId,
      mimeType,
      extension,
      fileName
    });
    
    // Converter base64 para Uint8Array
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Upload para o Storage com mimeType normalizado
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('conversation-media')
      .upload(fileName, byteArray, {
        contentType: normalizedMimeType,
        upsert: true
      });
    
    if (uploadError) {
      console.error('❌ [MEDIA-LOADER] Erro no upload para Storage:', uploadError);
      uploadingMedia.delete(messageId);
      return null;
    }
    
    // Obter URL pública
    const { data: publicUrlData } = supabase
      .storage
      .from('conversation-media')
      .getPublicUrl(fileName);
    
    const permanentUrl = publicUrlData.publicUrl;
    
    console.log('✅ [MEDIA-LOADER] Mídia salva no Storage:', {
      messageId,
      url: permanentUrl.substring(0, 80)
    });
    
    // Atualizar midia_url no banco com URL permanente
    const { error: updateError } = await supabase
      .from('conversas')
      .update({ midia_url: permanentUrl })
      .eq('id', messageId);
    
    if (updateError) {
      console.error('❌ [MEDIA-LOADER] Erro ao atualizar midia_url:', updateError);
    } else {
      console.log('✅ [MEDIA-LOADER] midia_url atualizada no banco com URL permanente');
    }
    
    uploadingMedia.delete(messageId);
    return permanentUrl;
  } catch (error) {
    console.error('❌ [MEDIA-LOADER] Erro ao salvar mídia no Storage:', error);
    uploadingMedia.delete(messageId);
    return null;
  }
}

// Erro especial para mídia expirada (não quebra a UI)
export class MediaExpiredError extends Error {
  constructor(message = 'Mídia expirada ou indisponível') {
    super('MEDIA_EXPIRED');
    this.name = 'MediaExpiredError';
  }
}

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
    const { data: message, error: queryError } = await supabase
      .from('conversas')
      .select('midia_url, tipo_mensagem, company_id')
      .eq('id', messageId)
      .single();

    if (queryError) {
      console.error('❌ [MEDIA-LOADER] Erro ao buscar mensagem:', queryError);
      throw new MediaExpiredError();
    }

    if (!message?.midia_url) {
      console.error('❌ [MEDIA-LOADER] Mídia não encontrada no banco');
      throw new MediaExpiredError();
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

          // ⚡ CORREÇÃO: Verificar erro de mídia expirada tanto em data quanto em error
          if (response.data?.error === 'media_expired') {
            console.warn('⚠️ [MEDIA-LOADER] Mídia Meta expirada:', response.data.message);
            throw new Error('MEDIA_EXPIRED');
          }

          // Quando status é 410, o SDK coloca o erro em response.error
          if (response.error) {
            const errorContext = response.error?.context;
            // Tentar extrair o body JSON do erro
            try {
              const errorBody = errorContext?.body ? JSON.parse(errorContext.body) : null;
              if (errorBody?.error === 'media_expired') {
                console.warn('⚠️ [MEDIA-LOADER] Mídia Meta expirada (via error):', errorBody.message);
                throw new Error('MEDIA_EXPIRED');
              }
            } catch {}
            
            // Verificar se a mensagem de erro indica mídia expirada
            const errorMessage = response.error.message || String(response.error);
            if (errorMessage.includes('media_expired') || errorMessage.includes('410')) {
              console.warn('⚠️ [MEDIA-LOADER] Mídia Meta expirada (erro 410)');
              throw new Error('MEDIA_EXPIRED');
            }
            
            console.error('❌ [MEDIA-LOADER] Erro na edge function Meta:', response.error);
            throw new Error(`Erro ao baixar mídia Meta: ${response.error.message}`);
          }

          const base64Data = response.data?.base64;
          const mimeType = response.data?.mimetype || mediaData.mimetype || 'application/octet-stream';
          
          if (!base64Data) {
            console.error('❌ [MEDIA-LOADER] Edge function não retornou base64');
            throw new Error('Edge function não retornou dados');
          }

          // ⚡ CORREÇÃO: Salvar no Storage para URL permanente
          const permanentUrl = await saveMediaToStorage(messageId, base64Data, mimeType, message.company_id);
          
          if (permanentUrl) {
            permanentUrlCache.set(messageId, permanentUrl);
            console.log('✅ [MEDIA-LOADER] Mídia Meta salva permanentemente');
            return permanentUrl;
          }

          // Fallback: Converter base64 para blob se Storage falhar
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          
          const url = URL.createObjectURL(blob);
          console.log('✅ [MEDIA-LOADER] Mídia Meta carregada (blob URL temporária):', {
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

          // ⚡ CORREÇÃO: Verificar erro de mídia expirada tanto em data quanto em error
          if (response.data?.error === 'media_expired') {
            console.warn('⚠️ [MEDIA-LOADER] Mídia Evolution expirada:', response.data.message);
            throw new Error('MEDIA_EXPIRED');
          }

          // Quando status é 410, o SDK coloca o erro em response.error
          if (response.error) {
            const errorContext = response.error?.context;
            // Tentar extrair o body JSON do erro
            try {
              const errorBody = errorContext?.body ? JSON.parse(errorContext.body) : null;
              if (errorBody?.error === 'media_expired') {
                console.warn('⚠️ [MEDIA-LOADER] Mídia Evolution expirada (via error):', errorBody.message);
                throw new Error('MEDIA_EXPIRED');
              }
            } catch {}
            
            // Verificar se a mensagem de erro indica mídia expirada
            const errorMessage = response.error.message || String(response.error);
            if (errorMessage.includes('media_expired') || errorMessage.includes('410')) {
              console.warn('⚠️ [MEDIA-LOADER] Mídia Evolution expirada (erro 410)');
              throw new Error('MEDIA_EXPIRED');
            }
            
            console.error('❌ [MEDIA-LOADER] Erro na edge function Evolution:', response.error);
            throw new Error(`Erro ao baixar mídia: ${response.error.message}`);
          }

          const base64Data = response.data?.base64;
          const mimeType = response.data?.mimetype || mediaData.mimetype || 'audio/ogg; codecs=opus';
          
          if (!base64Data) {
            console.error('❌ [MEDIA-LOADER] Edge function não retornou base64');
            throw new Error('Edge function não retornou dados');
          }

          // ⚡ CORREÇÃO: Salvar no Storage para URL permanente
          const permanentUrl = await saveMediaToStorage(messageId, base64Data, mimeType, message.company_id);
          
          if (permanentUrl) {
            permanentUrlCache.set(messageId, permanentUrl);
            console.log('✅ [MEDIA-LOADER] Mídia Evolution salva permanentemente');
            return permanentUrl;
          }

          // Fallback: Converter base64 para blob se Storage falhar
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          
          const url = URL.createObjectURL(blob);
          console.log('✅ [MEDIA-LOADER] Mídia Evolution carregada (blob URL temporária):', {
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
  } catch (error: any) {
    console.error('❌ [MEDIA-LOADER] Erro geral:', error);
    
    // Sempre converter para MediaExpiredError para evitar quebrar a UI
    if (error?.message === 'MEDIA_EXPIRED' || error instanceof MediaExpiredError) {
      throw new MediaExpiredError();
    }
    
    // Erros de rede ou outros também resultam em mídia indisponível
    throw new MediaExpiredError();
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
