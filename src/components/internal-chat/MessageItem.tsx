import { InternalMessage } from '@/hooks/useInternalMessages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { FileText, Download, ExternalLink, Image, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { MediaPreviewDialog } from './MediaPreviewDialog';

interface MessageItemProps {
  message: InternalMessage;
  isOwn: boolean;
}

export const MessageItem = ({ message, isOwn }: MessageItemProps) => {
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleDownload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
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

  const getMediaType = (): 'image' | 'video' | 'audio' | 'pdf' | 'document' => {
    if (message.message_type === 'image') return 'image';
    if (message.message_type === 'video') return 'video';
    if (message.message_type === 'audio') return 'audio';
    if (message.message_type === 'pdf') return 'pdf';
    return 'document';
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
            <div 
              className="relative group cursor-pointer"
              onClick={() => setPreviewOpen(true)}
            >
              <img
                src={message.media_url || ''}
                alt="Imagem"
                className="max-w-[240px] rounded-lg hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                <Image className="w-6 h-6 text-white" />
                <span className="text-white text-xs">Clique para expandir</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1">
                {message.file_name || 'Imagem'}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleDownload}
                title="Baixar"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <div 
              className="relative group cursor-pointer"
              onClick={() => setPreviewOpen(true)}
            >
              <video
                src={message.media_url || ''}
                className="max-w-[240px] rounded-lg"
                muted
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-lg group-hover:bg-black/50 transition-colors">
                <Video className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1">
                {message.file_name || 'Vídeo'}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleDownload}
                title="Baixar"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-2">
            <div 
              className="flex items-center gap-2 p-2 bg-background/50 rounded-lg cursor-pointer hover:bg-background/70 transition-colors"
              onClick={() => setPreviewOpen(true)}
            >
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Music className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {message.file_name || 'Áudio'}
                </p>
                <p className="text-xs text-muted-foreground">Clique para ouvir</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                title="Baixar"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
            <audio
              src={message.media_url || ''}
              controls
              className="w-full max-w-[240px]"
            />
          </div>
        );

      case 'pdf':
      case 'document':
        return (
          <div 
            className="flex items-center gap-2 p-2 bg-background/50 rounded-lg cursor-pointer hover:bg-background/70 transition-colors"
            onClick={() => setPreviewOpen(true)}
          >
            <FileText className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.file_name || 'Documento'}
              </p>
              <p className="text-xs text-muted-foreground">Clique para visualizar</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              title="Baixar"
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

      {/* Media Preview Dialog */}
      {message.media_url && (
        <MediaPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          mediaUrl={message.media_url}
          mediaType={getMediaType()}
          fileName={message.file_name || undefined}
        />
      )}
    </div>
  );
};
