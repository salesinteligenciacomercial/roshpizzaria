import { useState, useRef } from "react";
import { 
  Upload, 
  File, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  X, 
  Download,
  ExternalLink,
  FileText,
  Video,
  Music
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FileAttachmentProps {
  onFileUploaded: (url: string, fileName: string, fileType: string) => void;
  onLinkAdded: (url: string, title: string) => void;
  trigger?: React.ReactNode;
}

export function FileAttachment({ onFileUploaded, onLinkAdded, trigger }: FileAttachmentProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `process-files/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('internal-chat-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('internal-chat-media')
        .getPublicUrl(filePath);

      onFileUploaded(publicUrl.publicUrl, file.name, file.type);
      setOpen(false);
      toast.success('Arquivo anexado!');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao fazer upload do arquivo');
    } finally {
      setUploading(false);
    }
  };

  const handleLinkAdd = () => {
    if (!linkUrl.trim()) {
      toast.error('URL é obrigatória');
      return;
    }

    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    onLinkAdded(url, linkTitle || url);
    setLinkUrl("");
    setLinkTitle("");
    setOpen(false);
    toast.success('Link adicionado!');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" />
            Anexar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Anexo</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="file" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file" className="gap-2">
              <File className="h-4 w-4" />
              Arquivo
            </TabsTrigger>
            <TabsTrigger value="link" className="gap-2">
              <LinkIcon className="h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="mt-4">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
                "hover:border-primary hover:bg-primary/5"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.mp4,.mp3,.wav"
              />
              
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 rounded-full bg-primary/10">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <p className="font-medium">
                  {uploading ? 'Enviando...' : 'Clique ou arraste arquivo'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Imagens, PDFs, documentos (máx. 10MB)
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Imagens</span>
              <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> PDFs</span>
              <span className="flex items-center gap-1"><File className="h-3 w-3" /> Docs</span>
              <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Vídeos</span>
              <span className="flex items-center gap-1"><Music className="h-3 w-3" /> Áudio</span>
            </div>
          </TabsContent>

          <TabsContent value="link" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                placeholder="https://exemplo.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-title">Título (opcional)</Label>
              <Input
                id="link-title"
                placeholder="Nome do link"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleLinkAdd}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Adicionar Link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Component to display file attachments in blocks
interface AttachmentDisplayProps {
  url: string;
  fileName: string;
  fileType: string;
  onRemove?: () => void;
}

export function AttachmentDisplay({ url, fileName, fileType, onRemove }: AttachmentDisplayProps) {
  const isImage = fileType.startsWith('image/');
  const isPdf = fileType === 'application/pdf';
  const isVideo = fileType.startsWith('video/');
  const isAudio = fileType.startsWith('audio/');

  const getIcon = () => {
    if (isImage) return <ImageIcon className="h-5 w-5" />;
    if (isPdf) return <FileText className="h-5 w-5" />;
    if (isVideo) return <Video className="h-5 w-5" />;
    if (isAudio) return <Music className="h-5 w-5" />;
    return <File className="h-5 w-5" />;
  };

  if (isImage) {
    return (
      <div className="relative group rounded-lg overflow-hidden border">
        <img 
          src={url} 
          alt={fileName} 
          className="max-w-full max-h-96 object-contain"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
          {onRemove && (
            <Button variant="destructive" size="sm" onClick={onRemove}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 group">
      <div className="p-2 rounded bg-primary/10 text-primary">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground">{fileType}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <a href={url} download={fileName}>
          <Button variant="ghost" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Button variant="ghost" size="sm">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
        {onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
}

// Component to display links
interface LinkDisplayProps {
  url: string;
  title: string;
  onRemove?: () => void;
}

export function LinkDisplay({ url, title, onRemove }: LinkDisplayProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors group">
      <div className="p-2 rounded bg-blue-500/10 text-blue-600">
        <LinkIcon className="h-5 w-5" />
      </div>
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex-1 min-w-0"
      >
        <p className="font-medium text-sm truncate hover:underline text-blue-600">
          {title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{url}</p>
      </a>
      {onRemove && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}
