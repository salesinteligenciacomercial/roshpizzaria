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
  Reply
} from "lucide-react";
import { MessageActions } from "./MessageActions";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  mediaUrl?: string;
  fileName?: string;
  transcricao?: string;
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
}

interface MessageItemProps {
  message: Message;
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

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (dragStart !== null) {
      const dragEnd = e.changedTouches[0].clientX;
      const diff = dragEnd - dragStart;
      
      // Arraste para a direita > 50px = responder
      if (message.sender === "contact" && diff > 50) {
        onReply(message.id);
        toast.success("Responder mensagem");
      }
      // Arraste para a esquerda > 50px = responder
      else if (message.sender === "user" && diff < -50) {
        onReply(message.id);
        toast.success("Responder mensagem");
      }
    }
    setDragStart(null);
  };

  return (
    <div
      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative">
        {/* Reply indicator */}
        {message.replyTo && (
          <div className="text-xs text-muted-foreground mb-1 px-3 py-1 bg-muted/50 rounded-t-lg">
            <Reply className="h-3 w-3 inline mr-1" />
            Respondendo mensagem
          </div>
        )}
        
        <div
          className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm relative ${
            message.sender === "user"
              ? "bg-[#d9fdd3] text-foreground"
              : "bg-white text-foreground"
          }`}
        >
          {/* Text Message */}
          {message.type === "text" && (
            <div>
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span className="text-sm font-medium">{message.fileName || 'Documento'}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPdfClick?.(message.mediaUrl!, message.fileName || 'documento.pdf')}
              >
                <FileText className="h-3 w-3 mr-2" />
                Visualizar
              </Button>
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

          {/* Timestamp and Status */}
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className="text-[10px] text-muted-foreground">
              {message.timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {message.sender === "user" && (
              message.delivered ? 
                <CheckCheck className="h-3 w-3 text-[#53bdeb]" /> : 
                <Check className="h-3 w-3" />
            )}
          </div>
          
          {/* Reaction */}
          {message.reaction && (
            <Badge 
              className="absolute -bottom-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center p-0 border-2 border-background"
              variant="secondary"
            >
              {message.reaction}
            </Badge>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div 
            className={`absolute top-0 ${message.sender === "user" ? "left-full ml-2" : "right-full mr-2"}`}
          >
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
        )}
      </div>
    </div>
  );
}
