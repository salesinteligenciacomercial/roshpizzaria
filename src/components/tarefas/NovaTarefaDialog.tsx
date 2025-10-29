import { useState, useEffect } from "react";
// Plus já importado abaixo junto com Trash2
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { upsertCompromissoParaTarefa } from "@/services/tarefaService";

interface NovaTarefaDialogProps {
  columnId: string;
  boardId: string;
  onTaskCreated: () => void;
}

export function NovaTarefaDialog({
  columnId,
  boardId,
  onTaskCreated,
}: NovaTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<{ id?: string; text: string; done: boolean }[]>([]);
  const [newItem, setNewItem] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    const { data: usersData } = await supabase.from("profiles").select("id, full_name");
    const { data: leadsData } = await supabase.from("leads").select("id, name");
    setUsers(usersData || []);
    setLeads(leadsData || []);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Digite um título para a tarefa");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Não autenticado");
        return;
      }

      // Converter data (YYYY-MM-DD) para ISO esperado pelo backend
      const dueDateIso = dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null;

      const { data, error } = await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "criar_tarefa",
          data: {
            title,
            description,
            priority,
            due_date: dueDateIso,
            assignee_id: assigneeId || null,
            lead_id: leadId || null,
            column_id: columnId,
            board_id: boardId,
            checklist,
            tags,
            responsaveis,
          },
        },
      });

      if (error) {
        console.error("Erro ao criar tarefa (edge):", error);
        toast.error(error.message || "Erro ao criar tarefa");
        return;
      }

      toast.success("Tarefa criada com sucesso!");
      try {
        const createdId = (data as any)?.data?.id;
        if (createdId && dueDateIso) {
          await upsertCompromissoParaTarefa({ id: createdId, title, due_date: dueDateIso, assignee_id: assigneeId || null });
        }
      } catch {}
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("media");
      setDueDate("");
      setAssigneeId("");
      setLeadId("");
      setChecklist([]);
      setResponsaveis([]);
      setTags([]);
      onTaskCreated();
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    }
  };

  const addChecklistItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setChecklist((prev) => [...prev, { id: crypto.randomUUID?.() || `${Date.now()}`, text, done: false }]);
    setNewItem("");
  };

  const toggleChecklist = (id: string, checked: boolean) => {
    setChecklist((prev) => prev.map((i) => (i.id === id ? { ...i, done: !!checked } : i)));
  };

  const removeChecklistItem = (id: string) => {
    setChecklist((prev) => prev.filter((i) => i.id !== id));
  };

  const doneCount = checklist.filter((i) => i.done).length;
  const totalCount = checklist.length || 1;

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (tags.includes(value)) return;
    setTags([...tags, value]);
    setTagInput("");
  };

  const removeTag = (value: string) => setTags(tags.filter((t) => t !== value));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título da tarefa"
            />
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a tarefa..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Prazo</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Responsáveis (múltiplos)</Label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-auto p-2 border rounded-md">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={responsaveis.includes(u.id)}
                    onChange={(e) => {
                      setResponsaveis((prev) => e.target.checked ? [...prev, u.id] : prev.filter(id => id !== u.id));
                    }}
                  />
                  {u.full_name}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Checklist</Label>
            {checklist.length > 0 && (
              <div className="mb-2">
                <Progress value={(doneCount / totalCount) * 100} />
                <p className="text-xs text-muted-foreground mt-1">{doneCount}/{checklist.length} concluído(s)</p>
              </div>
            )}
            <div className="flex gap-2">
              <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Adicionar item..." />
              <Button type="button" variant="outline" onClick={addChecklistItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-56 overflow-auto">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2 p-2 rounded border">
                  <Checkbox checked={item.done} onCheckedChange={(v: any) => toggleChecklist(item.id!, !!v)} />
                  <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => removeChecklistItem(item.id!)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Adicionar tag..." />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {tag}
                  <button className="ml-1 text-muted-foreground" onClick={() => removeTag(tag)}>×</button>
                </span>
              ))}
              {tags.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag adicionada.</p>}
            </div>
          </div>

          <div>
            <Label>Responsável</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Lead Relacionado</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Criar Tarefa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
