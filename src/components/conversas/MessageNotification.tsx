import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, X } from "lucide-react";

interface MessageNotificationProps {
  contactName: string;
  message: string;
  avatarUrl?: string;
  onView: () => void;
  onDismiss: () => void;
}

export function MessageNotification({
  contactName,
  message,
  avatarUrl,
  onView,
  onDismiss,
}: MessageNotificationProps) {
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-md animate-slide-in-right">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {avatarUrl && avatarUrl.trim() !== '' ? (
            <AvatarImage src={avatarUrl} alt={contactName} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-primary">
            {contactName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground">
              Nova mensagem de {contactName}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-1"
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground truncate mb-3">
            {message}
          </p>
          
          <Button
            onClick={onView}
            size="sm"
            className="w-full"
          >
            <MessageCircle className="h-3 w-3 mr-2" />
            Visualizar e Responder
          </Button>
        </div>
      </div>
    </div>
  );
}