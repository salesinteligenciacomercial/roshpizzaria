/**
 * Utilitário para carregar mídias do WhatsApp através da edge function
 */

export async function getMediaUrl(messageId: string): Promise<string> {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-media`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messageId }),
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao carregar mídia');
  }

  // Criar blob URL a partir da resposta
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
