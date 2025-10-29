import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Tarefa {
  id: string;
  title: string;
  description?: string | null;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  assignee_id?: string | null;
  due_date?: string | null;
  lead_id?: string | null;
  column_id?: string | null;
  board_id?: string | null;
  tags?: string[];
  checklist?: { id?: string; text: string; done: boolean }[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  attachments?: { name: string; url: string }[];
  responsaveis?: string[];
}

interface TarefasContextValue {
  tarefas: Tarefa[];
  recarregar: () => Promise<void>;
}

const Ctx = createContext<TarefasContextValue>({ tarefas: [], recarregar: async () => {} });

export function TarefasProvider({ children }: { children: React.ReactNode }) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);

  const recarregar = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    setTarefas((data as any) || []);
  }, []);

  useEffect(() => {
    recarregar();
    const ch = supabase
      .channel('tasks_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => recarregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [recarregar]);

  return (
    <Ctx.Provider value={{ tarefas, recarregar }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTarefas() {
  return useContext(Ctx);
}


