/**
 * ✅ BACKUP ATUALIZADO - 2024-11-01
 * IMPORTANTE: Este componente possui funcionalidade de EXPANDIR/RECOLHER (collapse/expand)
 * Se este arquivo retroceder, verificar:
 * 1. Importa ChevronDown e ChevronUp de lucide-react (linha 8)
 * 2. Possui estado isExpanded (useState(false)) para controlar expandir/recolher
 * 3. Botão de Chevron no CardHeader ao lado do Badge de prioridade
 * 4. CardContent está dentro de {isExpanded && (...)} para mostrar/recolher conteúdo
 * 5. Por padrão, cartões iniciam RECOLHIDOS (isExpanded = false)
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Calendar as CalendarIcon, Trash2, ExternalLink, MessageSquare, Plus, GripVertical, Bell, Play, Pause, Clock, Paperclip, Link, FileText, Image, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EditarTarefaDialog } from "./EditarTarefaDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { enviarLembreteWhatsApp } from "@/services/whatsappService";
import { useTaskTimer } from "@/hooks/useTaskTimer";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  tempo_gasto?: number;
  time_tracking_iniciado?: string;
  time_tracking_pausado?: boolean;
  attachments?: { name: string; url: string; type?: string }[];
}

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export const TaskCard = React.memo(function TaskCard({ task, onDelete, onUpdate }: TaskCardProps) {
  const navigate = useNavigate();
  const [localChecklist, setLocalChecklist] = useState(task.checklist || []);
  const [newItem, setNewItem] = useState("");
  const [attachments, setAttachments] = useState(task.attachments || []);
  const [showAttachmentDialog, setShowAttachmentDialog] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  // ✅ BACKUP: Estado para controlar expandir/recolher - Se retroceder, verificar esta linha
  const [isExpanded, setIsExpanded] = useState(false);
  const [localComments, setLocalComments] = useState(task.comments || []);
  const [newComment, setNewComment] = useState("");

  // ✅ MELHORADO: Usar hook useTaskTimer para gerenciar timer
  const {
    currentTime,
    isTracking,
    formattedTime,
    startTimer,
    pauseTimer,
    stopTimer
  } = useTaskTimer({
    taskId: task.id,
    initialTimeSpent: task.tempo_gasto || 0,
    timeTrackingStarted: task.time_tracking_iniciado || null,
    timeTrackingPaused: task.time_tracking_pausado || false,
    onTimeUpdated: onUpdate
  });

  useEffect(() => {
    setLocalChecklist(task.checklist || []);
  }, [task.checklist, task.id]);

  useEffect(() => {
    setAttachments(task.attachments || []);
  }, [task.attachments, task.id]);

  useEffect(() => {
    setLocalComments(task.comments || []);
  }, [task.comments, task.id]);

  // ✅ REMOVIDO: Código antigo de timer substituído por useTaskTimer hook

  const addComment = useCallback(async () => {
    const text = newComment.trim();
    if (!text) return;

    const comment = {
      id: (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}`,
      text,
      created_at: new Date().toISOString(),
    } as any;

    const updated = [...(localComments || []), comment];
    setLocalComments(updated);
    setNewComment("");

    // NOTA: Campo 'comments' não existe na tabela tasks
    // Comentários serão mantidos apenas localmente
    toast.success("Comentário adicionado (apenas localmente)");
  }, [newComment, localComments, task.id, task.description, onUpdate]);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Verificar se a tarefa está atrasada
  const isOverdue = useMemo(() => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now;
  }, [task.due_date]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${task.id}/${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(fileName);

      // Update task attachments
      const newAttachment = {
        name: file.name,
        url: publicUrl,
        type: file.type
      };

      const updatedAttachments = [...attachments, newAttachment];
      setAttachments(updatedAttachments);

      // NOTA: Campo 'attachments' não existe na tabela tasks
      // Anexos não serão persistidos no banco
      toast.success("Arquivo anexado (apenas localmente)!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      setAttachments(task.attachments || []);
      toast.error("Erro ao salvar anexo");
    } finally {
      setUploading(false);
    }
  }, [task.id, attachments, onUpdate]);

  const addExternalLink = useCallback(async () => {
    if (!attachmentUrl.trim()) return;

    try {
      const { supabase } = await import("@/integrations/supabase/client");

      const newAttachment = {
        name: attachmentUrl,
        url: attachmentUrl,
        type: 'link'
      };

      const updatedAttachments = [...attachments, newAttachment];
      setAttachments(updatedAttachments);

      // NOTA: Campo 'attachments' não existe na tabela tasks
      // Anexos serão mantidos apenas localmente
      setAttachmentUrl("");
      setShowAttachmentDialog(false);
      toast.success("Link adicionado (apenas localmente)!");
    } catch (error) {
      console.error("Erro ao adicionar link:", error);
      toast.error("Erro ao adicionar link");
    }
  }, [attachmentUrl, attachments, task.id, onUpdate]);

  const removeAttachment = useCallback(async (index: number) => {
    const updatedAttachments = attachments.filter((_, i) => i !== index);
    setAttachments(updatedAttachments);
    
    // NOTA: Campo 'attachments' não existe na tabela tasks
    // Anexos não serão persistidos no banco
    toast.success("Anexo removido (apenas localmente)!");
  }, [attachments]);

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

  const getPriorityColor = useCallback((priority: string) => {
    const colors: Record<string, string> = {
      baixa: "bg-gray-500",
      media: "bg-yellow-500",
      alta: "bg-orange-500",
      urgente: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  }, []);

  // ✅ CORRIGIDO: Usa campo real checklist, sem fallback para descrição
  const toggleChecklist = useCallback(async (itemId: string, checked: boolean) => {
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
      // Reverter estado local em caso de erro
      setLocalChecklist(task.checklist || []);
      console.error('Erro ao atualizar checklist:', e);
      toast.error('Erro ao atualizar checklist');
    }
  }, [localChecklist, task.id, task.checklist, onUpdate]);

  // ✅ CORRIGIDO: Usa campo real checklist, sem fallback para descrição
  const addChecklistItem = useCallback(async () => {
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
      // Reverter estado local em caso de erro
      console.error("Erro ao adicionar item ao checklist:", e);
      setLocalChecklist(task.checklist || []);
      toast.error('Erro ao adicionar item ao checklist');
    }
  }, [newItem, localChecklist, task.id, task.checklist, onUpdate]);

  const sendReminderNow = useCallback(async () => {
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
  }, [task]);

  const cleanDescription = useMemo(() =>
    (task.description || '').replace(/<!--meta:.*-->\s*$/s, '').trim(),
    [task.description]
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`group relative mb-3 border-0 shadow-card hover:shadow-lg transition-all duration-300 overflow-hidden ${
        isOverdue ? 'ring-2 ring-red-500/50 border-red-200' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-muted-foreground/70">
              <GripVertical className="h-3 w-3 cursor-grab active:cursor-grabbing" {...attributes} {...listeners} />
            </span>
            <div className={`h-1 w-1 rounded-full ${getPriorityColor(task.priority)} animate-pulse`} />
            <CardTitle className={`text-base font-semibold ${isOverdue ? 'text-red-700' : 'text-foreground'}`}>
              {task.title}
              {isOverdue && <span className="ml-2 text-red-500">🔴</span>}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Badge className={`${getPriorityColor(task.priority)} border-0 text-white shadow-sm`}>
              {task.priority}
            </Badge>
            {/* ✅ BACKUP: Botão de expandir/recolher - Se retroceder, verificar este botão Chevron */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {/* ✅ BACKUP: CardContent dentro de isExpanded - Se retroceder, verificar esta condicional */}
      {isExpanded && (
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
          {Array.isArray(localComments) && localComments.length > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <MessageSquare className="h-3 w-3" />
              <span className="font-medium">{localComments.length}</span>
            </div>
          )}
          {attachments.length > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              <Paperclip className="h-3 w-3" />
              <span className="font-medium">{attachments.length}</span>
            </div>
          )}
          {/* ✅ MELHORADO: Display de timer usando hook useTaskTimer */}
          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            <span className={`font-medium font-mono ${isTracking ? 'text-green-600 animate-pulse' : ''}`}>
              {formattedTime}
            </span>
            {isTracking && (
              <span className="text-[10px] text-green-600 font-semibold ml-1">●</span>
            )}
          </div>
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

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Anexos ({attachments.length})
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center gap-2 text-xs bg-muted/30 p-1.5 rounded">
                  {attachment.type === 'link' ? (
                    <Link className="h-3 w-3 text-blue-500" />
                  ) : attachment.type?.startsWith('image/') ? (
                    <Image className="h-3 w-3 text-green-500" />
                  ) : (
                    <FileText className="h-3 w-3 text-gray-500" />
                  )}
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-primary hover:underline"
                    title={attachment.name}
                  >
                    {attachment.name}
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); removeAttachment(index); }}
                    title="Remover anexo"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        

        <div className="mt-1 space-y-1">
          {(localChecklist || []).map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/40 cursor-pointer">
              <Checkbox checked={!!item.done} onCheckedChange={(v: any) => toggleChecklist(item.id!, !!v)} />
              <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.text}</span>
            </label>
          ))}
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
        
        <div className="flex justify-end items-center gap-1 pt-2">
          {/* Adicionar comentário - posicionado antes do sino */}
          <div className="flex items-center gap-1">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Adicionar comentário..."
              className="h-7 text-xs w-40"
            />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addComment} title="Adicionar comentário">
              <MessageSquare className="h-3 w-3" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => { e.stopPropagation(); sendReminderNow(); }}
            title="Enviar lembrete via WhatsApp"
          >
            <Bell className="h-3 w-3" />
          </Button>
          {/* ✅ MELHORADO: Botões de timer usando hook useTaskTimer */}
          {isTracking ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={(e) => { e.stopPropagation(); pauseTimer(); }}
              title="Pausar timer"
            >
              <Pause className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); startTimer(); }}
              title="Iniciar timer"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          {/* Attachments Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                title="Adicionar anexo"
              >
                <Paperclip className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? "Enviando..." : "📎 Upload de arquivo"}
                </label>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAttachmentDialog(true)}>
                🔗 Adicionar link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

        {/* Lista de comentários abaixo do botão de comentário */}
        {Array.isArray(localComments) && localComments.length > 0 && (
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {localComments.map((c, idx) => (
              <div key={c.id || idx} className="text-[11px] text-muted-foreground bg-muted/20 p-2 rounded">
                {c.text}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      )}

      {/* Add Link Dialog */}
      <Dialog open={showAttachmentDialog} onOpenChange={setShowAttachmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Link Externo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">URL do Link</label>
              <Input
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://exemplo.com/documento"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAttachmentDialog(false);
                  setAttachmentUrl("");
                }}
              >
                Cancelar
              </Button>
              <Button onClick={addExternalLink} disabled={!attachmentUrl.trim()}>
                Adicionar Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
});
