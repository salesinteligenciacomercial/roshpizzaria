import { InternalMessage } from '@/hooks/useInternalMessages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Download, ExternalLink, Image, Video, Music, MessageCircle, Users, Pencil, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { MediaPreviewDialog } from './MediaPreviewDialog';
import { PDFThumbnail } from './PDFThumbnail';
import { downloadFile } from '@/utils/downloadFile';
import { ConversaPopup } from '@/components/leads/ConversaPopup';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MessageItemProps {
  message: InternalMessage;
  isOwn: boolean;
  onEdit?: (messageId: string, newContent: string) => Promise<boolean>;
}

interface LeadInfo {
  id: string;
  name: string;
  telefone?: string;
  phone?: string;
}

export const MessageItem = ({ message, isOwn, onEdit }: MessageItemProps) => {
  const navigate = useNavigate();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [conversaPopupOpen, setConversaPopupOpen] = useState(false);
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || '');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Carregar info do lead quando for shared_item do tipo lead
  useEffect(() => {
    if (message.message_type === 'shared_item' && message.shared_item_type === 'lead' && message.shared_item_id) {
      loadLeadInfo(message.shared_item_id);
    }
  }, [message]);

  const loadLeadInfo = async (leadId: string) => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, telefone, phone')
      .eq('id', leadId)
      .maybeSingle();
    if (data) {
      setLeadInfo(data);
    }
  };

  const handleDownload = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (message.media_url) {
      downloadFile(message.media_url, message.file_name || 'download');
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
        // Abrir popup de conversa em vez de redirecionar
        if (leadInfo) {
          setConversaPopupOpen(true);
        }
        break;
      case 'task':
        navigate('/tarefas');
        break;
      case 'funnel':
        navigate('/kanban');
        break;
    }
  };

  const handleOpenConversation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (leadInfo) {
      setConversaPopupOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !onEdit) return;
    const success = await onEdit(message.id, editContent.trim());
    if (success) {
      setIsEditing(false);
      toast.success('Mensagem editada');
    } else {
      toast.error('Erro ao editar mensagem');
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
          <div className="space-y-2">
            <div 
              className="relative group cursor-pointer"
              onClick={() => setPreviewOpen(true)}
            >
              <PDFThumbnail 
                url={message.media_url || ''} 
                className="hover:opacity-90 transition-opacity"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">Clique para visualizar</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1">
                {message.file_name || 'Documento'}
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
          </div>
        );

      case 'shared_item':
        if (message.shared_item_type === 'lead') {
          return (
            <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg w-full">
              <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{message.content}</p>
                <p className="text-xs text-muted-foreground">Lead</p>
              </div>
              {leadInfo && (leadInfo.telefone || leadInfo.phone) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenConversation}
                  className="h-7 w-7 p-0 shrink-0"
                  title="Abrir conversa"
                >
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        }
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
                {message.shared_item_type === 'task' && 'Tarefa'}
                {message.shared_item_type === 'funnel' && 'Funil'}
              </p>
            </div>
          </button>
        );

      default:
        if (isEditing) {
          return (
            <div className="flex items-center gap-1">
              <Input
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="text-sm h-7 bg-background/50 border-none"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleSaveEdit}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { setIsEditing(false); setEditContent(message.content || ''); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        }
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
        
        <div className="group/msg relative">
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
          {isOwn && message.message_type === 'text' && !isEditing && onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute -left-8 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/msg:opacity-100 transition-opacity"
              onClick={() => setIsEditing(true)}
              title="Editar mensagem"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
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

      {/* Conversa Popup para Leads */}
      {leadInfo && (
        <ConversaPopup
          open={conversaPopupOpen}
          onOpenChange={setConversaPopupOpen}
          leadId={leadInfo.id}
          leadName={leadInfo.name}
          leadPhone={leadInfo.telefone || leadInfo.phone}
        />
      )}
    </div>
  );
};
