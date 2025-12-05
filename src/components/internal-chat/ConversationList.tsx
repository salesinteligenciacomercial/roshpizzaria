import { InternalConversation } from '@/hooks/useInternalChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, User, MessageSquare } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface ConversationListProps {
  conversations: InternalConversation[];
  loading: boolean;
  currentUserId: string | null;
  onSelect: (conversation: InternalConversation) => void;
  getDisplayName: (conversation: InternalConversation) => string;
}

export const ConversationList = ({
  conversations,
  loading,
  currentUserId,
  onSelect,
  getDisplayName
}: ConversationListProps) => {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, 'HH:mm');
    }
    if (isYesterday(date)) {
      return 'Ontem';
    }
    return format(date, 'dd/MM', { locale: ptBR });
  };

  const getMessagePreview = (conversation: InternalConversation): string => {
    if (!conversation.last_message) return 'Nenhuma mensagem';
    
    const { message_type, content } = conversation.last_message;
    
    switch (message_type) {
      case 'image':
        return '📷 Imagem';
      case 'video':
        return '🎥 Vídeo';
      case 'audio':
        return '🎵 Áudio';
      case 'pdf':
      case 'document':
        return '📄 Documento';
      case 'shared_item':
        return '📌 Item compartilhado';
      default:
        return content || 'Mensagem';
    }
  };

  const getOtherParticipantAvatar = (conversation: InternalConversation) => {
    const other = conversation.participants.find(p => p.user_id !== currentUserId);
    return other?.profile?.avatar_url;
  };

  const getOtherParticipantInitial = (conversation: InternalConversation) => {
    const name = getDisplayName(conversation);
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhuma conversa ainda</p>
        <p className="text-sm text-muted-foreground mt-1">
          Clique no + para iniciar uma conversa
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y">
        {conversations.map(conversation => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className="w-full flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors text-left"
          >
            <Avatar className="h-12 w-12">
              {!conversation.is_group && (
                <AvatarImage src={getOtherParticipantAvatar(conversation) || ''} />
              )}
              <AvatarFallback className="bg-primary/10 text-primary">
                {conversation.is_group ? (
                  <Users className="h-5 w-5" />
                ) : (
                  getOtherParticipantInitial(conversation)
                )}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">
                  {getDisplayName(conversation)}
                </span>
                {conversation.last_message && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatTime(conversation.last_message.created_at)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <p className="text-sm text-muted-foreground truncate">
                  {getMessagePreview(conversation)}
                </p>
                {conversation.unread_count > 0 && (
                  <Badge className="h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-primary">
                    {conversation.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};
