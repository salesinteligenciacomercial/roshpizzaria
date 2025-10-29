import { useEffect, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Calendar as CalendarIcon, Trash2, ExternalLink, MessageSquare, Plus, GripVertical, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EditarTarefaDialog } from "./EditarTarefaDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { enviarLembreteWhatsApp } from "@/services/whatsappService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  assignee_name?: string;
  due_date: string | null;
  lead_id: string | null;
  lead_name?: string;
  checklist?: { id?: string; text: string; done: boolean }[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  responsaveis?: string[];
}

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export function TaskCard({ task, onDelete, onUpdate }: TaskCardProps) {
  const navigate = useNavigate();
  const [localChecklist, setLocalChecklist] = useState(task.checklist || []);
  const [newItem, setNewItem] = useState("");
  useEffect(() => {
    setLocalChecklist(task.checklist || []);
  }, [task.checklist, task.id]);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      baixa: "bg-gray-500",
      media: "bg-yellow-500",
      alta: "bg-orange-500",
      urgente: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  const toggleChecklist = async (itemId: string, checked: boolean) => {
    const updated = (localChecklist || []).map((i) => (i.id === itemId ? { ...i, done: checked } : i));
    setLocalChecklist(updated);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('tasks')
        .update({ checklist: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
    } catch (e) {
      // Fallback: gravar metadados no final da descrição
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const desc = (task.description || '').replace(/<!--meta:.*-->\s*$/s, '').trimEnd();
        const meta = { checklist: updated, tags: (task as any).tags || [], comments: (task as any).comments || [] };
        const newDesc = `${desc}\n\n<!--meta:${JSON.stringify(meta)}-->`;
        const { error: err2 } = await supabase.from('tasks').update({ description: newDesc }).eq('id', task.id);
        if (err2) throw err2;
        onUpdate();
      } catch (err3) {
        setLocalChecklist(task.checklist || []);
        console.error('Erro fallback checklist -> description:', err3);
      }
    }
  };

  const addChecklistItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    const updated = [...(localChecklist || []), { id: crypto.randomUUID?.() || `${Date.now()}`, text, done: false }];
    setLocalChecklist(updated);
    setNewItem("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('tasks')
        .update({ checklist: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
    } catch (e) {
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const desc = (task.description || '').replace(/<!--meta:.*-->\s*$/s, '').trimEnd();
        const meta = { checklist: updated, tags: (task as any).tags || [], comments: (task as any).comments || [] };
        const newDesc = `${desc}\n\n<!--meta:${JSON.stringify(meta)}-->`;
        const { error: err2 } = await supabase.from('tasks').update({ description: newDesc }).eq('id', task.id);
        if (err2) throw err2;
        onUpdate();
      } catch (err3) {
        console.error("Erro ao adicionar item (fallback):", err3);
        setLocalChecklist(task.checklist || []);
      }
    }
  };

  const sendReminderNow = async () => {
    try {
      const ids = (task as any).responsaveis?.length ? (task as any).responsaveis as string[] : (task.assignee_id ? [task.assignee_id] : []);
      if (!ids.length) {
        toast.error("Defina um responsável para a tarefa antes de enviar o lembrete.");
        return;
      }
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: perfis, error } = await supabase.from('profiles').select('id, phone, full_name').in('id', ids);
      if (error) throw error;
      const telefones = (perfis || []).map((p: any) => p.phone).filter(Boolean);
      if (!telefones.length) {
        toast.error("Nenhum telefone encontrado nos perfis dos responsáveis.");
        return;
      }
      const quando = task.due_date ? new Date(task.due_date).toLocaleString('pt-BR') : 'breve';
      const mensagem = `📅 Lembrete: a tarefa "${task.title}" vence em ${quando}.`;
      for (const numero of telefones) {
        // Ignora erros individuais e continua
        try { await enviarLembreteWhatsApp(numero, mensagem); } catch {}
      }
      toast.success("Lembrete enviado!");
    } catch (e: any) {
      console.error("Erro ao enviar lembrete:", e);
      toast.error(e?.message || "Erro ao enviar lembrete");
    }
  };

  const cleanDescription = (task.description || '').replace(/<!--meta:.*-->\s*$/s, '').trim();

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="group relative mb-3 border-0 shadow-card hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-muted-foreground/70">
              <GripVertical className="h-3 w-3 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} />
            </span>
            <div className={`h-1 w-1 rounded-full ${getPriorityColor(task.priority)} animate-pulse`} />
            <CardTitle className="text-base font-semibold text-foreground">{task.title}</CardTitle>
          </div>
          <Badge className={`${getPriorityColor(task.priority)} border-0 text-white shadow-sm`}>
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="relative space-y-3">
        {cleanDescription && (
          <p className="text-sm text-muted-foreground line-clamp-1 bg-muted/30 px-3 py-2 rounded-md">
            {cleanDescription}
          </p>
        )}
        
        <div className="flex items-center gap-4 text-xs">
          {task.assignee_name && (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <User className="h-3 w-3" />
              <span className="font-medium">{task.assignee_name}</span>
            </div>
          )}
          {Array.isArray((task as any).responsaveis) && (task as any).responsaveis.length > 0 && (
            <div className="text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              +{(task as any).responsaveis.length - (task.assignee_id ? 1 : 0)} resp.
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <CalendarIcon className="h-3 w-3" />
              <span className="font-medium">{new Date(task.due_date).toLocaleDateString("pt-BR")}</span>
            </div>
          )}
          {Array.isArray(task.comments) && task.comments.length > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <MessageSquare className="h-3 w-3" />
              <span className="font-medium">{task.comments.length}</span>
            </div>
          )}
        </div>
        
        {Array.isArray(localChecklist) && localChecklist.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {localChecklist.filter(i => i.done).length}/{localChecklist.length} checklist
          </div>
        )}

        {Array.isArray((task as any).tags) && (task as any).tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {(task as any).tags.slice(0, 4).map((tag: string) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {tag}
              </span>
            ))}
            {(task as any).tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{(task as any).tags.length - 4}</span>
            )}
          </div>
        )}

        {Array.isArray(task.comments) && task.comments.length > 0 && (
          <div className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded">
            {task.comments[task.comments.length - 1]?.text?.slice(0, 80)}
          </div>
        )}

        <div className="mt-1 space-y-1">
          {(localChecklist || []).slice(0, 3).map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/40 cursor-pointer">
              <Checkbox checked={!!item.done} onCheckedChange={(v: any) => toggleChecklist(item.id!, !!v)} />
              <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.text}</span>
            </label>
          ))}
          {Array.isArray(localChecklist) && localChecklist.length > 3 && (
            <div className="text-[10px] text-muted-foreground">+ {localChecklist.length - 3} itens</div>
          )}
          <div className="flex items-center gap-1 pt-1">
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Adicionar item..." className="h-7 text-xs" />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addChecklistItem}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {task.lead_name && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <Badge variant="outline" className="text-xs border-primary/20 text-primary">
              Lead: {task.lead_name}
            </Badge>
            {task.lead_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/leads`)}
                className="h-6 w-6 p-0 hover:bg-primary/10 text-primary transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        
        <div className="flex justify-end gap-1 pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); sendReminderNow(); }}
            title="Enviar lembrete via WhatsApp"
          >
            <Bell className="h-3 w-3" />
          </Button>
          <EditarTarefaDialog task={task} onTaskUpdated={onUpdate} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja deletar a tarefa "{task.title}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(task.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Deletar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
