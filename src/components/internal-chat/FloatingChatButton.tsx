import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatDrawer } from './ChatDrawer';
import { useInternalChat } from '@/hooks/useInternalChat';

export const FloatingChatButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { getTotalUnread } = useInternalChat();
  
  const totalUnread = getTotalUnread();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-primary hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
        {totalUnread > 0 && (
          <Badge 
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs bg-destructive text-destructive-foreground"
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </Badge>
        )}
      </Button>

      <ChatDrawer open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
};
