import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ConversationList } from './ConversationList';
import { ChatWindow } from './ChatWindow';
import { NewConversationDialog } from './NewConversationDialog';
import { useInternalChat, InternalConversation } from '@/hooks/useInternalChat';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ChatDrawer = ({ open, onOpenChange }: ChatDrawerProps) => {
  const [selectedConversation, setSelectedConversation] = useState<InternalConversation | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const { conversations, loading, markAsRead, getConversationDisplayName, currentUserId } = useInternalChat();

  const handleSelectConversation = (conversation: InternalConversation) => {
    setSelectedConversation(conversation);
    markAsRead(conversation.id);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  const handleConversationCreated = (conversationId: string) => {
    const newConvo = conversations.find(c => c.id === conversationId);
    if (newConvo) {
      setSelectedConversation(newConvo);
    }
    setShowNewDialog(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className="w-full sm:w-[440px] p-0 flex flex-col"
        >
          <SheetHeader className="p-4 border-b shrink-0">
            <div className="flex items-center gap-2">
              {selectedConversation && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  className="h-8 w-8"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Users className="h-5 w-5 text-primary" />
              <SheetTitle className="flex-1">
                {selectedConversation 
                  ? getConversationDisplayName(selectedConversation)
                  : 'Chat da Equipe'
                }
              </SheetTitle>
              {!selectedConversation && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowNewDialog(true)}
                  className="h-8 w-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-hidden">
            {selectedConversation ? (
              <ChatWindow 
                conversation={selectedConversation}
                currentUserId={currentUserId}
              />
            ) : (
              <ConversationList
                conversations={conversations}
                loading={loading}
                currentUserId={currentUserId}
                onSelect={handleSelectConversation}
                getDisplayName={getConversationDisplayName}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NewConversationDialog
        open={showNewDialog}
        onOpenChange={setShowNewDialog}
        onCreated={handleConversationCreated}
      />
    </>
  );
};
