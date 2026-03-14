/**
 * Converte áudio WebM/Opus para MP3 (audio/mpeg) usando lamejs.
 * A Meta API (WhatsApp) suporta audio/mpeg nativamente como áudio reproduzível.
 * WebM não é suportado pela Meta e chega como documento.
 */

// @ts-ignore - lamejs não tem tipos TypeScript
import lamejs from 'lamejs';

export async function convertWebmToMp3(webmBlob: Blob): Promise<Blob> {
  console.log('🔄 [AudioConverter] Convertendo WebM para MP3...');
  const startTime = performance.now();

  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    const arrayBuffer = await webmBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const samples = audioBuffer.getChannelData(0); // Use mono for smaller file

    // Encode to MP3 at 128kbps mono
    const mp3Encoder = new lamejs.Mp3Encoder(1, sampleRate, 128);
    const mp3Data: Int8Array[] = [];
    const sampleBlockSize = 1152;

    // Convert Float32 samples to Int16
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Encode in blocks
    for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
      const chunk = int16Samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }
    }

    // Flush remaining data
    const end = mp3Encoder.flush();
    if (end.length > 0) {
      mp3Data.push(new Int8Array(end));
    }

    const mp3Blob = new Blob(mp3Data, { type: 'audio/mpeg' });
    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`✅ [AudioConverter] Conversão concluída em ${elapsed}ms. Tamanho: ${(mp3Blob.size / 1024).toFixed(1)}KB (original: ${(webmBlob.size / 1024).toFixed(1)}KB)`);

    return mp3Blob;
  } finally {
    await audioContext.close();
  }
}

/**
 * Verifica se o blob precisa de conversão para ser enviado pela Meta API.
 * Formatos suportados pela Meta: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg
 */
export function needsConversion(mimeType: string): boolean {
  const clean = (mimeType || '').split(';')[0].trim().toLowerCase();
  const supported = ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'];
  return !supported.includes(clean);
}
