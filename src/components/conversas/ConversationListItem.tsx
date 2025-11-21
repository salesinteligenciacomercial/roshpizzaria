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


  // ⚡ GARANTIA: O botão sempre será renderizado, mesmo sem callbacks
  // Os callbacks são opcionais, mas o botão deve sempre aparecer
  const hasAnyCallback = !!(onEditName || onCreateLead || onDeleteConversation);
  
  console.log('🎨 [RENDER] ConversationListItem:', {
    contactName,
    hasAvatar: !!avatarUrl,
    avatarUrl: avatarUrl?.substring(0, 50),
    hasCallbacks: {
      onEditName: !!onEditName,
      onCreateLead: !!onCreateLead,
      onDeleteConversation: !!onDeleteConversation
    },
    hasAnyCallback,
    showingButton: true // SEMPRE TRUE - botão sempre visível
  });

  return (
    <div
      className={`relative p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
        isSelected ? "bg-muted/70" : ""
      }`}
      onClick={onClick}
      style={{ position: 'relative', overflow: 'visible' }}
    >
      <div className="flex gap-3 items-start">
        <Avatar className="h-12 w-12 flex-shrink-0">
          <AvatarImage src={avatarUrl} alt={contactName} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(contactName)}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0" style={{ overflow: 'visible' }}>
          <div className="flex items-start justify-between mb-1 gap-2" style={{ overflow: 'visible' }}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getChannelIcon()}
              <span className="font-medium text-sm text-foreground truncate">
                {contactName}
              </span>
            </div>
            
            {/* HORÁRIO, BADGE E MENU */}
            {/* ⚡ CORREÇÃO: Garantir que o container do menu sempre seja visível em todos os filtros */}
            <div 
              className="flex items-center gap-1.5 flex-shrink-0" 
              style={{ 
                position: 'relative', 
                zIndex: 100,
                overflow: 'visible',
                minWidth: '120px',
                justifyContent: 'flex-end'
              }}
            >
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
              
              {/* BOTÃO DE MENU - SEMPRE VISÍVEL EM TODOS OS FILTROS */}
              {/* ⚡ CORREÇÃO: Botão sempre renderizado e visível, independente de filtro ou callbacks */}
              <div 
                className="flex-shrink-0" 
                style={{ 
                  position: 'relative', 
                  zIndex: 100,
                  minWidth: '32px',
                  minHeight: '32px',
                  overflow: 'visible',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 hover:bg-accent hover:text-accent-foreground shrink-0 flex-shrink-0"
                      style={{ 
                        opacity: 1, 
                        visibility: 'visible', 
                        display: 'flex',
                        position: 'relative',
                        zIndex: 101,
                        minWidth: '32px',
                        minHeight: '32px',
                        flexShrink: 0,
                        pointerEvents: 'auto',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('🔘 Menu clicado!', { conversationId, leadId, hasAnyCallback, filter: 'all' });
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <MoreVertical 
                        className="h-4 w-4 flex-shrink-0" 
                        style={{ 
                          color: 'currentColor',
                          display: 'block',
                          opacity: 1,
                          visibility: 'visible',
                          pointerEvents: 'auto',
                          width: '16px',
                          height: '16px'
                        }} 
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    align="end" 
                    side="bottom"
                    className="w-56 z-[99999] bg-background border border-border shadow-lg"
                    style={{ zIndex: 99999 }}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                      {/* ⚡ SEMPRE mostrar opção de editar nome */}
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('✏️ Editar nome', conversationId);
                          if (onEditName) {
                            onEditName();
                          } else {
                            console.warn('⚠️ onEditName não está definido');
                          }
                        }}
                        className="cursor-pointer"
                        disabled={!onEditName}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar nome
                      </DropdownMenuItem>
                      {/* ⚡ Mostrar "Adicionar ao CRM" apenas se não tiver lead e tiver callback */}
                      {!leadId && onCreateLead && (
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            console.log('➕ Adicionar ao CRM', conversationId);
                            onCreateLead();
                          }}
                          className="cursor-pointer"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Adicionar ao CRM
                        </DropdownMenuItem>
                      )}
                      {/* ⚡ SEMPRE mostrar opção de excluir conversa */}
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('🗑️ Excluir conversa', conversationId);
                          if (onDeleteConversation) {
                            onDeleteConversation();
                          } else {
                            console.warn('⚠️ onDeleteConversation não está definido');
                          }
                        }}
                        className="text-destructive cursor-pointer"
                        disabled={!onDeleteConversation}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
// CORREÇÃO: Remover memoização que pode causar problemas de renderização
export const ConversationListItem = ConversationListItemComponent;
