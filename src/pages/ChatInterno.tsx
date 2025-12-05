import { useState, useEffect, useRef, useCallback } from 'react';
import { useInternalChat, InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plus, 
  Search, 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  File as FileIcon, 
  Share2,
  Users,
  MoreVertical,
  ArrowLeft,
  Video,
  Mic,
  Square,
  Loader2,
  X
} from 'lucide-react';
import { NewConversationDialog } from '@/components/internal-chat/NewConversationDialog';
import { ShareItemDialog } from '@/components/internal-chat/ShareItemDialog';
import { MessageItem } from '@/components/internal-chat/MessageItem';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ChatInterno() {
  const [selectedConversation, setSelectedConversation] = useState<InternalConversation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    conversations, 
    loading: conversationsLoading, 
    currentUserId,
    createConversation,
    markAsRead,
    refresh
  } = useInternalChat();
  
  const {
    messages,
    loading: messagesLoading,
    sendMessage,
    uploadMedia
  } = useInternalMessages(selectedConversation?.id || null);
  
  const { members } = useTeamMembers();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedConversation) {
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation, markAsRead]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollHeight, 200) + 'px';
    }
  }, [messageText]);

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true;
    const name = conv.name || conv.participants?.map(p => p.profile?.full_name).join(', ') || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSendMessage = async () => {
    if ((!messageText.trim() && !selectedFile) || !selectedConversation) return;
    
    try {
      if (selectedFile) {
        await handleSendFile(selectedFile);
        setSelectedFile(null);
      }
      
      if (messageText.trim()) {
        await sendMessage(messageText.trim());
        setMessageText('');
      }
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
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
    if (!selectedFile) return <FileIcon className="h-4 w-4" />;
    if (selectedFile.type.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (selectedFile.type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (selectedFile.type.startsWith('audio/')) return <Mic className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const handleConversationSelect = (conv: InternalConversation) => {
    setSelectedConversation(conv);
    setShowMobileList(false);
  };

  const handleConversationCreated = async (conversationId: string) => {
    const updatedConversations = await refresh();
    const newConv = updatedConversations?.find(c => c.id === conversationId);
    if (newConv) {
      setSelectedConversation(newConv);
      setShowMobileList(false);
    }
    setNewConversationOpen(false);
  };

  const getConversationName = (conv: InternalConversation) => {
    if (conv.name) return conv.name;
    const otherParticipants = conv.participants?.filter(p => p.user_id !== currentUserId);
    return otherParticipants?.map(p => p.profile?.full_name).join(', ') || 'Conversa';
  };

  const getConversationAvatar = (conv: InternalConversation) => {
    if (conv.is_group) return null;
    const otherParticipant = conv.participants?.find(p => p.user_id !== currentUserId);
    return otherParticipant?.profile?.avatar_url;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex bg-background rounded-xl border border-border overflow-hidden">
      {/* Lista de Conversas */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-border flex flex-col bg-card ${!showMobileList && 'hidden md:flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Chat Equipe</h2>
            <Button size="icon" variant="ghost" onClick={() => setNewConversationOpen(true)}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Lista */}
        <ScrollArea className="flex-1">
          {conversationsLoading ? (
            <div className="p-4 text-center text-muted-foreground">Carregando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              {searchTerm ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredConversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => handleConversationSelect(conv)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-accent/50 transition-colors text-left ${
                      isSelected ? 'bg-accent' : ''
                    }`}
                  >
                    <Avatar className="h-12 w-12 flex-shrink-0">
                      <AvatarImage src={getConversationAvatar(conv) || undefined} />
                      <AvatarFallback className={conv.is_group ? 'bg-primary/20' : 'bg-muted'}>
                        {conv.is_group ? (
                          <Users className="h-5 w-5 text-primary" />
                        ) : (
                          getInitials(getConversationName(conv))
                        )}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground truncate">
                          {getConversationName(conv)}
                        </span>
                        {conv.last_message && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(conv.last_message.created_at), 'HH:mm', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-muted-foreground truncate">
                          {conv.last_message?.content || 'Sem mensagens'}
                        </p>
                        {conv.unread_count > 0 && (
                          <Badge variant="destructive" className="ml-2 flex-shrink-0">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Área de Chat */}
      <div className={`flex-1 flex flex-col ${showMobileList && 'hidden md:flex'}`}>
        {selectedConversation ? (
          <>
            {/* Header do Chat */}
            <div className="p-4 border-b border-border flex items-center gap-3 bg-card">
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden"
                onClick={() => setShowMobileList(true)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={getConversationAvatar(selectedConversation) || undefined} />
                <AvatarFallback className={selectedConversation.is_group ? 'bg-primary/20' : 'bg-muted'}>
                  {selectedConversation.is_group ? (
                    <Users className="h-4 w-4 text-primary" />
                  ) : (
                    getInitials(getConversationName(selectedConversation))
                  )}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">
                  {getConversationName(selectedConversation)}
                </h3>
                {selectedConversation.is_group && selectedConversation.participants && (
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.participants.length} participantes
                  </p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar item do CRM
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mensagens */}
            <ScrollArea className="flex-1 p-4 bg-muted/30">
              {messagesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Envie a primeira mensagem!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageItem 
                      key={message.id} 
                      message={message} 
                      isOwn={message.sender_id === currentUserId}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Selected file preview */}
            {selectedFile && (
              <div className="px-4 py-2 border-t border-border bg-accent/30">
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
              <div className="px-4 py-2 border-t border-border bg-destructive/10">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                  <span className="text-sm text-destructive font-medium">
                    Gravando... {formatRecordingTime(recordingTime)}
                  </span>
                </div>
              </div>
            )}

            {/* Input de Mensagem */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-end gap-2">
                {/* Hidden file inputs */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*"
                />
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="video/*"
                />
                <input
                  type="file"
                  ref={audioInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="audio/*"
                />
                
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
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
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
                          fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                          fileInputRef.current.click();
                        }
                      }}
                    >
                      <FileIcon className="h-4 w-4 mr-2" />
                      Documento
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="cursor-pointer"
                      onClick={() => setShareDialogOpen(true)}
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
                  placeholder="Digite sua mensagem... (Ctrl+V para colar imagem)"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onPaste={handlePaste}
                  className="min-h-[40px] max-h-[200px] resize-none flex-1"
                  rows={1}
                  disabled={isRecording}
                />
                
                <Button 
                  onClick={handleSendMessage} 
                  disabled={(!messageText.trim() && !selectedFile) || uploadingMedia || isRecording}
                  size="icon"
                  className="shrink-0"
                >
                  {uploadingMedia ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
            <Users className="h-16 w-16 mb-4 opacity-30" />
            <h3 className="text-xl font-medium mb-2">Chat Interno da Equipe</h3>
            <p className="text-sm mb-6">Selecione uma conversa ou inicie uma nova</p>
            <Button onClick={() => setNewConversationOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conversa
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewConversationDialog
        open={newConversationOpen}
        onOpenChange={setNewConversationOpen}
        createConversation={createConversation}
        onCreated={handleConversationCreated}
      />

      <ShareItemDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        onShare={async (itemType, itemId, itemTitle) => {
          if (selectedConversation) {
            await sendMessage(`📌 ${itemTitle}`, 'shared_item', undefined, undefined, itemType, itemId);
            setShareDialogOpen(false);
          }
        }}
      />
    </div>
  );
}
