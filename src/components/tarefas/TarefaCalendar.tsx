import { useMemo, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTarefas } from '@/context/TarefasContext';
import { format, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TarefaCalendar() {
  const { tarefas } = useTarefas();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const doDia = useMemo(() => {
    return tarefas.filter(t => t.due_date && isSameDay(parseISO(t.due_date), selectedDate));
  }, [tarefas, selectedDate]);

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
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px]">
            <div className="space-y-2">
              {doDia.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhuma tarefa com vencimento nesta data.</p>
              ) : (
                doDia.map(t => (
                  <div key={t.id} className="p-3 border rounded-md">
                    <div className="font-medium">{t.title}</div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{t.description}</div>
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


