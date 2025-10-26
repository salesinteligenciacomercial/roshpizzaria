import { useState } from "react";
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
  Smile
} from "lucide-react";
import { MessageActions } from "./MessageActions";
import { toast } from "@/hooks/use-toast";

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
  transcricao?: string;
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
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
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
}

export function MessageItem({
  message,
  allMessages,
  onDownload,
  onTranscribe,
  onImageClick,
  onPdfClick,
  isTranscribing,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [pdfExpanded, setPdfExpanded] = useState(false);

  const repliedMessage = message.replyTo && allMessages 
    ? allMessages.find(m => m.id === message.replyTo)
    : null;

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
              <img
                src={message.mediaUrl}
                alt="Imagem"
                className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                style={{ maxHeight: '400px', maxWidth: '300px' }}
                onClick={() => onImageClick?.(message.mediaUrl!, `imagem-${message.id}`)}
              />
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
              <audio controls className="w-full h-8" style={{ maxWidth: '300px' }}>
                <source src={message.mediaUrl} />
              </audio>
              {!message.transcricao && onTranscribe && (
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
              {message.transcricao && (
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
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Preview thumbnail do PDF */}
                  <div 
                    className="relative cursor-pointer hover:opacity-90 transition-opacity border border-border rounded overflow-hidden"
                    onClick={() => setPdfExpanded(true)}
                  >
                    <iframe 
                      src={message.mediaUrl} 
                      className="w-[200px] h-[260px] pointer-events-none"
                      title="PDF Preview"
                      style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                      <div className="text-white text-xs font-medium truncate w-full">
                        <FileText className="h-4 w-4 inline mr-1" />
                        {message.fileName || 'Documento PDF'}
                      </div>
                    </div>
                  </div>
                  
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
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Video Message */}
          {message.type === "video" && message.mediaUrl && (
            <div className="space-y-2">
              <video
                controls
                className="rounded-lg max-w-full h-auto"
                style={{ maxHeight: '400px', maxWidth: '300px' }}
              >
                <source src={message.mediaUrl} />
              </video>
            </div>
          )}

          {/* Contact Message */}
          {message.type === "contact" && message.contactData && (
            <div className="space-y-2 min-w-[200px]">
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
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
              message.read ? 
                <CheckCheck className="h-3 w-3 text-[#53bdeb]" /> : 
                message.delivered ? 
                  <CheckCheck className="h-3 w-3 text-muted-foreground" /> : 
                  <Check className="h-3 w-3 text-muted-foreground" />
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
