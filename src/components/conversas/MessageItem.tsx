import { useState, memo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  CheckCheck, 
  Download, 
  Volume2, 
  FileText,
  ImageIcon,
  Video,
  Mic,
  Reply,
  User as UserIcon,
  MoreVertical,
  Smile,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import { MessageActions } from "./MessageActions";
import { PDFPreview } from "./PDFPreview";
import { toast } from "@/hooks/use-toast";
import { getMediaUrl } from "@/utils/mediaLoader";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  transcricao?: string;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error"; // MELHORIA: Status da transcrição
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
  sentBy?: string; // Nome do responsável que enviou
  contactData?: {
    name: string;
    phone: string;
  };
}

interface MessageItemProps {
  message: Message;
  allMessages?: Message[];
  onDownload?: (url: string, fileName: string) => void;
  onTranscribe?: (messageId: string, audioUrl: string) => void;
  onImageClick?: (url: string, name: string) => void;
  onPdfClick?: (url: string, name: string) => void;
  isTranscribing?: boolean;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error"; // MELHORIA: Status da transcrição
  onRetryTranscribe?: () => void; // MELHORIA: Função para reenviar transcrição
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void | Promise<void>;
  onOpenContactConversation?: (name: string, phone: string) => void;
}

function MessageItemComponent({
  message,
  allMessages,
  onDownload,
  onTranscribe,
  onImageClick,
  onPdfClick,
  isTranscribing,
  transcriptionStatus,
  onRetryTranscribe,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onOpenContactConversation,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [pdfExpanded, setPdfExpanded] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  const repliedMessage = message.replyTo && allMessages 
    ? allMessages.find(m => m.id === message.replyTo)
    : null;

  // Carregar mídia quando componente montar
  useEffect(() => {
    if (message.mediaUrl && (message.type === 'image' || message.type === 'video' || message.type === 'audio')) {
      setMediaLoading(true);
      getMediaUrl(message.id)
        .then((url) => {
          setMediaUrl(url);
          setMediaLoading(false);
        })
        .catch((error) => {
          console.error('❌ Erro ao carregar mídia:', error);
          setMediaLoading(false);
        });
    }

    // Cleanup blob URL quando desmontar
    return () => {
      if (mediaUrl) {
        URL.revokeObjectURL(mediaUrl);
      }
    };
  }, [message.id, message.mediaUrl, message.type]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart === null) return;
    
    const currentX = e.touches[0].clientX;
    const diff = currentX - dragStart;
    
    // Aplicar transformação visual durante o arraste
    const element = e.currentTarget as HTMLElement;
    if ((message.sender === "contact" && diff > 0) || (message.sender === "user" && diff < 0)) {
      element.style.transform = `translateX(${diff * 0.3}px)`;
      element.style.transition = 'none';
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const element = e.currentTarget as HTMLElement;
    const endX = e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null;
    let diff = 0;
    if (dragStart !== null && endX !== null) {
      diff = endX - dragStart;
    }
    // Trigger reply if swipe passes threshold in the expected direction
    const threshold = 60;
    if ((message.sender === "contact" && diff > threshold) || (message.sender === "user" && diff < -threshold)) {
      onReply(message.id);
    }
    element.style.transform = '';
    element.style.transition = 'transform 0.2s ease';
    setDragStart(null);
  };

  return (
    <div
      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in group`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative">
        {/* Reply indicator */}
        {message.replyTo && repliedMessage && (
          <div className="text-xs mb-1 px-3 py-2 bg-muted/70 rounded-t-lg border-l-4 border-blue-500">
            <div className="flex items-center gap-1 mb-1">
              <Reply className="h-3 w-3 text-blue-600" />
              <span className="font-medium text-blue-600">
                {repliedMessage.sender === "user" ? "Você" : "Cliente"}
              </span>
            </div>
            <p className="text-muted-foreground line-clamp-2">
              {repliedMessage.type === "text" 
                ? repliedMessage.content
                : `[${repliedMessage.type.toUpperCase()}]`}
            </p>
          </div>
        )}
        
        <div
          className={`max-w-[500px] min-w-[100px] w-fit rounded-lg px-3 py-2 shadow-sm relative group ${
            message.sender === "user"
              ? "bg-[#d9fdd3] text-foreground"
              : "bg-white text-foreground"
          }`}
        >
          {/* Nome do responsável que enviou (apenas para mensagens da equipe) */}
          {message.sender === "user" && message.sentBy && (
            <div className="flex items-center gap-1 mb-1">
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">
                <UserIcon className="h-2.5 w-2.5 mr-0.5" />
                {message.sentBy}
              </Badge>
            </div>
          )}
          
          {/* Botão de 3 pontinhos - sempre visível ao passar mouse */}
          <div className={`absolute -top-1 ${message.sender === "user" ? "-left-9" : "-right-9"} opacity-0 group-hover:opacity-100 transition-opacity`}>
            <MessageActions
              messageId={message.id}
              content={message.content}
              sender={message.sender}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onReact={onReact}
            />
          </div>
          {/* Text Message */}
          {message.type === "text" && (
            <div className="max-w-full">
              <p className="text-sm break-words overflow-wrap-anywhere">{message.content}</p>
              {message.edited && (
                <span className="text-[10px] text-muted-foreground italic"> (editado)</span>
              )}
            </div>
          )}
          
          {/* Image Message */}
          {message.type === "image" && message.mediaUrl && (
            <div className="space-y-2">
              {mediaLoading ? (
                <div className="flex items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : mediaUrl ? (
                <img
                  src={mediaUrl}
                  alt="Imagem"
                  className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: '400px', maxWidth: '300px' }}
                  onClick={() => onImageClick?.(mediaUrl, `imagem-${message.id}`)}
                />
              ) : (
                <div className="flex items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <span className="text-sm text-muted-foreground ml-2">Imagem indisponível</span>
                </div>
              )}
              {message.content && !message.content.includes('[Imagem]') && (
                <p className="text-sm">{message.content}</p>
              )}
            </div>
          )}
          
          {/* Audio Message */}
          {message.type === "audio" && message.mediaUrl && (
            <div className="space-y-2 min-w-[250px]">
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                <span className="text-sm font-medium">Mensagem de áudio</span>
              </div>
              {mediaLoading ? (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs text-muted-foreground">Carregando áudio...</span>
                </div>
              ) : mediaUrl ? (
                <audio 
                  controls 
                  className="w-full h-8" 
                  style={{ maxWidth: '300px' }}
                >
                  <source src={mediaUrl} type="audio/ogg" />
                  Seu navegador não suporta o elemento de áudio.
                </audio>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-destructive">Áudio indisponível</span>
                </div>
              )}
              
              {/* MELHORIA: Indicador visual de status de transcrição */}
              {transcriptionStatus === "processing" && (
                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    Transcrevendo...
                  </span>
                </div>
              )}
              
              {transcriptionStatus === "pending" && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <Loader2 className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
                  <span className="text-xs text-yellow-700 dark:text-yellow-300 font-medium">
                    Aguardando processamento...
                  </span>
                </div>
              )}
              
              {transcriptionStatus === "error" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-xs text-red-700 dark:text-red-300 font-medium flex-1">
                      Erro ao transcrever áudio
                    </span>
                  </div>
                  {onRetryTranscribe && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onRetryTranscribe}
                      className="w-full"
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Reenviar Transcrição
                    </Button>
                  )}
                </div>
              )}
              
              {/* Botão para transcrever se ainda não tiver sido iniciado */}
              {!message.transcricao && 
               transcriptionStatus !== "processing" && 
               transcriptionStatus !== "pending" && 
               transcriptionStatus !== "completed" &&
               onTranscribe && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTranscribe(message.id, message.mediaUrl!)}
                  disabled={isTranscribing}
                  className="w-full"
                >
                  <Mic className="h-3 w-3 mr-2" />
                  {isTranscribing ? 'Transcrevendo...' : 'Transcrever Áudio'}
                </Button>
              )}
              
              {/* MELHORIA: Mostrar transcrição quando disponível de forma assíncrona */}
              {message.transcricao && transcriptionStatus === "completed" && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs border border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <strong className="text-green-700 dark:text-green-300">Transcrição:</strong>
                  </div>
                  <p className="mt-1">{message.transcricao}</p>
                </div>
              )}
              
              {/* Mostrar transcrição mesmo sem status (compatibilidade) */}
              {message.transcricao && transcriptionStatus !== "completed" && transcriptionStatus !== "error" && (
                <div className="mt-2 p-2 bg-muted/50 rounded text-xs border border-border">
                  <strong>Transcrição:</strong>
                  <p className="mt-1">{message.transcricao}</p>
                </div>
              )}
            </div>
          )}
          
          {/* PDF Message */}
          {message.type === "pdf" && message.mediaUrl && (
            <div className="space-y-2 min-w-[200px]">
              {pdfExpanded ? (
                <div className="space-y-2">
                  <iframe 
                    src={message.mediaUrl} 
                    className="w-full h-[500px] border border-border rounded"
                    title="PDF Viewer"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPdfExpanded(false)}
                      className="flex-1"
                    >
                      Fechar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownload?.(message.mediaUrl!, message.fileName || 'documento.pdf')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPdfClick?.(message.mediaUrl!, message.fileName || 'documento.pdf')}
                    >
                      <FileText className="h-3 w-3 mr-2" />
                      Abrir no visor
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Preview thumbnail do PDF */}
                  <PDFPreview
                    url={message.mediaUrl}
                    fileName={message.fileName}
                    onClick={() => setPdfExpanded(true)}
                  />
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPdfExpanded(true)}
                      className="flex-1"
                    >
                      <FileText className="h-3 w-3 mr-2" />
                      Abrir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownload?.(message.mediaUrl!, message.fileName || 'documento.pdf')}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPdfClick?.(message.mediaUrl!, message.fileName || 'documento.pdf')}
                    >
                      <FileText className="h-3 w-3 mr-2" />
                      Abrir no visor
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Message */}
          {message.type === "video" && message.mediaUrl && (
            <div className="space-y-2">
              {mediaLoading ? (
                <div className="flex items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : mediaUrl ? (
                <video
                  controls
                  className="rounded-lg max-w-full h-auto"
                  style={{ maxHeight: '400px', maxWidth: '300px' }}
                >
                  <source src={mediaUrl} type="video/mp4" />
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              ) : (
                <div className="flex items-center justify-center w-[300px] h-[200px] bg-muted/50 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                  <span className="text-sm text-muted-foreground ml-2">Vídeo indisponível</span>
                </div>
              )}
            </div>
          )}

          {/* Contact Message */}
          {message.type === "contact" && message.contactData && (
            <div className="space-y-2 min-w-[200px]">
              <div 
                className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50"
                onClick={() => onOpenContactConversation?.(message.contactData!.name, message.contactData!.phone)}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{message.contactData.name}</p>
                  <p className="text-xs text-muted-foreground">{message.contactData.phone}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${message.contactData?.name}
TEL:${message.contactData?.phone}
END:VCARD`;
                  const blob = new Blob([vcard], { type: 'text/vcard' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${message.contactData?.name}.vcf`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                className="w-full"
              >
                <Download className="h-3 w-3 mr-2" />
                Salvar Contato
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenContactConversation?.(message.contactData!.name, message.contactData!.phone)}
                className="w-full"
              >
                Conversar
              </Button>
            </div>
          )}

          {/* Timestamp and Status */}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {message.timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {message.sender === "user" && (
              <div className="flex items-center gap-0.5" title={message.read ? 'Visualizado' : message.delivered ? 'Entregue' : 'Enviando'}>
                {message.read ? (
                  <>
                    <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                    <span className="text-[9px] text-[#53bdeb] font-medium">Visto</span>
                  </>
                ) : message.delivered ? (
                  <CheckCheck className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
          
          {/* Reaction */}
          {message.reaction && (
            <Badge 
              className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full flex items-center justify-center p-0 border-2 border-background text-base shadow-md"
              variant="secondary"
            >
              {message.reaction}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// MELHORIA: Memoizar componente para otimização de performance (MICRO-PROMPT 4)
export const MessageItem = memo(MessageItemComponent);
