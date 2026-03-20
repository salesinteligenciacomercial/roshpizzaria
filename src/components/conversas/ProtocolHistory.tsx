import { FileText, Clock, CheckCircle2, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AttendanceProtocol } from "@/hooks/useAttendanceProtocol";

interface ProtocolHistoryProps {
  protocols: AttendanceProtocol[];
  isLoading?: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  aberto: { label: 'Aberto', color: 'bg-amber-500/15 text-amber-700', icon: Clock },
  em_atendimento: { label: 'Em atendimento', color: 'bg-blue-500/15 text-blue-700', icon: User },
  finalizado: { label: 'Finalizado', color: 'bg-emerald-500/15 text-emerald-700', icon: CheckCircle2 },
};

const startedByLabels: Record<string, string> = {
  humano: 'Atendente',
  ura: 'URA',
  bot: 'Bot',
  ia_atendimento: 'IA',
};

export function ProtocolHistory({ protocols, isLoading }: ProtocolHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Carregando protocolos...
      </div>
    );
  }

  if (protocols.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhum protocolo registrado</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-2 pr-2">
        {protocols.map((protocol) => {
          const config = statusConfig[protocol.status] || statusConfig.aberto;
          const StatusIcon = config.icon;

          return (
            <div
              key={protocol.id}
              className="border rounded-lg p-3 space-y-1.5 bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-foreground">
                  {protocol.protocol_number}
                </span>
                <Badge variant="outline" className={`${config.color} text-[10px] px-1.5 py-0 h-5 gap-1`}>
                  <StatusIcon className="h-2.5 w-2.5" />
                  {config.label}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{startedByLabels[protocol.started_by] || protocol.started_by}</span>
                <span>•</span>
                <span>
                  {format(new Date(protocol.started_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                </span>
                {protocol.attending_user_name && (
                  <>
                    <span>•</span>
                    <span>{protocol.attending_user_name}</span>
                  </>
                )}
              </div>

              {protocol.summary && (
                <p className="text-[11px] text-muted-foreground italic line-clamp-2">
                  {protocol.summary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
