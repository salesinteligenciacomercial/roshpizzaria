import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Tarefa {
  id: string;
  title: string;
  description?: string | null;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  assignee_id?: string | null;
  assignee_name?: string;
  responsaveis?: string[];
  responsaveis_names?: string[];
  due_date?: string | null;
  lead_id?: string | null;
  column_id?: string | null;
  board_id?: string | null;
  tags?: string[];
  checklist?: { id?: string; text: string; done: boolean }[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  attachments?: { name: string; url: string; type?: string }[];
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
      .select(`
        *,
        assignee:assignee_id(id, full_name),
        lead:lead_id(id, name),
        owner:owner_id(id, full_name)
      `)
      .order('created_at', { ascending: false });
    
    // Buscar nomes dos responsáveis múltiplos
    const tasksWithNames = await Promise.all((data || []).map(async (task: any) => {
      let responsaveis_names: string[] = [];
      
      if (task.responsaveis && task.responsaveis.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', task.responsaveis);
        
        if (profiles) {
          // Mapear mantendo a ordem dos IDs
          responsaveis_names = task.responsaveis
            .map((id: string) => {
              const profile = profiles.find(p => p.id === id);
              return profile?.full_name || 'Usuário';
            })
            .filter((name: string) => name !== 'Usuário'); // Remove usuários não encontrados
        }
      }
      
      return {
        ...task,
        assignee_name: task.assignee?.full_name,
        lead_name: task.lead?.name,
        owner_name: task.owner?.full_name,
        responsaveis_names
      };
    }));
    
    setTarefas(tasksWithNames as any);
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


