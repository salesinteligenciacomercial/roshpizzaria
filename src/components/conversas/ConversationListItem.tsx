import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Instagram, Facebook, MoreVertical, Edit, UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ConversationListItemProps {
  contactName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  lastMessage: string;
  timestamp: Date;
  unread: number;
  isSelected: boolean;
  avatarUrl?: string;
  tags?: string[];
  responsavel?: string;
  funnelStage?: string;
  valor?: string;
  onClick: () => void;
  conversationId?: string;
  leadId?: string;
  onEditName?: () => void;
  onCreateLead?: () => void;
  onDeleteConversation?: () => void;
}

function ConversationListItemComponent({
  contactName,
  channel,
  lastMessage,
  timestamp,
  unread,
  isSelected,
  avatarUrl,
  tags = [],
  responsavel,
  funnelStage,
  valor,
  onClick,
  conversationId,
  leadId,
  onEditName,
  onCreateLead,
  onDeleteConversation,
}: ConversationListItemProps) {
  const getChannelIcon = () => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="h-3.5 w-3.5 text-[#25D366]" />;
      case "instagram":
        return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-3.5 w-3.5 text-blue-600" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  console.log('🔘 Renderizando ConversationListItem:', {
    contactName,
    hasCallbacks: {
      onEditName: !!onEditName,
      onCreateLead: !!onCreateLead,
      onDeleteConversation: !!onDeleteConversation
    }
  });

  return (
    <div
      className={`relative p-4 pr-14 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
        isSelected ? "bg-muted/70" : ""
      }`}
      onClick={onClick}
    >
      {/* Botão de menu - SEMPRE VISÍVEL com z-index máximo */}
      <div 
        className="absolute top-2 right-2 z-[9999]"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="default" 
              size="icon" 
              className="h-10 w-10 bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg border-2 border-background"
              onClick={(e) => {
                e.stopPropagation();
                console.log('🔘 Botão menu clicado!');
              }}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="z-[10000] w-56 bg-background border-2 border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                console.log('✏️ Editar nome');
                onEditName?.();
              }}
              className="cursor-pointer hover:bg-accent"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar nome
            </DropdownMenuItem>
            {!leadId && onCreateLead && (
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('➕ Adicionar ao CRM');
                  onCreateLead();
                }}
                className="cursor-pointer hover:bg-accent"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar ao CRM
              </DropdownMenuItem>
            )}
            <DropdownMenuItem 
              onClick={(e) => {
                e.stopPropagation();
                console.log('🗑️ Excluir conversa');
                onDeleteConversation?.();
              }}
              className="text-destructive cursor-pointer hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="flex gap-3">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage src={avatarUrl} alt={contactName} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(contactName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1 gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getChannelIcon()}
              <span className="font-medium text-sm text-foreground truncate">
                {contactName}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {unread > 0 && (
                  <Badge className="bg-[#25D366] hover:bg-[#25D366] text-white text-xs h-5 min-w-5 rounded-full flex items-center justify-center">
                    {unread}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {lastMessage || "Sem histórico de conversa"}
          </p>
          
          {/* Informações do Lead */}
          <div className="mt-2 space-y-1.5">
            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs px-1.5 py-0 h-5"
                  >
                    {tag}
                  </Badge>
                ))}
                {tags.length > 2 && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                    +{tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
            
            {/* Responsável, Funil/Etapa, Valor */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {responsavel && (
                <span className="text-muted-foreground truncate">
                  👤 {responsavel}
                </span>
              )}
              {funnelStage && (
                <span className="text-muted-foreground truncate">
                  📊 {funnelStage}
                </span>
              )}
              {valor && (
                <span className="text-green-600 font-semibold truncate">
                  💰 {valor}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// MELHORIA: Memoizar componente para otimização de performance (MICRO-PROMPT 4)
export const ConversationListItem = memo(ConversationListItemComponent, (prevProps, nextProps) => {
  // Comparação personalizada para evitar re-renders desnecessários
  return (
    prevProps.contactName === nextProps.contactName &&
    prevProps.channel === nextProps.channel &&
    prevProps.lastMessage === nextProps.lastMessage &&
    prevProps.timestamp.getTime() === nextProps.timestamp.getTime() &&
    prevProps.unread === nextProps.unread &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.avatarUrl === nextProps.avatarUrl &&
    JSON.stringify(prevProps.tags) === JSON.stringify(nextProps.tags) &&
    prevProps.responsavel === nextProps.responsavel &&
    prevProps.funnelStage === nextProps.funnelStage &&
    prevProps.valor === nextProps.valor &&
    prevProps.conversationId === nextProps.conversationId &&
    prevProps.leadId === nextProps.leadId
  );
});
