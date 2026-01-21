import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Reply, 
  Smile,
  Heart,
  ThumbsUp,
  Laugh,
  Frown,
  Angry,
  Download,
  FileText,
  Forward
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MessageActionsProps {
  messageId: string;
  content: string;
  sender: "user" | "contact";
  messageType?: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
  mediaUrl?: string;
  fileName?: string;
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
  onForward?: (messageId: string, content: string, messageType: string, mediaUrl?: string, fileName?: string) => void;
  onSaveToMedicalRecord?: (mediaUrl: string, fileName: string, messageType: string) => void;
  leadId?: string;
}

export function MessageActions({
  messageId,
  content,
  sender,
  messageType,
  mediaUrl,
  fileName,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onForward,
  onSaveToMedicalRecord,
  leadId,
}: MessageActionsProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const emojis = [
    { emoji: "❤️", icon: Heart, label: "Curtir" },
    { emoji: "👍", icon: ThumbsUp, label: "Gostei" },
    { emoji: "😂", icon: Laugh, label: "Engraçado" },
    { emoji: "😮", icon: Smile, label: "Surpreso" },
    { emoji: "😢", icon: Frown, label: "Triste" },
    { emoji: "😠", icon: Angry, label: "Bravo" },
  ];

  const handleReact = (emoji: string) => {
    onReact(messageId, emoji);
    setShowEmojiPicker(false);
    toast({
      title: "✅ Reação enviada",
      description: `${emoji} adicionado à mensagem`
    });
  };

  const handleDownload = async () => {
    if (!mediaUrl) {
      toast({
        title: "❌ Erro",
        description: "URL do arquivo não disponível",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log('📥 [DOWNLOAD] Iniciando download:', { mediaUrl, fileName });
      
      // Fazer fetch do arquivo
      const response = await fetch(mediaUrl);
      if (!response.ok) throw new Error('Erro ao baixar arquivo');
      
      const blob = await response.blob();
      
      // Criar URL temporária do blob
      const url = window.URL.createObjectURL(blob);
      
      // Criar elemento <a> temporário para download
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `arquivo-${messageId}`;
      document.body.appendChild(a);
      a.click();
      
      // Limpar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "✅ Download concluído",
        description: `${fileName || 'Arquivo'} baixado com sucesso`
      });
      
      console.log('✅ [DOWNLOAD] Download concluído');
    } catch (error) {
      console.error('❌ [DOWNLOAD] Erro ao baixar:', error);
      toast({
        title: "❌ Erro no download",
        description: "Não foi possível baixar o arquivo",
        variant: "destructive"
      });
    }
  };

  const handleForward = () => {
    if (onForward) {
      onForward(messageId, content, messageType || "text", mediaUrl, fileName);
      setShowEmojiPicker(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {/* Emojis rápidos */}
      {showEmojiPicker && (
        <div className="flex gap-1 bg-background border rounded-lg p-1 shadow-lg animate-in slide-in-from-left z-50">
          {emojis.map(({ emoji, icon: Icon }) => (
            <Button
              key={emoji}
              size="sm"
              variant="ghost"
              onClick={() => handleReact(emoji)}
              className="h-8 w-8 p-0 hover:scale-110 transition-transform"
            >
              {emoji}
            </Button>
          ))}
        </div>
      )}

      {/* Botão de emoji */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        className="h-8 w-8 p-0 rounded-full hover:bg-muted"
        title="Reagir com emoji"
      >
        <Smile className="h-4 w-4" />
      </Button>

      {/* Menu de ações */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0 rounded-full hover:bg-muted"
            title="Mais opções"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-background z-50">
          <DropdownMenuItem onClick={() => {
            onReply(messageId);
            setShowEmojiPicker(false);
          }}>
            <Reply className="h-4 w-4 mr-2" />
            Responder
          </DropdownMenuItem>

          {/* Opção de Encaminhar */}
          {onForward && (
            <DropdownMenuItem onClick={handleForward}>
              <Forward className="h-4 w-4 mr-2" />
              Encaminhar
            </DropdownMenuItem>
          )}
          
          {/* Opção de Download para mídias */}
          {mediaUrl && (messageType === "image" || messageType === "video" || messageType === "audio" || messageType === "pdf" || messageType === "document") && (
            <DropdownMenuItem onClick={() => {
              handleDownload();
              setShowEmojiPicker(false);
            }}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </DropdownMenuItem>
          )}

          {/* Opção de salvar no prontuário do lead */}
          {mediaUrl && leadId && onSaveToMedicalRecord && (messageType === "image" || messageType === "video" || messageType === "pdf" || messageType === "document") && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => {
                onSaveToMedicalRecord(mediaUrl, fileName || `arquivo-${messageId}`, messageType || 'document');
                setShowEmojiPicker(false);
              }}>
                <FileText className="h-4 w-4 mr-2" />
                Salvar no Prontuário
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
