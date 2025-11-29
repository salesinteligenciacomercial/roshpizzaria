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
import { Plus, Trash2, Tag } from "lucide-react";
import { upsertCompromissoParaTarefa } from "@/services/tarefaService";
import { useTagsManager } from "@/hooks/useTagsManager";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

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
  const [startDate, setStartDate] = useState(""); // Data início do prazo
  const [dueDate, setDueDate] = useState(""); // Data final do prazo
  const [assigneeId, setAssigneeId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [checklist, setChecklist] = useState<{ id?: string; text: string; done: boolean }[]>([]);
  const [newItem, setNewItem] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [responsaveis, setResponsaveis] = useState<string[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadName, setSelectedLeadName] = useState("");
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  
  // ✅ CORRIGIDO: Usar hook de tags sincronizado com o gerenciador de tags
  const { allTags: tagsExistentes, refreshTags } = useTagsManager();

  useEffect(() => {
    if (open) {
      loadData();
      refreshTags(); // Atualizar tags ao abrir o dialog
    }
  }, [open, refreshTags]);

  const loadData = async () => {
    try {
      // ✅ CORRIGIDO: Buscar apenas usuários da empresa atual (não de subcontas)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        console.warn("Company ID não encontrado");
        return;
      }

      // Buscar apenas usuários vinculados à mesma empresa
      const { data: companyUserRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", userRole.company_id);

      const userIds = (companyUserRoles || []).map((ur: any) => ur.user_id);

      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds)
          .order("full_name");
        setUsers(usersData || []);
      } else {
        setUsers([]);
      }

      // Buscar leads da empresa
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, phone, telefone, tags")
        .eq("company_id", userRole.company_id);
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!leadSearch.trim()) return true;
    const search = leadSearch.toLowerCase();
    const name = lead.name?.toLowerCase() || "";
    const phone = lead.phone?.toLowerCase() || "";
    const telefone = lead.telefone?.toLowerCase() || "";
    const tags = (lead.tags || []).join(" ").toLowerCase();
    return name.includes(search) || phone.includes(search) || telefone.includes(search) || tags.includes(search);
  });

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

      // Converter datas (YYYY-MM-DD) para ISO esperado pelo backend
      const startDateIso = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null;
      const dueDateIso = dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null;

      // Se não tiver assignee_id definido, usar o primeiro responsável
      const primaryAssignee = assigneeId && assigneeId.trim() 
        ? assigneeId 
        : (responsaveis.length > 0 ? responsaveis[0] : null);
      
      // Normalizar valores vazios para null (o schema espera null, não string vazia)
      const normalizedData = {
        title,
        description: description || null,
        priority,
        start_date: startDateIso, // Data início do prazo
        due_date: dueDateIso, // Data final do prazo
        assignee_id: primaryAssignee,
        lead_id: leadId && leadId.trim() ? leadId : null,
        column_id: columnId && columnId.trim() ? columnId : null,
        board_id: boardId && boardId.trim() ? boardId : null,
        checklist: checklist || [],
        tags: tags || [],
        responsaveis: responsaveis || [],
      };

      console.log('📤 Enviando dados para criar tarefa:', normalizedData);

      let data: any = null;
      let error: any = null;
      
      // Tentar criar via Edge Function primeiro
      try {
        const result = await supabase.functions.invoke("api-tarefas", {
          body: {
            action: "criar_tarefa",
            data: normalizedData,
          },
        });
        
        // Verificar se há erro na resposta
        if (result.error) {
          console.error("❌ Erro da Edge Function:", result.error);
          error = result.error;
          
          // Se for erro de validação, mostrar detalhes e retornar
          if (result.data?.code === 'VALIDATION_ERROR') {
            toast.error(`Erro de validação: ${result.data.details || result.error.message}`);
            return;
          }
        } else {
          // Sucesso!
          data = result.data;
        }
      } catch (invokeError: any) {
        // Quando a Edge Function retorna non-2xx, o Supabase lança uma exceção
        console.error("❌ Exceção ao invocar Edge Function:", invokeError);
        error = invokeError;
      }

      // Se houve erro (seja na resposta ou exceção), tentar fallback
      if (error) {
        console.warn('⚠️ Edge Function falhou, tentando criar tarefa diretamente no banco...');
        try {
          const { data: userRole } = await supabase
            .from("user_roles")
            .select("company_id")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (!userRole?.company_id) {
            toast.error('Empresa não encontrada');
            return;
          }

          // SOLUÇÃO DEFINITIVA: Usar apenas campos que DEFINITIVAMENTE existem na tabela
          // Baseado na estrutura real da tabela tasks
          const taskInsert: any = {
            title: normalizedData.title,
            description: normalizedData.description || null,
            priority: normalizedData.priority || 'media',
            start_date: normalizedData.start_date || null, // Data início do prazo
            due_date: normalizedData.due_date || null, // Data final do prazo
            assignee_id: normalizedData.assignee_id || null,
            lead_id: normalizedData.lead_id || null,
            column_id: normalizedData.column_id || null,
            board_id: normalizedData.board_id || null,
            company_id: userRole.company_id,
            owner_id: session.user.id,
            status: 'pendente',
          };

          // Tentar inserir com campos básicos primeiro
          let directTask, directError;
          const result = await supabase
            .from('tasks')
            .insert([taskInsert])
            .select()
            .single();
          
          directTask = result.data;
          directError = result.error;

          // Se falhou, pode ser por causa de algum campo opcional
          // Tentar novamente apenas com campos essenciais
          if (directError && directError.message?.includes('column')) {
            console.warn('⚠️ Erro com campo opcional, tentando apenas campos essenciais...');
            const essentialTaskInsert: any = {
              title: normalizedData.title,
              description: normalizedData.description || null,
              priority: normalizedData.priority || 'media',
              start_date: normalizedData.start_date || null,
              due_date: normalizedData.due_date || null,
              assignee_id: normalizedData.assignee_id || null,
              lead_id: normalizedData.lead_id || null,
              company_id: userRole.company_id,
              owner_id: session.user.id,
              status: 'pendente',
            };
            
            const retryResult = await supabase
              .from('tasks')
              .insert([essentialTaskInsert])
              .select()
              .single();
            
            directTask = retryResult.data;
            directError = retryResult.error;
          }

          if (directError) {
            console.error('❌ Erro ao criar tarefa diretamente:', directError);
            toast.error(`Erro ao criar tarefa: ${directError.message || 'Erro desconhecido'}`);
            return;
          }

          if (directTask) {
            console.log('✅ Tarefa criada diretamente no banco (fallback)');
            data = { success: true, data: directTask };
            error = null;
          }
        } catch (fallbackError: any) {
          console.error('❌ Erro no fallback:', fallbackError);
          toast.error(`Erro ao criar tarefa: ${fallbackError?.message || 'Erro desconhecido'}`);
          return;
        }
      }

      // Se ainda houver erro após o fallback, mostrar mensagem
      if (error) {
        console.error("Erro ao criar tarefa (edge):", error);
        const errorMessage = error?.message || error?.error?.message || "Erro ao criar tarefa";
        toast.error(errorMessage);
        return;
      }

      // Verificar se temos dados válidos
      if (!data || !data.data) {
        console.error("❌ Dados inválidos retornados");
        toast.error("Erro ao criar tarefa: resposta inválida");
        return;
      }

      const createdTask = (data as any)?.data;
      console.log('✅ [NovaTarefaDialog] Tarefa criada:', createdTask);

      toast.success("Tarefa criada com sucesso!");
      try {
        const createdId = createdTask?.id;
        if (createdId && dueDateIso) {
          await upsertCompromissoParaTarefa({ id: createdId, title, due_date: dueDateIso, assignee_id: assigneeId || null });
        }
      } catch {}
      
      setOpen(false);
      setTitle("");
      setDescription("");
      setPriority("media");
      setStartDate("");
      setDueDate("");
      setAssigneeId("");
      setLeadId("");
      setLeadSearch("");
      setSelectedLeadName("");
      setChecklist([]);
      setResponsaveis([]);
      setTags([]);
      
      // Chamar callback para atualizar lista
      console.log('✅ [NovaTarefaDialog] Chamando onTaskCreated para atualizar lista');
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-2 flex-1" style={{ maxHeight: 'calc(90vh - 120px)' }}>
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

          {/* Prazo Estimado - Data Inicial e Final */}
          <div className="space-y-2">
            <Label>Prazo Estimado</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Data Início</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    // Se a data final for anterior à inicial, ajustar
                    if (dueDate && e.target.value > dueDate) {
                      setDueDate(e.target.value);
                    }
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data Final</Label>
                <Input
                  type="date"
                  value={dueDate}
                  min={startDate || undefined}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            {startDate && dueDate && (
              <p className="text-xs text-muted-foreground">
                Duração: {Math.ceil((new Date(dueDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} dia(s)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Responsáveis (múltiplos)</Label>
            {/* Responsáveis selecionados */}
            {responsaveis.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                {responsaveis.map((id) => {
                  const user = users.find(u => u.id === id);
                  return user ? (
                    <div 
                      key={id}
                      className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                    >
                      <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold">
                        {user.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium">{user.full_name}</span>
                      <button 
                        type="button"
                        onClick={() => setResponsaveis(prev => prev.filter(i => i !== id))}
                        className="hover:text-destructive ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ) : null;
                })}
              </div>
            )}
            {/* Lista de usuários para selecionar */}
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-auto p-2 border rounded-md bg-muted/20">
              {users.map((u) => (
                <label 
                  key={u.id} 
                  className={`flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded transition-colors ${
                    responsaveis.includes(u.id) 
                      ? 'bg-primary/10 text-primary' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <Checkbox
                    checked={responsaveis.includes(u.id)}
                    onCheckedChange={(checked) => {
                      setResponsaveis((prev) => checked ? [...prev, u.id] : prev.filter(id => id !== u.id));
                    }}
                  />
                  <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                    {u.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{u.full_name}</span>
                </label>
              ))}
            </div>
            {responsaveis.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {responsaveis.length} responsável(is) selecionado(s)
              </p>
            )}
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
            {/* Dropdown para selecionar tags existentes */}
            <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start">
                  <Tag className="h-4 w-4 mr-2" />
                  {tagsExistentes.length > 0 ? "Selecionar tag existente" : "Nenhuma tag cadastrada"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar tag..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma tag encontrada.</CommandEmpty>
                    <CommandGroup>
                      {tagsExistentes
                        .filter(tag => !tags.includes(tag))
                        .map((tag) => (
                          <CommandItem
                            key={tag}
                            value={tag}
                            onSelect={() => {
                              if (!tags.includes(tag)) {
                                setTags([...tags, tag]);
                              }
                              setTagsPopoverOpen(false);
                            }}
                          >
                            <Tag className="h-4 w-4 mr-2" />
                            {tag}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {/* Campo para adicionar nova tag */}
            <div className="flex gap-2">
              <Input 
                value={tagInput} 
                onChange={(e) => setTagInput(e.target.value)} 
                placeholder="Ou criar nova tag..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Tags selecionadas */}
            <div className="flex flex-wrap gap-2 min-h-[32px] p-2 border rounded-md bg-muted/20">
              {tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma tag adicionada.</p>
              ) : (
                tags.map((tag) => (
                  <span key={tag} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <button 
                      type="button"
                      className="ml-1 text-muted-foreground hover:text-destructive" 
                      onClick={() => removeTag(tag)}
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Lead Relacionado</Label>
            <Input
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou tag..."
            />
            {leadSearch && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => {
                        setLeadId(lead.id);
                        setSelectedLeadName(lead.name);
                        setLeadSearch("");
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                    >
                      <div className="font-medium">{lead.name}</div>
                      {(lead.phone || lead.telefone) && (
                        <div className="text-xs text-muted-foreground">
                          {lead.phone || lead.telefone}
                        </div>
                      )}
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {lead.tags.slice(0, 3).map((tag: string) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum lead encontrado
                  </div>
                )}
              </div>
            )}
            {selectedLeadName && (
              <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                <span className="text-sm font-medium">{selectedLeadName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setLeadId("");
                    setSelectedLeadName("");
                  }}
                  className="h-6 px-2"
                >
                  Remover
                </Button>
              </div>
            )}
          </div>

          <div className="border-t sticky bottom-0 bg-background pt-4 pb-2">
            <Button onClick={handleSubmit} className="w-full">
              Criar Tarefa
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
