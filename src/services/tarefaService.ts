import { supabase } from "@/integrations/supabase/client";

export interface TarefaPayload {
  title: string;
  description?: string;
  priority?: 'baixa' | 'media' | 'alta' | 'urgente';
  due_date?: string | null; // ISO
  assignee_id?: string | null;
  responsaveis?: string[];
  lead_id?: string | null;
  column_id?: string | null;
  board_id?: string | null;
  tags?: string[];
  checklist?: { id?: string; text: string; done: boolean }[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  attachments?: { name: string; url: string }[];
}

export async function criarTarefa(data: TarefaPayload) {
  return await supabase.functions.invoke("api-tarefas", {
    body: { action: "criar_tarefa", data },
  });
}

export async function editarTarefa(task_id: string, data: Partial<TarefaPayload>) {
  return await supabase.functions.invoke("api-tarefas", {
    body: { action: "editar_tarefa", data: { task_id, ...data } },
  });
}

export async function moverTarefa(task_id: string, nova_coluna_id: string) {
  return await supabase.functions.invoke("api-tarefas", {
    body: { action: "mover_tarefa", data: { task_id, nova_coluna_id } },
  });
}

// Upsert em compromissos quando houver due_date
export async function upsertCompromissoParaTarefa(task: { id: string; title: string; due_date: string | null; assignee_id?: string | null; }) {
  if (!task.due_date) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const inicio = new Date(task.due_date);
  const fim = new Date(inicio.getTime() + 60 * 60 * 1000);
  await supabase.from('compromissos').upsert({
    referencia_id: task.id,
    tipo_servico: 'tarefa',
    usuario_responsavel_id: task.assignee_id || user.id,
    owner_id: user.id,
    data_hora_inicio: inicio.toISOString(),
    data_hora_fim: fim.toISOString(),
    status: 'agendado',
    observacoes: `Gerado automaticamente da tarefa ${task.title}`,
  }, { onConflict: 'referencia_id' as any });
}


