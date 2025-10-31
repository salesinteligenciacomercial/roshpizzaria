import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Calendar as CalendarIcon, Trash2, ExternalLink, MessageSquare, Plus, GripVertical, Bell, Play, Pause, Clock, Paperclip, Link, FileText, Image } from "lucide-react";
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
  const [currentTime, setCurrentTime] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  const [attachments, setAttachments] = useState(task.attachments || []);
  const [showAttachmentDialog, setShowAttachmentDialog] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLocalChecklist(task.checklist || []);
  }, [task.checklist, task.id]);

  useEffect(() => {
    setAttachments(task.attachments || []);
  }, [task.attachments, task.id]);

  // Atualizar tempo atual baseado no tempo gasto salvo + tempo decorrido desde o início
  useEffect(() => {
    const updateCurrentTime = () => {
      const baseTime = task.tempo_gasto || 0;
      if (task.time_tracking_iniciado && !task.time_tracking_pausado) {
        const startTime = new Date(task.time_tracking_iniciado).getTime();
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000); // em segundos
        setCurrentTime(baseTime + elapsed);
        setIsTracking(true);
      } else {
        setCurrentTime(baseTime);
        setIsTracking(false);
      }
    };

    updateCurrentTime();

    // Atualizar a cada segundo se estiver trackeando
    if (task.time_tracking_iniciado && !task.time_tracking_pausado) {
      const interval = setInterval(updateCurrentTime, 1000);
      setTrackingInterval(interval);
      return () => clearInterval(interval);
    } else if (trackingInterval) {
      clearInterval(trackingInterval);
      setTrackingInterval(null);
    }

    return () => {
      if (trackingInterval) clearInterval(trackingInterval);
    };
  }, [task.tempo_gasto, task.time_tracking_iniciado, task.time_tracking_pausado, trackingInterval]);

  const startTimeTracking = useCallback(async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tasks')
        .update({
          time_tracking_iniciado: now,
          time_tracking_pausado: false
        })
        .eq('id', task.id);

      if (error) throw error;
      onUpdate();
      toast.success("Time tracking iniciado!");
    } catch (error) {
      console.error("Erro ao iniciar time tracking:", error);
      toast.error("Erro ao iniciar time tracking");
    }
  }, [task.id, onUpdate]);

  const pauseTimeTracking = useCallback(async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const now = new Date();
      const startTime = new Date(task.time_tracking_iniciado!);
      const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      const totalTime = (task.tempo_gasto || 0) + elapsedMinutes;

      const { error } = await supabase
        .from('tasks')
        .update({
          tempo_gasto: totalTime,
          time_tracking_iniciado: null,
          time_tracking_pausado: true
        })
        .eq('id', task.id);

      if (error) throw error;
      onUpdate();
      toast.success(`Time tracking pausado! Tempo total: ${totalTime} minutos`);
    } catch (error) {
      console.error("Erro ao pausar time tracking:", error);
      toast.error("Erro ao pausar time tracking");
    }
  }, [task.id, task.tempo_gasto, task.time_tracking_iniciado, onUpdate]);

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

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ attachments: updatedAttachments })
        .eq('id', task.id);

      if (updateError) throw updateError;

      onUpdate();
      toast.success("Arquivo anexado com sucesso!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao fazer upload do arquivo");
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

      const { error } = await supabase
        .from('tasks')
        .update({ attachments: updatedAttachments })
        .eq('id', task.id);

      if (error) throw error;

      onUpdate();
      setAttachmentUrl("");
      setShowAttachmentDialog(false);
      toast.success("Link adicionado com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar link:", error);
      toast.error("Erro ao adicionar link");
    }
  }, [attachmentUrl, attachments, task.id, onUpdate]);

  const removeAttachment = useCallback(async (index: number) => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");

      const updatedAttachments = attachments.filter((_, i) => i !== index);
      setAttachments(updatedAttachments);

      const { error } = await supabase
        .from('tasks')
        .update({ attachments: updatedAttachments })
        .eq('id', task.id);

      if (error) throw error;

      onUpdate();
      toast.success("Anexo removido!");
    } catch (error) {
      console.error("Erro ao remover anexo:", error);
      toast.error("Erro ao remover anexo");
    }
  }, [attachments, task.id, onUpdate]);

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
  }, [localChecklist, task.id, task.description, onUpdate]);

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
  }, [newItem, localChecklist, task.id, task.description, onUpdate]);

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
          {/* Time Tracking Display */}
          <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            <span className={`font-medium font-mono ${isTracking ? 'text-green-600 animate-pulse' : ''}`}>
              {formatTime(currentTime)}
            </span>
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
            <div className="space-y-1 max-h-20 overflow-y-auto">
              {attachments.slice(0, 3).map((attachment, index) => (
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
              {attachments.length > 3 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  +{attachments.length - 3} mais
                </div>
              )}
            </div>
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
          {/* Time Tracking Buttons */}
          {isTracking ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              onClick={(e) => { e.stopPropagation(); pauseTimeTracking(); }}
              title="Pausar time tracking"
            >
              <Pause className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => { e.stopPropagation(); startTimeTracking(); }}
              title="Iniciar time tracking"
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
      </CardContent>

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
