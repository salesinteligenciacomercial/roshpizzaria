import { useState, useEffect, useRef } from "react";
import { Pencil, Paperclip, Download, X, ExternalLink, Check, Upload, Image as ImageIcon, FileText, Link as LinkIcon, ChevronDown } from "lucide-react";
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
import { Trash2, Plus, Tag } from "lucide-react";
import { upsertCompromissoParaTarefa } from "@/services/tarefaService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTagsManager } from "@/hooks/useTagsManager";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { PdfViewerDialog } from "./PdfViewerDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  responsaveis?: string[];
  start_date: string | null; // Data início do prazo
  due_date: string | null; // Data final do prazo
  lead_id: string | null;
  checklist?: { id?: string; text: string; done: boolean }[];
  tags?: string[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  attachments?: { name: string; url: string; type?: string }[];
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
  const [startDate, setStartDate] = useState(
    task.start_date ? new Date(task.start_date).toISOString().split("T")[0] : ""
  );
  const [dueDate, setDueDate] = useState(
    task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : ""
  );
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "none");
  const [leadId, setLeadId] = useState(task.lead_id || "none");
  const [responsaveis, setResponsaveis] = useState<string[]>(
    Array.isArray(task.responsaveis) ? task.responsaveis : []
  );
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checklist, setChecklist] = useState<{ id?: string; text: string; done: boolean }[]>(task.checklist || []);
  const [newItem, setNewItem] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [tags, setTags] = useState<string[]>(task.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [tagsPopoverOpen, setTagsPopoverOpen] = useState(false);
  const { allTags: tagsExistentes } = useTagsManager();
  const [comments, setComments] = useState<{ id?: string; text: string; author_id?: string; created_at?: string }[]>(task.comments || []);
  const [newComment, setNewComment] = useState("");
  const [attachments, setAttachments] = useState<{ name: string; url: string; type?: string }[]>(task.attachments || []);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState("");
  const [pdfViewerName, setPdfViewerName] = useState("");

  useEffect(() => {
    if (open) {
      loadData();
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(normalizePriority(task.priority));
      setStartDate(task.start_date ? new Date(task.start_date).toISOString().split("T")[0] : "");
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");
      setAssigneeId(task.assignee_id || "none");
      setLeadId(task.lead_id || "none");
      // ✅ CORREÇÃO: Garantir que responsaveis é sempre um array válido
      const responsaveisArray = Array.isArray(task.responsaveis) ? task.responsaveis : [];
      setResponsaveis(responsaveisArray);
      console.log('📋 [EditarTarefa] Carregando tarefa:', { 
        id: task.id, 
        responsaveis_original: task.responsaveis,
        responsaveis_array: responsaveisArray 
      });
      setChecklist(task.checklist || []);
      setTags(task.tags || []);
      setComments(task.comments || []);
      setAttachments(task.attachments || []);
      setEditingItemId(null);
      setEditingText("");
    }
  }, [open, task]);

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
        .select("id, name")
        .eq("company_id", userRole.company_id);
      setLeads(leadsData || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
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
      const startDateIso = startDate ? new Date(`${startDate}T00:00:00`).toISOString() : null;
      const dueDateIso = dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null;
      
      // ✅ DEBUG: Verificar valores das datas
      console.log('📅 [EditarTarefa] Valores de data:', {
        startDate_estado: startDate,
        startDateIso,
        dueDate_estado: dueDate,
        dueDateIso
      });
      
      // Se não tiver assignee_id definido, usar o primeiro responsável
      const primaryAssignee = (assigneeId && assigneeId !== 'none') 
        ? assigneeId 
        : (responsaveis.length > 0 ? responsaveis[0] : null);

      // ✅ CORREÇÃO: Usar atualização direta ao invés da Edge Function
      // A Edge Function pode não suportar o campo start_date
      console.log('📤 [EditarTarefa] Atualizando tarefa diretamente no banco...');
      
      // Buscar company_id atual
      const { data: { user } } = await supabase.auth.getUser();
      let companyId = null;
      if (user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();
        companyId = userRole?.company_id;
      }

      // ✅ DEBUG: Verificar responsáveis antes de salvar
      console.log('👥 [EditarTarefa] Responsáveis:', {
        responsaveis_estado: responsaveis,
        responsaveis_length: responsaveis?.length,
        assigneeId_estado: assigneeId,
        primaryAssignee
      });

      // Construir objeto de atualização
      const updateData: any = {
        title: title.trim(),
        description: description.trim(),
        priority,
        start_date: startDateIso, // ✅ Data início do prazo
        due_date: dueDateIso, // Data final do prazo
        assignee_id: primaryAssignee,
        responsaveis: Array.isArray(responsaveis) ? responsaveis : [], // ✅ Garantir que é array
        lead_id: leadId === 'none' ? null : leadId,
        checklist: checklist && checklist.length > 0 ? checklist : null,
        tags: tags && tags.length > 0 ? tags : null,
        comments: comments && comments.length > 0 ? comments : null,
        attachments: attachments && attachments.length > 0 ? attachments : null,
        updated_at: new Date().toISOString()
      };
      
      // Preservar company_id se existir
      if (companyId) {
        updateData.company_id = companyId;
      }
      
      console.log('📤 [EditarTarefa] Dados para atualização:', updateData);
      
      const { error: dbError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id);

      if (dbError) {
        console.error("❌ Erro ao atualizar tarefa:", dbError);
        throw dbError;
      }
      
      console.log("✅ Tarefa atualizada com sucesso no banco!");

      toast.success("Tarefa atualizada com sucesso!");
      setOpen(false);
      setErrors({});
      try {
        if (dueDateIso) {
          await upsertCompromissoParaTarefa({ id: task.id, title: title.trim(), due_date: dueDateIso, assignee_id: primaryAssignee });
        }
      } catch (compromissoError) {
        console.warn("Erro ao criar/atualizar compromisso:", compromissoError);
        // Não bloquear o fluxo se falhar ao criar compromisso
      }
      // ✅ OTIMIZADO: Não chamar carregarDados() - o Realtime já atualiza automaticamente
      // A tarefa será atualizada via subscription 'postgres_changes' UPDATE
      console.log('✅ [EditarTarefaDialog] Tarefa atualizada - Realtime irá atualizar automaticamente');
    } catch (error: any) {
      console.error("Erro ao atualizar tarefa:", error);
      const errorMessage = error?.message || error?.error?.message || "Erro ao atualizar tarefa. Tente novamente.";
      toast.error(errorMessage);
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

  const addTagFromList = (tag: string) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagsPopoverOpen(false);
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `task-files/${task.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('internal-chat-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('internal-chat-media')
        .getPublicUrl(fileName);

      setAttachments((prev) => [...prev, { name: file.name, url: publicUrl, type: file.type }]);
      toast.success("Arquivo anexado!");
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload do arquivo");
    } finally {
      setUploading(false);
    }
  };

  const addAttachment = () => {
    let url = attachmentUrl.trim();
    const name = attachmentName.trim() || url;
    if (!url) {
      toast.error("Digite uma URL válida");
      return;
    }
    
    // Adicionar https se não tiver protocolo
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    try {
      new URL(url);
      setAttachments((prev) => [...prev, { name, url, type: 'link' }]);
      setAttachmentUrl("");
      setAttachmentName("");
      toast.success("Link adicionado");
    } catch {
      toast.error("URL inválida");
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  };
  
  const getAttachmentIcon = (att: { type?: string }) => {
    if (att.type === 'link') return <LinkIcon className="h-4 w-4 text-blue-500" />;
    if (att.type?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-green-500" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  // Função para abrir PDF via blob URL (evita bloqueio do navegador)
  const openPdfSafely = async (url: string, fileName: string) => {
    try {
      toast.loading('Carregando PDF...', { id: 'pdf-loading' });
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao baixar PDF');
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Abrir em nova aba usando blob URL
      const newWindow = window.open(blobUrl, '_blank');
      
      if (!newWindow) {
        // Fallback: criar link de download
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.click();
        toast.success('PDF baixado!', { id: 'pdf-loading' });
      } else {
        toast.success('PDF aberto!', { id: 'pdf-loading' });
      }
      
      // Limpar blob URL após um tempo
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
      console.error('Erro ao abrir PDF:', error);
      toast.error('Erro ao abrir PDF. Tente fazer o download.', { id: 'pdf-loading' });
      
      // Fallback: download direto
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.target = '_blank';
      link.click();
    }
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
                {startDate && dueDate && (
                  <p className="text-xs text-muted-foreground">
                    Duração: {Math.ceil((new Date(dueDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} dia(s)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex gap-2">
                  <Popover open={tagsPopoverOpen} onOpenChange={setTagsPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="flex-1 justify-start">
                        <Tag className="h-4 w-4 mr-2" />
                        {tagsExistentes.length > 0 ? "Selecionar tag existente" : "Sem tags existentes"}
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
                                  onSelect={() => addTagFromList(tag)}
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
                </div>
                
                <div className="flex gap-2">
                  <Input 
                    value={tagInput} 
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Adicionar tag..." 
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex flex-wrap gap-2 min-h-[60px] p-2 border rounded-md bg-muted/20">
                  {tags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma tag adicionada.</p>
                  ) : (
                    tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {tag}
                        <button
                          type="button"
                          className="ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => removeTag(tag)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
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
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-auto p-3 border rounded-md bg-muted/10">
                  {users.length === 0 ? (
                    <p className="text-xs text-muted-foreground col-span-2">Carregando usuários...</p>
                  ) : (
                    users.map((u) => (
                      <label 
                        key={u.id} 
                        className={`flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded transition-colors ${
                          responsaveis.includes(u.id) 
                            ? 'bg-primary/10 text-primary' 
                            : 'hover:bg-muted/30'
                        }`}
                      >
                        <Checkbox
                          checked={responsaveis.includes(u.id)}
                          onCheckedChange={(checked) => {
                            setResponsaveis((prev) => 
                              checked 
                                ? [...prev, u.id] 
                                : prev.filter(id => id !== u.id)
                            );
                          }}
                        />
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                          {u.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate">{u.full_name}</span>
                      </label>
                    ))
                  )}
                </div>
                {responsaveis.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {responsaveis.length} responsável(is) selecionado(s)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Lead Relacionado</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {leadId && leadId !== "none" 
                        ? leads.find(l => l.id === leadId)?.name || "Selecione um lead"
                        : "Nenhum"}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar lead..." />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty>Nenhum lead encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => setLeadId("none")}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                leadId === "none" ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            Nenhum
                          </CommandItem>
                          {leads.map((lead) => (
                            <CommandItem
                              key={lead.id}
                              value={lead.name}
                              onSelect={() => setLeadId(lead.id)}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  leadId === lead.id ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {lead.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
              {/* Upload de arquivo */}
              <div className="space-y-2">
                <Label>Upload de Arquivo</Label>
                <div 
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Upload className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium">
                      {uploading ? 'Enviando...' : 'Clique para fazer upload'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Imagens, PDFs, documentos (máx. 10MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Ou adicionar link */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">ou adicionar link</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome (opcional)</Label>
                  <Input 
                    value={attachmentName} 
                    onChange={(e) => setAttachmentName(e.target.value)} 
                    placeholder="Ex: Documento.pdf"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL do Link</Label>
                  <div className="flex gap-1">
                    <Input 
                      value={attachmentUrl} 
                      onChange={(e) => setAttachmentUrl(e.target.value)} 
                      placeholder="https://exemplo.com"
                      className="h-9"
                      onKeyDown={(e) => e.key === 'Enter' && addAttachment()}
                    />
                    <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={addAttachment}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de anexos */}
              <div className="space-y-3 pt-2">
                <Label className="text-xs text-muted-foreground">Anexos ({attachments.length})</Label>
                {attachments.length === 0 && (
                  <div className="text-center py-6">
                    <Paperclip className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhum anexo adicionado</p>
                  </div>
                )}
                {attachments.map((att, index) => {
                  const isImage = att.type?.startsWith('image/');
                  const isPdf = att.type === 'application/pdf';
                  
                  return (
                    <div key={index} className="border rounded-lg overflow-hidden bg-muted/20 group">
                      {/* Preview de imagem */}
                      {isImage && (
                        <div className="relative">
                          <img 
                            src={att.url} 
                            alt={att.name}
                            className="w-full max-h-48 object-contain bg-black/5 cursor-pointer"
                            onClick={() => window.open(att.url, '_blank')}
                          />
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 w-7 p-0 bg-white/90 hover:bg-white shadow-sm"
                              onClick={() => window.open(att.url, '_blank')}
                              title="Abrir em nova aba"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-7 w-7 p-0 shadow-sm"
                              onClick={() => removeAttachment(att.url)}
                              title="Remover"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Preview de PDF */}
                      {isPdf && (
                        <div 
                          className="flex items-center gap-3 p-4 bg-red-50 cursor-pointer hover:bg-red-100 transition-colors"
                          onClick={() => {
                            setPdfViewerUrl(att.url);
                            setPdfViewerName(att.name);
                            setPdfViewerOpen(true);
                          }}
                        >
                          <div className="p-2 rounded bg-red-500/10">
                            <FileText className="h-8 w-8 text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{att.name}</p>
                            <p className="text-xs text-muted-foreground">Clique para visualizar</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeAttachment(att.url);
                              }}
                              title="Remover"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {/* Outros tipos de arquivo ou links */}
                      {!isImage && !isPdf && (
                        <div className="flex items-center gap-2 p-3">
                          {getAttachmentIcon(att)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{att.name}</p>
                            {att.type && att.type !== 'link' && (
                              <p className="text-xs text-muted-foreground">{att.type}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => window.open(att.url, '_blank')}
                              title="Abrir"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                const a = document.createElement('a');
                                a.href = att.url;
                                a.download = att.name;
                                a.click();
                              }}
                              title="Baixar"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => removeAttachment(att.url)}
                              title="Remover"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
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

      {/* PDF Viewer Dialog */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        url={pdfViewerUrl}
        fileName={pdfViewerName}
      />
    </Dialog>
  );
}
