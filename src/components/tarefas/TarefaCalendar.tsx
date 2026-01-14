import { useMemo, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  due_date?: string | null;
  start_date?: string | null;
  assignee_name?: string;
  responsaveis_names?: string[];
  lead_name?: string;
  tags?: string[];
}

interface TarefaCalendarProps {
  tasks?: Task[];
}

const priorityColors: Record<string, string> = {
  baixa: 'bg-green-100 text-green-800',
  media: 'bg-yellow-100 text-yellow-800',
  alta: 'bg-orange-100 text-orange-800',
  urgente: 'bg-red-100 text-red-800',
};

const priorityLabels: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente',
};

export function TarefaCalendar({ tasks = [] }: TarefaCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Tarefas do dia selecionado (filtrar por due_date OU start_date)
  const doDia = useMemo(() => {
    return tasks.filter(t => {
      // Verificar due_date
      if (t.due_date) {
        try {
          if (isSameDay(parseISO(t.due_date), selectedDate)) return true;
        } catch (e) {}
      }
      // Verificar start_date
      if (t.start_date) {
        try {
          if (isSameDay(parseISO(t.start_date), selectedDate)) return true;
        } catch (e) {}
      }
      return false;
    });
  }, [tasks, selectedDate]);

  // Dias que têm tarefas (para destacar no calendário)
  const diasComTarefas = useMemo(() => {
    const dias = new Set<string>();
    tasks.forEach(t => {
      if (t.due_date) {
        try {
          dias.add(format(parseISO(t.due_date), 'yyyy-MM-dd'));
        } catch (e) {}
      }
      if (t.start_date) {
        try {
          dias.add(format(parseISO(t.start_date), 'yyyy-MM-dd'));
        } catch (e) {}
      }
    });
    return dias;
  }, [tasks]);

  // Modificador para destacar dias com tarefas
  const modifiers = useMemo(() => ({
    hasTasks: (date: Date) => diasComTarefas.has(format(date, 'yyyy-MM-dd'))
  }), [diasComTarefas]);

  const modifiersStyles = {
    hasTasks: {
      backgroundColor: 'hsl(var(--primary) / 0.2)',
      borderRadius: '50%',
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(d) => d && setSelectedDate(d)}
            locale={ptBR}
            className="rounded-md border"
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-4 h-4 rounded-full bg-primary/20"></div>
            <span>Dias com tarefas</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
            {doDia.length > 0 && (
              <Badge variant="secondary">{doDia.length} tarefa{doDia.length > 1 ? 's' : ''}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-3">
              {doDia.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground text-sm">Nenhuma tarefa nesta data.</p>
                  <p className="text-xs text-muted-foreground mt-1">Selecione outra data ou crie uma tarefa.</p>
                </div>
              ) : (
                doDia.map(t => (
                  <div key={t.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium flex-1">{t.title}</div>
                      <Badge className={priorityColors[t.priority] || 'bg-gray-100 text-gray-800'}>
                        {priorityLabels[t.priority] || t.priority}
                      </Badge>
                    </div>
                    
                    {t.description && (
                      <div className="text-sm text-muted-foreground line-clamp-2 mt-2">{t.description}</div>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
                      {t.assignee_name && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          {t.assignee_name}
                        </span>
                      )}
                      
                      {t.responsaveis_names && t.responsaveis_names.length > 0 && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                          {t.responsaveis_names.join(', ')}
                        </span>
                      )}
                      
                      {t.lead_name && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                          {t.lead_name}
                        </span>
                      )}
                      
                      {t.due_date && (
                        <span className="flex items-center gap-1">
                          📅 Prazo: {format(parseISO(t.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    
                    {t.tags && t.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {t.tags.map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

