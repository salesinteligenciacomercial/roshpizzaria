export async function enviarLembreteWhatsApp(numero: string, mensagem: string) {
  const baseUrl = import.meta.env.VITE_EVOLUTION_API as string;
  const apiKey = import.meta.env.VITE_EVOLUTION_KEY as string;
  if (!baseUrl || !apiKey) {
    console.warn('EVOLUTION API não configurada');
    return { error: 'Configuração ausente' } as const;
  }

  const url = `${baseUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(numero)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify({ message: mensagem }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Erro Evolution API:', text);
    return { error: text || 'Erro ao enviar WhatsApp' } as const;
  }
  return { success: true } as const;
}


