import { memo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Instagram, Facebook, MoreVertical, Edit, UserPlus, Trash2, Lock, Unlock, User, CheckCircle2, Circle, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  isGroup?: boolean;
  isBlocked?: boolean;
  onEditName?: () => void;
  onCreateLead?: () => void;
  onDeleteConversation?: () => void;
  onToggleBlock?: () => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  assignedUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
  lastRespondedBy?: string; // ⚡ Nome do último usuário que respondeu
  status?: "waiting" | "answered" | "resolved"; // Status da conversa
  origemApi?: "evolution" | "meta"; // 🔥 NOVO: Identificação da API de origem
  // 🆕 Atendimento ativo
  attendingUser?: {
    id: string;
    name: string;
  } | null;
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
  isGroup = false,
  isBlocked = false,
  onEditName,
  onCreateLead,
  onDeleteConversation,
  onToggleBlock,
  isPinned = false,
  onTogglePin,
  assignedUser,
  lastRespondedBy,
  status,
  origemApi,
  attendingUser, // 🆕 NOVO
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



  return (
    <div
      className={`relative p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
        isSelected ? "bg-muted/70" : ""
      } ${isPinned ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}
      onClick={onClick}
      style={{ 
        position: 'relative', 
        overflow: 'visible',
        isolation: 'isolate', // Cria novo contexto de empilhamento
      }}
      data-conversation-item="true"
    >
      <div className="flex gap-3 items-start">
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12">
            {avatarUrl && avatarUrl.trim() !== '' ? (
              <AvatarImage src={avatarUrl} alt={contactName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          {assignedUser && (
            <Avatar className="h-5 w-5 absolute -bottom-1 -right-1 ring-2 ring-background border border-border">
              {assignedUser.avatar && assignedUser.avatar.trim() !== '' ? (
                <AvatarImage src={assignedUser.avatar} alt={assignedUser.name} />
              ) : null}
              <AvatarFallback className="bg-accent text-accent-foreground text-[10px]">
                {getInitials(assignedUser.name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1 gap-3">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              {getChannelIcon()}
              
              {/* 🔥 NOVO: Badge de identificação da API (Oficial vs Não Oficial) */}
              {origemApi && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex-shrink-0">
                        {origemApi === 'meta' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-green-500 fill-green-500" />
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {origemApi === 'meta' 
                        ? 'WhatsApp Oficial (Meta API)' 
                        : 'WhatsApp Não Oficial (Evolution API)'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <span className="font-medium text-sm text-foreground truncate">
                {contactName}
              </span>
              {isGroup && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 flex-shrink-0">
                  Grupo
                </Badge>
              )}
              {isBlocked && (
                <Lock className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
              )}
              {isPinned && (
                <Pin className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
              )}
            </div>
            
          </div>
          
          <p className="text-sm text-muted-foreground truncate">
            {lastMessage || "Sem histórico de conversa"}
          </p>
          
          {/* Data, hora e notificação - abaixo do botão de 3 pontos */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {timestamp.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })} às {timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {unread > 0 && (
              <Badge className="bg-[#25D366] hover:bg-[#25D366] text-white text-xs h-5 min-w-5 rounded-full">
                {unread}
              </Badge>
            )}
          </div>
          
          {/* Informações do Lead */}
          <div className="mt-2 space-y-1.5">
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0 h-5">
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
            
            <div className="flex flex-wrap gap-1.5 text-xs">
              {/* 🆕 NOVO: Mostrar usuário que está atendendo ativamente */}
              {attendingUser && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200 dark:border-emerald-700">
                  <User className="h-3 w-3" />
                  <span className="font-semibold">{attendingUser.name}</span>
                  <span className="opacity-70 text-[10px]">atendendo</span>
                </span>
              )}
              {/* ⚡ ANTIGO: Mostrar quem respondeu por último (Em Atendimento) - apenas se não tiver attendingUser */}
              {!attendingUser && status === "answered" && lastRespondedBy && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                  <User className="h-3 w-3" />
                  {lastRespondedBy}
                </span>
              )}
              {responsavel && !(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(responsavel.split(',')[0]?.trim() || '')) && (
                <span className="text-muted-foreground truncate">👤 {responsavel}</span>
              )}
              {funnelStage && (
                <span className="text-muted-foreground truncate">📊 {funnelStage}</span>
              )}
              {valor && (
                <span className="text-green-600 font-semibold truncate">💰 {valor}</span>
              )}
            </div>
          </div>
        </div>
        
        {/* 🛡️ BOTÃO DE MENU - PROTEÇÃO MÁXIMA CONTRA DESAPARECIMENTO */}
        <div 
          className="conversation-menu-button-protected"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 99999,
            display: 'flex',
            opacity: 1,
            visibility: 'visible',
            pointerEvents: 'auto',
          }}
        >
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                data-conversation-menu="true"
                aria-label="Menu de opções"
                style={{
                  display: 'flex',
                  opacity: 1,
                  visibility: 'visible',
                  pointerEvents: 'auto',
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  minHeight: '32px',
                  flexShrink: 0,
                }}
                className="h-8 w-8 bg-background hover:bg-accent shadow-sm border border-border/50 !opacity-100 !visible"
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" style={{ opacity: 1, visibility: 'visible' }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
              {/* Opção de Fixar/Desafixar */}
              {onTogglePin && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}>
                  {isPinned ? (
                    <>
                      <PinOff className="h-4 w-4 mr-2" />
                      Desafixar conversa
                    </>
                  ) : (
                    <>
                      <Pin className="h-4 w-4 mr-2" />
                      Fixar conversa
                    </>
                  )}
                </DropdownMenuItem>
              )}
              
              {!isGroup && onEditName && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onEditName();
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar nome
                </DropdownMenuItem>
              )}
              
              {isGroup && onToggleBlock && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onToggleBlock();
                }}>
                  {isBlocked ? (
                    <>
                      <Unlock className="h-4 w-4 mr-2" />
                      Desbloquear grupo
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Bloquear grupo
                    </>
                  )}
                </DropdownMenuItem>
              )}
              
              {!leadId && onCreateLead && (
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation();
                  onCreateLead();
                }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Adicionar ao CRM
                </DropdownMenuItem>
              )}
              
              {onDeleteConversation && (
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation();
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir conversa
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// MELHORIA: Memoizar componente para otimização de performance (MICRO-PROMPT 4)
// CORREÇÃO: Remover memoização que pode causar problemas de renderização
export const ConversationListItem = ConversationListItemComponent;
