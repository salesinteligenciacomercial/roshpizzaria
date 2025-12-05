// Chat interno com suporte a gravação de áudio, paste de imagens e auto-expand
import { useState, useRef, useEffect, useCallback } from 'react';
import { InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { MessageItem } from './MessageItem';
import { ShareItemDialog } from './ShareItemDialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, Share2, Image, FileText, Video, Mic, Loader2, X, Square } from 'lucide-react';
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { messages, loading, sendMessage, uploadMedia } = useInternalMessages(conversation.id);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [message]);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  // Handle paste for images
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setSelectedFile(file);
          toast.info('Imagem colada! Clique em enviar.');
        }
        return;
      }
    }
  }, []);

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

  // Audio Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        
        stream.getTracks().forEach(track => track.stop());
        
        if (audioFile.size > 0) {
          setSelectedFile(audioFile);
          toast.info('Áudio gravado! Clique em enviar.');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast.info('Gravando áudio...');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Erro ao acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFileIcon = () => {
    if (!selectedFile) return <FileText className="h-4 w-4" />;
    if (selectedFile.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (selectedFile.type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (selectedFile.type.startsWith('audio/')) return <Mic className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
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
            {getFileIcon()}
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

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-4 py-2 border-t bg-destructive/10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm text-destructive font-medium">
              Gravando... {formatRecordingTime(recordingTime)}
            </span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t shrink-0">
        <div className="flex items-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0" disabled={uploadingMedia || isRecording}>
                <Paperclip className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px] bg-popover border shadow-lg z-50">
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.click();
                  }
                }}
              >
                <Image className="h-4 w-4 mr-2" />
                Imagem
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => {
                  if (videoInputRef.current) {
                    videoInputRef.current.click();
                  }
                }}
              >
                <Video className="h-4 w-4 mr-2" />
                Vídeo
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => {
                  if (audioInputRef.current) {
                    audioInputRef.current.click();
                  }
                }}
              >
                <Mic className="h-4 w-4 mr-2" />
                Áudio
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
                    fileInputRef.current.click();
                  }
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Documento
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => setShowShareDialog(true)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Item do CRM
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Record audio button */}
          <Button 
            variant={isRecording ? "destructive" : "ghost"} 
            size="icon" 
            className="shrink-0"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={uploadingMedia}
          >
            {isRecording ? (
              <Square className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Digite sua mensagem... (Ctrl+V para colar imagem)"
            className="min-h-[40px] max-h-[200px] resize-none flex-1"
            rows={1}
            disabled={isRecording}
          />

          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !selectedFile) || sending || uploadingMedia || isRecording}
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
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileSelect}
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
