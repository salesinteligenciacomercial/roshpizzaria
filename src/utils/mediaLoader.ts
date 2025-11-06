/**
 * Utilitário para carregar mídias do WhatsApp através da edge function
 */

export async function getMediaUrl(messageId: string): Promise<string> {
  try {
    console.log('🔄 [MEDIA-LOADER] Carregando mídia:', messageId);
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messageId }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [MEDIA-LOADER] Erro:', response.status, errorText);
      throw new Error(`Erro ao carregar mídia: ${response.status}`);
    }

    console.log('✅ [MEDIA-LOADER] Mídia carregada com sucesso');

    // Criar blob URL a partir da resposta
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    console.log('🎯 [MEDIA-LOADER] Blob URL criada:', url);
    return url;
  } catch (error) {
    console.error('❌ [MEDIA-LOADER] Erro geral:', error);
    throw error;
  }
}
