import { useState } from "react";
import { 
  Bell, 
  CheckSquare, 
  AlertTriangle, 
  Calendar, 
  Clock,
  MessageSquare,
  Check,
  X,
  Loader2,
  Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNotifications, AggregatedNotification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const getNotificationIcon = (tipo: string) => {
  switch (tipo) {
    case 'tarefa_hoje':
      return <CheckSquare className="h-4 w-4 text-blue-500" />;
    case 'tarefa_atrasada':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'tarefa_proxima':
      return <Clock className="h-4 w-4 text-amber-500" />;
    case 'compromisso_hoje':
      return <Calendar className="h-4 w-4 text-green-500" />;
    case 'lembrete_pendente':
      return <Bell className="h-4 w-4 text-purple-500" />;
    case 'mensagem_nova':
      return <MessageSquare className="h-4 w-4 text-cyan-500" />;
    case 'ia_insight':
      return <Brain className="h-4 w-4 text-orange-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

const getNotificationLabel = (tipo: string) => {
  switch (tipo) {
    case 'tarefa_hoje':
      return 'Tarefa de hoje';
    case 'tarefa_atrasada':
      return 'Tarefa atrasada';
    case 'tarefa_proxima':
      return 'Tarefa próxima';
    case 'compromisso_hoje':
      return 'Compromisso';
    case 'lembrete_pendente':
      return 'Lembrete';
    case 'mensagem_nova':
      return 'Nova mensagem';
    case 'ia_insight':
      return 'Insight da IA';
    default:
      return 'Notificação';
  }
};

const groupNotifications = (notifications: AggregatedNotification[]) => {
  const groups: Record<string, AggregatedNotification[]> = {
    ia: [],
    tarefas: [],
    compromissos: [],
    lembretes: [],
    mensagens: [],
    outros: [],
  };

  notifications.forEach(n => {
    if (n.tipo === 'ia_insight') {
      groups.ia.push(n);
    } else if (n.tipo.startsWith('tarefa')) {
      groups.tarefas.push(n);
    } else if (n.tipo === 'compromisso_hoje') {
      groups.compromissos.push(n);
    } else if (n.tipo === 'lembrete_pendente') {
      groups.lembretes.push(n);
    } else if (n.tipo === 'mensagem_nova') {
      groups.mensagens.push(n);
    } else {
      groups.outros.push(n);
    }
  });

  return groups;
};

interface NotificationItemProps {
  notification: AggregatedNotification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 group",
        !notification.lida && "bg-primary/5"
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getNotificationIcon(notification.tipo)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {getNotificationLabel(notification.tipo)}
          </span>
          {!notification.lida && (
            <span className="w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <p className="text-sm font-medium truncate">{notification.titulo}</p>
        <p className="text-xs text-muted-foreground truncate">{notification.mensagem}</p>
      </div>
      <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.lida && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAsRead(notification.id);
            }}
            title="Marcar como lida"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Remover"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface NotificationGroupProps {
  title: string;
  icon: React.ReactNode;
  notifications: AggregatedNotification[];
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationGroup({ title, icon, notifications, onMarkAsRead, onDelete }: NotificationGroupProps) {
  if (notifications.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-3 py-2">
        {icon}
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </span>
        <Badge variant="secondary" className="text-xs h-5">
          {notifications.length}
        </Badge>
      </div>
      <div className="space-y-1">
        {notifications.map(notification => (
          <NotificationItem 
            key={notification.id} 
            notification={notification}
            onMarkAsRead={onMarkAsRead}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    refresh 
  } = useNotifications();

  const groups = groupNotifications(notifications);
  const hasNotifications = notifications.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          onMouseEnter={() => {
            if (!open) refresh();
          }}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-xs font-bold"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notificações do Dia</h3>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm"
              className="text-xs h-7"
              onClick={markAllAsRead}
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasNotifications ? (
            <div className="p-2 space-y-2">
              {/* IA Insights first */}
              <NotificationGroup
                title="Insights da IA"
                icon={<Brain className="h-4 w-4 text-orange-500" />}
                notifications={groups.ia}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
              
              {groups.ia.length > 0 && groups.tarefas.length > 0 && (
                <Separator className="my-2" />
              )}
              
              <NotificationGroup
                title="Tarefas"
                icon={<CheckSquare className="h-4 w-4 text-blue-500" />}
                notifications={groups.tarefas}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
              
              {groups.tarefas.length > 0 && groups.compromissos.length > 0 && (
                <Separator className="my-2" />
              )}
              
              <NotificationGroup
                title="Compromissos"
                icon={<Calendar className="h-4 w-4 text-green-500" />}
                notifications={groups.compromissos}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
              
              {(groups.tarefas.length > 0 || groups.compromissos.length > 0) && groups.lembretes.length > 0 && (
                <Separator className="my-2" />
              )}
              
              <NotificationGroup
                title="Lembretes"
                icon={<Bell className="h-4 w-4 text-purple-500" />}
                notifications={groups.lembretes}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
              
              {groups.mensagens.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <NotificationGroup
                    title="Mensagens"
                    icon={<MessageSquare className="h-4 w-4 text-cyan-500" />}
                    notifications={groups.mensagens}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                </>
              )}
              
              {groups.outros.length > 0 && (
                <>
                  <Separator className="my-2" />
                  <NotificationGroup
                    title="Outros"
                    icon={<Bell className="h-4 w-4 text-muted-foreground" />}
                    notifications={groups.outros}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma notificação
              </p>
              <p className="text-xs text-muted-foreground/70">
                Suas notificações do dia aparecerão aqui
              </p>
            </div>
          )}
        </ScrollArea>
        
        <div className="p-3 border-t bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            Mostrando notificações de hoje
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
