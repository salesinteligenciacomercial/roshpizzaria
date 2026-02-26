import { useMemo } from "react";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Compromisso {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  titulo?: string;
  paciente?: string;
  observacoes?: string;
  lead?: { name: string; phone?: string };
  agenda?: { nome: string; tipo: string };
  profissional?: { nome: string; especialidade?: string };
}

interface AgendaWeekViewProps {
  selectedDate: Date;
  compromissos: Compromisso[];
  onSelectDate?: (date: Date) => void;
  onSelectCompromisso?: (compromisso: Compromisso) => void;
}

const HOUR_HEIGHT = 60;
const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  agendado: { bg: "bg-blue-500/15", border: "border-l-blue-500", text: "text-blue-900 dark:text-blue-200" },
  concluido: { bg: "bg-green-500/15", border: "border-l-green-500", text: "text-green-900 dark:text-green-200" },
  cancelado: { bg: "bg-red-500/15", border: "border-l-red-500", text: "text-red-900 dark:text-red-200" },
  confirmado: { bg: "bg-emerald-500/15", border: "border-l-emerald-500", text: "text-emerald-900 dark:text-emerald-200" },
};

export function AgendaWeekView({ selectedDate, compromissos, onSelectDate, onSelectCompromisso }: AgendaWeekViewProps) {
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { locale: ptBR });
    const end = endOfWeek(selectedDate, { locale: ptBR });
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const compromissosByDay = useMemo(() => {
    const map = new Map<string, Compromisso[]>();
    weekDays.forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      map.set(key, compromissos.filter(c => isSameDay(parseISO(c.data_hora_inicio), day)));
    });
    return map;
  }, [weekDays, compromissos]);

  const now = new Date();
  const currentTimeTop = useMemo(() => {
    const hours = now.getHours();
    const minutes = now.getMinutes();
    if (hours < START_HOUR || hours >= END_HOUR) return null;
    return (hours - START_HOUR) * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
  }, []);

  return (
    <TooltipProvider>
      <ScrollArea className="h-[600px]">
        <div className="min-w-[700px]">
          {/* Header with day names */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 z-10 bg-card border-b">
            <div className="p-2 text-xs text-muted-foreground text-center">Hora</div>
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className={`p-2 text-center cursor-pointer hover:bg-accent/50 transition-colors ${
                  isToday(day) ? "bg-primary/10 font-bold" : ""
                } ${isSameDay(day, selectedDate) ? "ring-2 ring-primary ring-inset" : ""}`}
                onClick={() => onSelectDate?.(day)}
              >
                <div className="text-xs text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: ptBR })}
                </div>
                <div className={`text-lg ${isToday(day) ? "text-primary font-bold" : ""}`}>
                  {format(day, "dd")}
                </div>
              </div>
            ))}
          </div>

          {/* Timeline grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
            {/* Hour labels */}
            <div className="relative">
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="border-b border-border/50 text-xs text-muted-foreground text-right pr-2 flex items-start justify-end"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="mt-[-8px]">{`${hour}:00`}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const dayCompromissos = compromissosByDay.get(key) || [];
              const showTimeLine = isToday(day) && currentTimeTop !== null;

              return (
                <div
                  key={key}
                  className={`relative border-l border-border/30 ${isToday(day) ? "bg-primary/5" : ""}`}
                >
                  {/* Hour grid lines */}
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="border-b border-border/30"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {showTimeLine && (
                    <div
                      className="absolute left-0 right-0 z-20 pointer-events-none"
                      style={{ top: currentTimeTop! }}
                    >
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                        <div className="flex-1 h-[2px] bg-red-500" />
                      </div>
                    </div>
                  )}

                  {/* Appointment blocks */}
                  {dayCompromissos.map(comp => {
                    const start = parseISO(comp.data_hora_inicio);
                    const end = parseISO(comp.data_hora_fim);
                    const startHour = start.getHours() + start.getMinutes() / 60;
                    const endHour = end.getHours() + end.getMinutes() / 60;
                    const top = Math.max(0, (startHour - START_HOUR) * HOUR_HEIGHT);
                    const height = Math.max(20, (endHour - startHour) * HOUR_HEIGHT);
                    const colors = STATUS_COLORS[comp.status] || STATUS_COLORS.agendado;
                    const title = comp.titulo || comp.tipo_servico;
                    const clientName = comp.lead?.name || comp.paciente || "";

                    return (
                      <Tooltip key={comp.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute left-0.5 right-0.5 rounded-md border-l-3 px-1.5 py-0.5 cursor-pointer 
                              hover:shadow-md transition-shadow overflow-hidden z-10 ${colors.bg} ${colors.border} ${colors.text}`}
                            style={{ top, height: Math.min(height, (END_HOUR - START_HOUR) * HOUR_HEIGHT - top) }}
                            onClick={() => onSelectCompromisso?.(comp)}
                          >
                            <div className="text-[11px] font-semibold truncate">{title}</div>
                            {height > 30 && (
                              <div className="text-[10px] opacity-80 truncate">
                                {format(start, "HH:mm")} - {format(end, "HH:mm")}
                              </div>
                            )}
                            {height > 48 && clientName && (
                              <div className="text-[10px] opacity-70 truncate">{clientName}</div>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-1">
                            <div className="font-semibold">{title}</div>
                            <div className="text-xs">
                              {format(start, "HH:mm")} - {format(end, "HH:mm")}
                            </div>
                            {clientName && <div className="text-xs">Cliente: {clientName}</div>}
                            {comp.observacoes && (
                              <div className="text-xs text-muted-foreground">{comp.observacoes}</div>
                            )}
                            {comp.profissional && (
                              <div className="text-xs">Profissional: {comp.profissional.nome}</div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
}
