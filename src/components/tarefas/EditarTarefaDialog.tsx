import { useState, useEffect } from "react";
import { Pencil, Paperclip, Download, X, ExternalLink, Check } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Trash2, Plus } from "lucide-react";
import { upsertCompromissoParaTarefa } from "@/services/tarefaService";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  due_date: string | null;
  lead_id: string | null;
  checklist?: { id?: string; text: string; done: boolean }[];
  tags?: string[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  responsaveis?: string[];
  attachments?: { name: string; url: string }[];
}

interface EditarTarefaDialogProps {
  task: Task;
  onTaskUpdated: () => void;
}

export function EditarTarefaDialog({ task, onTaskUpdated }: EditarTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  
  // ✅ CORRIGIDO: Normalizar prioridade para valores válidos
  const normalizePriority = (priority: string): string => {
    const validPriorities = ['baixa', 'media', 'alta', 'urgente'];
    if (validPriorities.includes(priority)) return priority;
    // Mapear valores antigos para novos
    if (priority === 'normal' || priority === 'média') return 'media';
    if (priority === 'low') return 'baixa';
    if (priority === 'high') return 'alta';
    if (priority === 'critical' || priority === 'urgent') return 'urgente';
    return 'media'; // Padrão
  };
  
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(normalizePriority(task.priority));
  const [dueDate, setDueDate] = useState(
    task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : ""
  );
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "none");
  const [leadId, setLeadId] = useState(task.lead_id || "none");
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<{ id?: string; text: string; done: boolean }[]>(task.checklist || []);
  const [newItem, setNewItem] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [comments, setComments] = useState<{ id?: string; text: string; author_id?: string; created_at?: string }[]>(task.comments || []);
  const [newComment, setNewComment] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>(task.responsaveis || []);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>(task.attachments || []);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  useEffect(() => {
    if (open) {
      loadData();
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(normalizePriority(task.priority));
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");
      setAssigneeId(task.assignee_id || "none");
      setLeadId(task.lead_id || "none");
      setChecklist(task.checklist || []);
      setTags(task.tags || []);
      setComments(task.comments || []);
      setResponsaveis(task.responsaveis || []);
      setAttachments(task.attachments || []);
      setEditingItemId(null);
      setEditingText("");
    }
  }, [open, task]);

  const loadData = async () => {
    const { data: usersData } = await supabase.from("profiles").select("id, full_name");
    const { data: leadsData } = await supabase.from("leads").select("id, name");
    setUsers(usersData || []);
    setLeads(leadsData || []);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validar título
    if (!title.trim()) {
      newErrors.title = "Título é obrigatório";
    } else if (title.trim().length < 3) {
      newErrors.title = "Título deve ter no mínimo 3 caracteres";
    } else if (title.length > 100) {
      newErrors.title = "Título deve ter no máximo 100 caracteres";
    }

    // Validar descrição
    if (description.length > 500) {
      newErrors.description = "Descrição deve ter no máximo 500 caracteres";
    }

    // Validar data
    if (dueDate) {
      const selectedDate = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.dueDate = "A data não pode ser no passado";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    try {
      const dueDateIso = dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null;

      const { error } = await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "editar_tarefa",
          data: {
            task_id: task.id,
            title: title.trim(),
            description: description.trim(),
            priority,
            due_date: dueDateIso,
            assignee_id: assigneeId === 'none' ? null : assigneeId,
            lead_id: leadId === 'none' ? null : leadId,
            checklist,
            tags,
            comments,
            responsaveis,
            attachments,
          },
        },
      });

      if (error) {
        console.error("Erro ao atualizar tarefa (edge):", error);
        toast.error(error.message || "Erro ao atualizar tarefa");
        return;
      }

      toast.success("Tarefa atualizada com sucesso!");
      setOpen(false);
      setErrors({});
      try {
        if (dueDateIso) {
          await upsertCompromissoParaTarefa({ id: task.id, title: title.trim(), due_date: dueDateIso, assignee_id: assigneeId === 'none' ? null : assigneeId });
        }
      } catch {}
      onTaskUpdated();
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
      toast.error("Erro ao atualizar tarefa");
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

  const startEditingItem = (itemId: string, currentText: string) => {
    setEditingItemId(itemId);
    setEditingText(currentText);
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingText("");
  };

  const saveEditedItem = () => {
    const text = editingText.trim();
    if (!text) {
      toast.error("O texto não pode estar vazio");
      return;
    }
    setChecklist((prev) => prev.map((i) => (i.id === editingItemId ? { ...i, text } : i)));
    setEditingItemId(null);
    setEditingText("");
    toast.success("Item do checklist atualizado");
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

  const addComment = async () => {
    const text = newComment.trim();
    if (!text) return;
    const { data: { user } } = await supabase.auth.getUser();
    setComments((prev) => [
      ...prev,
      { id: crypto.randomUUID?.() || `${Date.now()}`, text, author_id: user?.id, created_at: new Date().toISOString() },
    ]);
    setNewComment("");
  };

  const addAttachment = () => {
    const url = attachmentUrl.trim();
    const name = attachmentName.trim() || url;
    if (!url) {
      toast.error("Digite uma URL válida");
      return;
    }
    try {
      new URL(url);
      setAttachments((prev) => [...prev, { name, url }]);
      setAttachmentUrl("");
      setAttachmentName("");
      toast.success("Anexo adicionado");
    } catch {
      toast.error("URL inválida");
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="geral" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="comentarios">Comentários</TabsTrigger>
            <TabsTrigger value="anexos">
              Anexos {attachments.length > 0 && `(${attachments.length})`}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[calc(85vh-180px)] pr-4">
            <TabsContent value="geral" className="space-y-4 mt-4">
          <div>
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors({ ...errors, title: "" });
              }}
              placeholder="Digite o título da tarefa"
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-xs text-destructive mt-1">{errors.title}</p>
            )}
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
                      setResponsaveis((prev) => (e.target as HTMLInputElement).checked ? [...prev, u.id] : prev.filter(id => id !== u.id));
                    }}
                  />
                  {u.full_name}
                </label>
              ))}
            </div>
          </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors({ ...errors, description: "" });
                  }}
                  placeholder="Descreva a tarefa..."
                  rows={2}
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && (
                  <p className="text-xs text-destructive mt-1">{errors.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {description.length}/500 caracteres
                </p>
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
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      if (errors.dueDate) setErrors({ ...errors, dueDate: "" });
                    }}
                    className={errors.dueDate ? "border-destructive" : ""}
                  />
                  {errors.dueDate && (
                    <p className="text-xs text-destructive mt-1">{errors.dueDate}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Adicionar tag..." />
                  <Button type="button" variant="outline" size="icon" onClick={addTag}>
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
                <Label>Responsável Principal</Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Responsáveis Adicionais</Label>
                <div className="grid grid-cols-2 gap-2 max-h-24 overflow-auto p-2 border rounded-md">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={responsaveis.includes(u.id)}
                        onChange={(e) => {
                          setResponsaveis((prev) => (e.target as HTMLInputElement).checked ? [...prev, u.id] : prev.filter(id => id !== u.id));
                        }}
                      />
                      {u.full_name}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Lead Relacionado</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {leads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4 mt-4">
              {checklist.length > 0 && (
                <div className="mb-2">
                  <Progress value={(doneCount / totalCount) * 100} />
                  <p className="text-xs text-muted-foreground mt-1">{doneCount}/{checklist.length} concluído(s)</p>
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Adicionar item..."
                  onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                />
                <Button type="button" variant="outline" size="icon" onClick={addChecklistItem}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded border group">
                    <Checkbox checked={item.done} onCheckedChange={(v: any) => toggleChecklist(item.id!, !!v)} />
                    {editingItemId === item.id ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              saveEditedItem();
                            } else if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          className="h-8 text-sm flex-1"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                          onClick={saveEditedItem}
                          title="Salvar"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={cancelEditing}
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>{item.text}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                            onClick={() => startEditingItem(item.id!, item.text)}
                            title="Editar item"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => removeChecklistItem(item.id!)}
                            title="Excluir item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {checklist.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">Nenhum item adicionado.</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="comentarios" className="space-y-4 mt-4">
              <div className="flex gap-2">
                <Input 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)} 
                  placeholder="Escrever comentário..."
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && addComment()}
                />
                <Button type="button" variant="outline" onClick={addComment}>Adicionar</Button>
              </div>
              <div className="space-y-2">
                {comments.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Sem comentários.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="p-3 border rounded text-sm bg-muted/20">
                    <div className="text-xs text-muted-foreground mb-1">
                      {c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : ''}
                    </div>
                    <div>{c.text}</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="anexos" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Nome do Arquivo</Label>
                <Input 
                  value={attachmentName} 
                  onChange={(e) => setAttachmentName(e.target.value)} 
                  placeholder="Ex: Documento.pdf"
                />
              </div>
              <div className="space-y-2">
                <Label>URL do Arquivo</Label>
                <div className="flex gap-2">
                  <Input 
                    value={attachmentUrl} 
                    onChange={(e) => setAttachmentUrl(e.target.value)} 
                    placeholder="https://exemplo.com/arquivo.pdf"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addAttachment}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {attachments.length === 0 && (
                  <div className="text-center py-8">
                    <Paperclip className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum anexo adicionado</p>
                  </div>
                )}
                {attachments.map((att, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 border rounded bg-muted/20">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{att.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{att.url}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(att.url, '_blank')}
                      title="Abrir arquivo"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = att.url;
                        a.download = att.name;
                        a.click();
                      }}
                      title="Baixar arquivo"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeAttachment(att.url)}
                      title="Remover anexo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>

          <div className="pt-4 border-t">
            <Button onClick={handleSubmit} className="w-full">
              Salvar Alterações
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
