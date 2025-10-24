import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Video, Info, User, MessageSquare, Instagram, Facebook, FileText, DollarSign } from "lucide-react";

interface ConversationHeaderProps {
  contactName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  avatarUrl?: string;
  produto?: string;
  valor?: string;
  responsavel?: string;
  showInfoPanel: boolean;
  onToggleInfoPanel: () => void;
}

export function ConversationHeader({
  contactName,
  channel,
  avatarUrl,
  produto,
  valor,
  responsavel,
  showInfoPanel,
  onToggleInfoPanel,
}: ConversationHeaderProps) {
  const getChannelIcon = () => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="h-4 w-4 text-[#25D366]" />;
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-600" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarUrl} alt={contactName} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(contactName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              {contactName}
              {getChannelIcon()}
            </h2>
            <span className="text-xs text-muted-foreground capitalize">{channel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggleInfoPanel}
            className={showInfoPanel ? "bg-accent" : ""}
          >
            <Info className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Informações do Lead */}
      <div className="flex items-center gap-4 text-sm">
        {produto && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span>{produto}</span>
          </div>
        )}
        {valor && (
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{valor}</span>
          </div>
        )}
        {responsavel && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span>{responsavel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
