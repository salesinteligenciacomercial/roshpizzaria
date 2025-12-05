import { useState, useRef, useEffect } from 'react';
import { InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { MessageItem } from './MessageItem';
import { ShareItemDialog } from './ShareItemDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Share2, Image, FileText, Video, Mic, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatWindowProps {
  conversation: InternalConversation;
  currentUserId: string | null;
}

export const ChatWindow = ({ conversation, currentUserId }: ChatWindowProps) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const { messages, loading, sendMessage, uploadMedia } = useInternalMessages(conversation.id);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async () => {
    if (!message.trim() && !selectedFile) return;

    setSending(true);
    try {
      if (selectedFile) {
        await handleSendFile(selectedFile);
        setSelectedFile(null);
      }
      
      if (message.trim()) {
        const success = await sendMessage(message.trim());
        if (success) {
          setMessage('');
        } else {
          toast.error('Erro ao enviar mensagem');
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendFile = async (file: File) => {
    setUploadingMedia(true);
    try {
      const url = await uploadMedia(file);
      if (!url) {
        toast.error('Erro ao fazer upload do arquivo');
        return;
      }

      let messageType = 'document';
      if (file.type.startsWith('image/')) messageType = 'image';
      else if (file.type.startsWith('video/')) messageType = 'video';
      else if (file.type.startsWith('audio/')) messageType = 'audio';
      else if (file.type === 'application/pdf') messageType = 'pdf';

      await sendMessage('', messageType, url, file.name);
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo: 50MB');
        return;
      }
      setSelectedFile(file);
    }
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleShareItem = async (itemType: string, itemId: string, itemName: string) => {
    const success = await sendMessage(
      `📌 ${itemName}`,
      'shared_item',
      undefined,
      undefined,
      itemType,
      itemId
    );
    
    if (success) {
      toast.success('Item compartilhado!');
    } else {
      toast.error('Erro ao compartilhar item');
    }
    setShowShareDialog(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>Nenhuma mensagem ainda</p>
              <p className="text-sm">Envie a primeira mensagem!</p>
            </div>
          ) : (
            messages.map(msg => (
              <MessageItem
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === currentUserId}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Selected file preview */}
      {selectedFile && (
        <div className="px-4 py-2 border-t bg-accent/30">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm truncate flex-1">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t shrink-0">
        <div className="flex items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" disabled={uploadingMedia}>
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Image className="h-4 w-4 mr-2" />
                Imagem/Vídeo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
                  fileInputRef.current.click();
                }
              }}>
                <FileText className="h-4 w-4 mr-2" />
                Documento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => audioInputRef.current?.click()}>
                <Mic className="h-4 w-4 mr-2" />
                Áudio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0"
            onClick={() => setShowShareDialog(true)}
          >
            <Share2 className="h-5 w-5" />
          </Button>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
            className="min-h-[40px] max-h-[120px] resize-none"
            rows={1}
          />

          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !selectedFile) || sending || uploadingMedia}
            size="icon"
            className="shrink-0"
          >
            {sending || uploadingMedia ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'media')}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e, 'audio')}
        />
      </div>

      <ShareItemDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        onShare={handleShareItem}
      />
    </div>
  );
};
