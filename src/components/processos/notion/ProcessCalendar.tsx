import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  CalendarDays, 
  Clock, 
  User, 
  FileText, 
  CheckCircle2, 
  Circle,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink
} from "lucide-react";
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface ProcessTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_name: string | null;
  page_type: string;
}

interface Compromisso {
  id: string;
  titulo: string | null;
  tipo_servico: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  status: string | null;
  paciente: string | null;
}

interface ProcessCalendarProps {
  companyId: string | null;
}

export function ProcessCalendar({ companyId }: ProcessCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId, currentMonth]);

  const loadData = async () => {
    if (!companyId) return;
    setLoading(true);

    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);

    // Load tasks from process_pages
    const { data: tasksData } = await supabase
      .from('process_pages')
      .select('id, title, properties, page_type, created_at')
      .eq('company_id', companyId)
      .eq('page_type', 'task');

    if (tasksData) {
      const mappedTasks: ProcessTask[] = tasksData.map(page => {
        const props = page.properties as Record<string, any> || {};
        return {
          id: page.id,
          title: page.title,
          description: props.description || null,
          status: props.status || 'backlog',
          priority: props.priority || 'medium',
          due_date: props.due_date || null,
          assignee_name: props.assignee_name || null,
          page_type: page.page_type,
        };
      });
      setTasks(mappedTasks);
    }

    // Load compromissos from agenda
    const { data: compromissosData } = await supabase
      .from('compromissos')
      .select('*')
      .eq('company_id', companyId)
      .gte('data_hora_inicio', start.toISOString())
      .lte('data_hora_inicio', end.toISOString())
      .order('data_hora_inicio', { ascending: true });

    if (compromissosData) {
      setCompromissos(compromissosData);
    }

    setLoading(false);
  };

  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter(t => t.due_date && isSameDay(parseISO(t.due_date), selectedDate));
  }, [tasks, selectedDate]);

  const compromissosForSelectedDate = useMemo(() => {
    return compromissos.filter(c => isSameDay(parseISO(c.data_hora_inicio), selectedDate));
  }, [compromissos, selectedDate]);

  // Get dates that have events
  const datesWithEvents = useMemo(() => {
    const dates = new Set<string>();
    
    tasks.forEach(t => {
      if (t.due_date) {
        dates.add(format(parseISO(t.due_date), 'yyyy-MM-dd'));
      }
    });
    
    compromissos.forEach(c => {
      dates.add(format(parseISO(c.data_hora_inicio), 'yyyy-MM-dd'));
    });
    
    return dates;
  }, [tasks, compromissos]);

  const priorityColors: Record<string, string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    urgent: "bg-red-500",
  };

  const statusColors: Record<string, string> = {
    backlog: "text-slate-500",
    todo: "text-blue-500",
    in_progress: "text-yellow-500",
    review: "text-purple-500",
    done: "text-green-500",
  };

  const goToAgenda = () => {
    navigate('/agenda');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
      {/* Calendar */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Calendário
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            locale={ptBR}
            className="rounded-md"
            modifiers={{
              hasEvents: (date) => datesWithEvents.has(format(date, 'yyyy-MM-dd')),
            }}
            modifiersStyles={{
              hasEvents: {
                fontWeight: 'bold',
                textDecoration: 'underline',
                textDecorationColor: 'hsl(var(--primary))',
              }
            }}
          />
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span>Tarefas</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Compromissos</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Events for Selected Date */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              {isToday(selectedDate) && (
                <Badge variant="secondary" className="ml-2">Hoje</Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={goToAgenda}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Agenda
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-420px)]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tasks Section */}
                {tasksForSelectedDate.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Tarefas ({tasksForSelectedDate.length})
                    </h3>
                    <div className="space-y-2">
                      {tasksForSelectedDate.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                        >
                          <div className={cn("mt-1", statusColors[task.status])}>
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-5 w-5" />
                            ) : (
                              <Circle className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className={cn(
                                "font-medium text-sm",
                                task.status === 'done' && "line-through text-muted-foreground"
                              )}>
                                {task.title}
                              </h4>
                              <div className={cn("w-2 h-2 rounded-full", priorityColors[task.priority])} />
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            {task.assignee_name && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {task.assignee_name}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compromissos Section */}
                {compromissosForSelectedDate.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Compromissos ({compromissosForSelectedDate.length})
                    </h3>
                    <div className="space-y-2">
                      {compromissosForSelectedDate.map((comp) => (
                        <div
                          key={comp.id}
                          className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={goToAgenda}
                        >
                          <div className="flex flex-col items-center bg-primary/10 rounded-lg p-2 min-w-[60px]">
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(comp.data_hora_inicio), 'HH:mm')}
                            </span>
                            <span className="text-xs text-muted-foreground">-</span>
                            <span className="text-xs text-muted-foreground">
                              {format(parseISO(comp.data_hora_fim), 'HH:mm')}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">
                              {comp.titulo || comp.tipo_servico}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {comp.tipo_servico}
                            </p>
                            {comp.paciente && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                <User className="h-3 w-3" />
                                {comp.paciente}
                              </div>
                            )}
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "mt-2 text-xs",
                                comp.status === 'concluido' && "bg-green-500/20 text-green-700",
                                comp.status === 'cancelado' && "bg-red-500/20 text-red-700",
                                comp.status === 'agendado' && "bg-blue-500/20 text-blue-700"
                              )}
                            >
                              {comp.status || 'agendado'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {tasksForSelectedDate.length === 0 && compromissosForSelectedDate.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">Nenhum evento para esta data</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Crie tarefas ou compromissos para visualizá-los aqui
                    </p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
