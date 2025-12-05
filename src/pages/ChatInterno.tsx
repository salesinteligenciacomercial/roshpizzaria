import { useState, useEffect, useRef } from 'react';
import { useInternalChat, InternalConversation } from '@/hooks/useInternalChat';
import { useInternalMessages } from '@/hooks/useInternalMessages';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
  File, 
  Share2,
  Users,
  MoreVertical,
  ArrowLeft
} from 'lucide-react';
import { NewConversationDialog } from '@/components/internal-chat/NewConversationDialog';
import { ShareItemDialog } from '@/components/internal-chat/ShareItemDialog';
import { MessageItem } from '@/components/internal-chat/MessageItem';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true;
    const name = conv.name || conv.participants?.map(p => p.profile?.full_name).join(', ') || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    await sendMessage(messageText.trim());
    setMessageText('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;
    
    let messageType: 'image' | 'video' | 'audio' | 'document' = 'document';
    if (file.type.startsWith('image/')) messageType = 'image';
    else if (file.type.startsWith('video/')) messageType = 'video';
    else if (file.type.startsWith('audio/')) messageType = 'audio';
    
    const mediaUrl = await uploadMedia(file);
    if (mediaUrl) {
      await sendMessage(file.name, messageType, mediaUrl, file.name);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
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

            {/* Input de Mensagem */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Paperclip className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = 'image/*';
                        fileInputRef.current.click();
                      }
                    }}>
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Imagem
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx';
                        fileInputRef.current.click();
                      }
                    }}>
                      <File className="h-4 w-4 mr-2" />
                      Documento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                      <Share2 className="h-4 w-4 mr-2" />
                      Item do CRM
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Input
                  placeholder="Digite sua mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                
                <Button onClick={handleSendMessage} disabled={!messageText.trim()}>
                  <Send className="h-5 w-5" />
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
