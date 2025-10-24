import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Paperclip, 
  Image as ImageIcon, 
  File, 
  Video, 
  Mic,
  X,
  Send,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface MediaUploadProps {
  onSendMedia: (file: File, caption: string, type: string) => Promise<void>;
}

export function MediaUpload({ onSendMedia }: MediaUploadProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (max 20MB)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 20MB");
      return;
    }

    setSelectedFile(file);

    // Criar preview para imagens e vídeos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview("");
    }
  };

  const getFileType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/pdf') return 'pdf';
    return 'document';
  };

  const handleSend = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo");
      return;
    }

    setUploading(true);
    try {
      const fileType = getFileType(selectedFile);
      await onSendMedia(selectedFile, caption, fileType);
      
      // Resetar formulário
      setSelectedFile(null);
      setPreview("");
      setCaption("");
      setOpen(false);
      
      toast.success("Mídia enviada com sucesso!");
    } catch (error: any) {
      console.error('Erro ao enviar mídia:', error);
      toast.error(error.message || "Erro ao enviar mídia");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setPreview("");
    setCaption("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <File className="h-8 w-8" />;
    
    const type = getFileType(selectedFile);
    switch(type) {
      case 'image': return <ImageIcon className="h-8 w-8 text-blue-500" />;
      case 'video': return <Video className="h-8 w-8 text-purple-500" />;
      case 'audio': return <Mic className="h-8 w-8 text-green-500" />;
      case 'pdf': return <File className="h-8 w-8 text-red-500" />;
      default: return <File className="h-8 w-8 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="hover:bg-primary/10">
          <Paperclip className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar Mídia</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {!selectedFile ? (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
              />
              
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', 'image/*');
                  }}
                >
                  <ImageIcon className="h-6 w-6 text-blue-500" />
                  <span className="text-sm">Imagem</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', 'video/*');
                  }}
                >
                  <Video className="h-6 w-6 text-purple-500" />
                  <span className="text-sm">Vídeo</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', 'audio/*');
                  }}
                >
                  <Mic className="h-6 w-6 text-green-500" />
                  <span className="text-sm">Áudio</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-24 flex-col gap-2"
                  onClick={() => {
                    fileInputRef.current?.click();
                    fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx');
                  }}
                >
                  <File className="h-6 w-6 text-red-500" />
                  <span className="text-sm">Documento</span>
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Tamanho máximo: 20MB
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="relative">
                {preview && (getFileType(selectedFile) === 'image' || getFileType(selectedFile) === 'video') ? (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    {getFileType(selectedFile) === 'image' ? (
                      <img src={preview} alt="Preview" className="w-full h-auto max-h-64 object-contain" />
                    ) : (
                      <video src={preview} controls className="w-full h-auto max-h-64" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                    {getFileIcon()}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                    </div>
                  </div>
                )}
                
                <Button
                  size="icon"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Caption */}
              <div className="space-y-2">
                <Label>Legenda (opcional)</Label>
                <Textarea
                  placeholder="Adicione uma legenda..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={uploading}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
