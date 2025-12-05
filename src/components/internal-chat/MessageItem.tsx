import { InternalMessage } from '@/hooks/useInternalMessages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { FileText, Download, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface MessageItemProps {
  message: InternalMessage;
  isOwn: boolean;
}

export const MessageItem = ({ message, isOwn }: MessageItemProps) => {
  const navigate = useNavigate();

  const handleDownload = () => {
    if (message.media_url) {
      const a = document.createElement('a');
      a.href = message.media_url;
      a.download = message.file_name || 'download';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleNavigateToItem = () => {
    if (!message.shared_item_type || !message.shared_item_id) return;

    switch (message.shared_item_type) {
      case 'lead':
        navigate('/leads');
        break;
      case 'task':
        navigate('/tarefas');
        break;
      case 'funnel':
        navigate('/kanban');
        break;
    }
  };

  const renderContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-2">
            <img
              src={message.media_url || ''}
              alt="Imagem"
              className="max-w-[240px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.media_url || '', '_blank')}
            />
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <video
              src={message.media_url || ''}
              controls
              className="max-w-[240px] rounded-lg"
            />
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'audio':
        return (
          <audio
            src={message.media_url || ''}
            controls
            className="max-w-[240px]"
          />
        );

      case 'pdf':
      case 'document':
        return (
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
            <FileText className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.file_name || 'Documento'}
              </p>
              <p className="text-xs text-muted-foreground">Clique para baixar</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        );

      case 'shared_item':
        return (
          <button
            onClick={handleNavigateToItem}
            className="flex items-center gap-2 p-2 bg-background/50 rounded-lg hover:bg-background/70 transition-colors w-full text-left"
          >
            <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center">
              <ExternalLink className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{message.content}</p>
              <p className="text-xs text-muted-foreground capitalize">
                {message.shared_item_type === 'lead' && 'Lead'}
                {message.shared_item_type === 'task' && 'Tarefa'}
                {message.shared_item_type === 'funnel' && 'Funil'}
              </p>
            </div>
          </button>
        );

      default:
        return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    }
  };

  return (
    <div className={cn('flex gap-2', isOwn && 'flex-row-reverse')}>
      {!isOwn && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={message.sender?.avatar_url || ''} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {message.sender?.full_name?.charAt(0).toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('max-w-[75%]', isOwn && 'items-end')}>
        {!isOwn && message.sender?.full_name && (
          <p className="text-xs text-muted-foreground mb-1 ml-1">
            {message.sender.full_name}
          </p>
        )}
        
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isOwn 
              ? 'bg-primary text-primary-foreground rounded-br-md' 
              : 'bg-muted rounded-bl-md'
          )}
        >
          {renderContent()}
        </div>
        
        <p className={cn(
          'text-xs text-muted-foreground mt-1',
          isOwn ? 'text-right mr-1' : 'ml-1'
        )}>
          {format(new Date(message.created_at), 'HH:mm')}
        </p>
      </div>
    </div>
  );
};
