import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Reply, 
  Edit, 
  Trash2, 
  Smile,
  Heart,
  ThumbsUp,
  Laugh,
  Frown,
  Angry
} from "lucide-react";
import { toast } from "sonner";

interface MessageActionsProps {
  messageId: string;
  content: string;
  sender: "user" | "contact";
  onReply: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
  onReact: (messageId: string, emoji: string) => void;
}

export function MessageActions({
  messageId,
  content,
  sender,
  onReply,
  onEdit,
  onDelete,
  onReact,
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
    toast.success(`Reação ${emoji} adicionada`);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Emojis rápidos */}
      {showEmojiPicker && (
        <div className="flex gap-1 bg-background border rounded-lg p-1 shadow-lg animate-in slide-in-from-left">
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
        className="h-7 w-7 p-0"
      >
        <Smile className="h-4 w-4" />
      </Button>

      {/* Menu de ações */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onReply(messageId)}>
            <Reply className="h-4 w-4 mr-2" />
            Responder
          </DropdownMenuItem>
          
          {sender === "user" && (
            <>
              <DropdownMenuItem onClick={() => {
                const newContent = prompt("Editar mensagem:", content);
                if (newContent && newContent !== content) {
                  onEdit(messageId, newContent);
                }
              }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                onClick={() => {
                  const confirmDelete = window.confirm("Excluir mensagem para todos?");
                  onDelete(messageId, confirmDelete);
                }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
