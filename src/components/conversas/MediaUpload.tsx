import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface MediaUploadProps {
  onFileSelected: (file: File, caption: string, type: string) => void;
}

export function MediaUpload({ onFileSelected }: MediaUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📎 [MEDIA-UPLOAD] Arquivo selecionado:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    // ⚡ VALIDAÇÃO: Rejeitar arquivos vazios
    if (file.size === 0) {
      console.error('❌ [MEDIA-UPLOAD] Arquivo está vazio (0 bytes)');
      alert('O arquivo selecionado está vazio. Por favor, escolha outro arquivo.');
      // Resetar input para permitir nova seleção
      event.target.value = '';
      return;
    }

    // ⚡ VALIDAÇÃO: Limite de tamanho (16MB)
    if (file.size > 16 * 1024 * 1024) {
      console.error('❌ [MEDIA-UPLOAD] Arquivo muito grande:', file.size);
      alert('O arquivo é muito grande. Tamanho máximo: 16MB');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      // ⚡ CORREÇÃO: Determinar tipo do arquivo baseado no mimeType
      let fileType = 'document';
      if (file.type.startsWith('image/')) {
        fileType = 'image';
      } else if (file.type.startsWith('video/')) {
        fileType = 'video';
      } else if (file.type.startsWith('audio/')) {
        fileType = 'audio';
      } else if (file.type === 'application/pdf') {
        fileType = 'pdf';
      }

      console.log('✅ [MEDIA-UPLOAD] Passando arquivo para envio:', {
        type: fileType,
        size: file.size
      });

      onFileSelected(file, '', fileType);
    } finally {
      setUploading(false);
      // Resetar input após envio para permitir reenvio do mesmo arquivo
      event.target.value = '';
    }
  };

  return (
    <div className="relative">
              <input
                type="file"
        id="media-upload"
                className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
        disabled={uploading}
              />
                <Button
        type="button"
        variant="ghost"
                  size="icon"
        onClick={() => document.getElementById('media-upload')?.click()}
                  disabled={uploading}
      >
        <Paperclip className="h-4 w-4" />
                </Button>
              </div>
  );
}
