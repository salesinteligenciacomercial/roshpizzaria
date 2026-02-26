import { useMemo } from "react";
import { format, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, User, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

const HOUR_HEIGHT = 80;
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; badgeBg: string }> = {
  agendado: { bg: "bg-blue-50 dark:bg-blue-950/50", border: "border-l-blue-500", text: "text-blue-900 dark:text-blue-100", badgeBg: "bg-blue-500" },
  concluido: { bg: "bg-green-50 dark:bg-green-950/50", border: "border-l-green-500", text: "text-green-900 dark:text-green-100", badgeBg: "bg-green-500" },
  cancelado: { bg: "bg-red-50 dark:bg-red-950/50", border: "border-l-red-500", text: "text-red-900 dark:text-red-100", badgeBg: "bg-red-500" },
  confirmado: { bg: "bg-emerald-50 dark:bg-emerald-950/50", border: "border-l-emerald-500", text: "text-emerald-900 dark:text-emerald-100", badgeBg: "bg-emerald-500" },
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  confirmado: "Confirmado",
};

/** Assign side-by-side columns to overlapping events */
function layoutEvents(events: Compromisso[]) {
  const sorted = [...events].sort((a, b) => {
    const diff = parseISO(a.data_hora_inicio).getTime() - parseISO(b.data_hora_inicio).getTime();
    if (diff !== 0) return diff;
    return parseISO(b.data_hora_fim).getTime() - parseISO(a.data_hora_fim).getTime();
  });

  type LayoutItem = { comp: Compromisso; col: number; numCols: number };
  const result: LayoutItem[] = [];
  const clusters: LayoutItem[][] = [];

  sorted.forEach(comp => {
    const s = parseISO(comp.data_hora_inicio).getTime();
    const e = parseISO(comp.data_hora_fim).getTime();

    // Find existing cluster that overlaps
    let addedToCluster = false;
    for (const cluster of clusters) {
      const clusterOverlaps = cluster.some(item => {
        const is = parseISO(item.comp.data_hora_inicio).getTime();
        const ie = parseISO(item.comp.data_hora_fim).getTime();
        return s < ie && e > is;
      });
      if (clusterOverlaps) {
        // Find available column in this cluster
        const usedCols = new Set(cluster.map(i => i.col));
        let col = 0;
        while (usedCols.has(col)) col++;
        const item = { comp, col, numCols: 0 };
        cluster.push(item);
        result.push(item);
        addedToCluster = true;
        break;
      }
    }

    if (!addedToCluster) {
      const item = { comp, col: 0, numCols: 0 };
      clusters.push([item]);
      result.push(item);
    }
  });

  // Set numCols for each cluster
  clusters.forEach(cluster => {
    const maxCol = Math.max(...cluster.map(i => i.col)) + 1;
    cluster.forEach(item => { item.numCols = maxCol; });
  });

  return result;
}

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
    <TooltipProvider delayDuration={200}>
      <ScrollArea className="h-[650px]">
        <div className="min-w-[750px]">
          {/* Header with day names */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] sticky top-0 z-20 bg-card border-b shadow-sm">
            <div className="p-1 text-[10px] text-muted-foreground text-center self-end pb-2" />
            {weekDays.map(day => {
              const dayCount = (compromissosByDay.get(format(day, "yyyy-MM-dd")) || []).length;
              return (
                <div
                  key={day.toISOString()}
                  className={`py-2 px-1 text-center cursor-pointer hover:bg-accent/50 transition-colors border-l border-border/30 ${
                    isToday(day) ? "bg-primary/10" : ""
                  } ${isSameDay(day, selectedDate) ? "ring-2 ring-inset ring-primary" : ""}`}
                  onClick={() => onSelectDate?.(day)}
                >
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className={`text-base font-semibold ${isToday(day) ? "bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center mx-auto" : ""}`}>
                    {format(day, "dd")}
                  </div>
                  {dayCount > 0 && (
                    <div className="text-[9px] text-muted-foreground mt-0.5">{dayCount} comp.</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline grid */}
          <div className="grid grid-cols-[56px_repeat(7,1fr)] relative">
            {/* Hour labels */}
            <div className="relative">
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="border-b border-border/40 text-[10px] text-muted-foreground text-right pr-2 relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2 right-2">{`${String(hour).padStart(2, "0")}:00`}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map(day => {
              const key = format(day, "yyyy-MM-dd");
              const dayCompromissos = compromissosByDay.get(key) || [];
              const showTimeLine = isToday(day) && currentTimeTop !== null;
              const layoutItems = layoutEvents(dayCompromissos);

              return (
                <div
                  key={key}
                  className={`relative border-l border-border/30 ${isToday(day) ? "bg-primary/[0.03]" : ""}`}
                >
                  {/* Hour grid lines */}
                  {HOURS.map(hour => (
                    <div
                      key={hour}
                      className="border-b border-border/30 border-dashed"
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
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-[5px] shadow-sm" />
                        <div className="flex-1 h-[2px] bg-red-500 shadow-sm" />
                      </div>
                    </div>
                  )}

                  {/* Appointment blocks */}
                  {layoutItems.map(({ comp, col, numCols }) => {
                    const start = parseISO(comp.data_hora_inicio);
                    const end = parseISO(comp.data_hora_fim);
                    const startHour = start.getHours() + start.getMinutes() / 60;
                    const endHour = end.getHours() + end.getMinutes() / 60;
                    const clampedStart = Math.max(startHour, START_HOUR);
                    const clampedEnd = Math.min(endHour, END_HOUR);
                    const top = (clampedStart - START_HOUR) * HOUR_HEIGHT;
                    const height = Math.max(32, (clampedEnd - clampedStart) * HOUR_HEIGHT);
                    const style = STATUS_STYLES[comp.status] || STATUS_STYLES.agendado;
                    const title = comp.titulo || comp.tipo_servico || "Sem título";
                    const clientName = comp.lead?.name || comp.paciente || "";
                    const timeStr = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`;

                    const colWidth = 100 / numCols;
                    const leftPct = col * colWidth;
                    const gap = numCols > 1 ? 2 : 1;

                    return (
                      <Tooltip key={comp.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute rounded-md border-l-[4px] cursor-pointer 
                              hover:shadow-xl hover:z-30 hover:scale-[1.02] transition-all overflow-hidden z-10 
                              ${style.bg} ${style.border} ${style.text}`}
                            style={{
                              top,
                              height,
                              left: `calc(${leftPct}% + ${gap}px)`,
                              width: `calc(${colWidth}% - ${gap * 2}px)`,
                            }}
                            onClick={() => onSelectCompromisso?.(comp)}
                          >
                            <div className="px-1.5 py-1 h-full flex flex-col">
                              {/* Title - always visible */}
                              <div className="text-[11px] font-bold truncate leading-tight">
                                {title}
                              </div>
                              {/* Time - always visible */}
                              <div className="text-[10px] font-semibold opacity-90 truncate leading-tight flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5 shrink-0" />
                                {timeStr}
                              </div>
                              {/* Client name - show if enough height */}
                              {height >= 50 && clientName && (
                                <div className="text-[10px] opacity-80 truncate leading-tight flex items-center gap-0.5 mt-0.5">
                                  <User className="h-2.5 w-2.5 shrink-0" />
                                  {clientName}
                                </div>
                              )}
                              {/* Status badge - show if tall enough */}
                              {height >= 70 && (
                                <div className="mt-auto pt-0.5">
                                  <Badge className={`${style.badgeBg} text-white text-[8px] h-4 px-1.5`}>
                                    {STATUS_LABEL[comp.status] || comp.status}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[280px] p-3">
                          <div className="space-y-1.5">
                            <div className="font-bold text-sm">{title}</div>
                            <div className="text-xs flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" />
                              {timeStr}
                            </div>
                            {clientName && (
                              <div className="text-xs flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5" />
                                {clientName}
                                {comp.lead?.phone && (
                                  <span className="text-muted-foreground">({comp.lead.phone})</span>
                                )}
                              </div>
                            )}
                            {comp.agenda && (
                              <div className="text-xs text-muted-foreground">
                                Agenda: {comp.agenda.nome}
                              </div>
                            )}
                            {comp.profissional && (
                              <div className="text-xs text-muted-foreground">
                                Profissional: {comp.profissional.nome}
                                {comp.profissional.especialidade && ` (${comp.profissional.especialidade})`}
                              </div>
                            )}
                            {comp.observacoes && (
                              <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                                {comp.observacoes}
                              </div>
                            )}
                            <div className="pt-1">
                              <Badge className={`${style.badgeBg} text-white text-[10px]`}>
                                {STATUS_LABEL[comp.status] || comp.status}
                              </Badge>
                            </div>
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
