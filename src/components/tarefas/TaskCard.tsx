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
import { User, Calendar as CalendarIcon, Trash2, ExternalLink, MessageSquare, Plus, GripVertical, Bell, Play, Pause, Clock, Paperclip, Link, FileText, Image, ChevronDown, ChevronUp, Pencil, X, Check, CheckCircle2, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EditarTarefaDialog } from "./EditarTarefaDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { enviarLembreteWhatsApp } from "@/services/whatsappService";
import { useTaskTimer } from "@/hooks/useTaskTimer";
import { ConversaPopup } from "@/components/leads/ConversaPopup";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { PdfViewerDialog } from "./PdfViewerDialog";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  assignee_name?: string;
  responsaveis?: string[];
  responsaveis_names?: string[];
  start_date: string | null; // Data início do prazo
  due_date: string | null; // Data final do prazo
  lead_id: string | null;
  lead_name?: string;
  checklist?: { id?: string; text: string; done: boolean }[];
  comments?: { id?: string; text: string; author_id?: string; created_at?: string }[];
  tempo_gasto?: number;
  time_tracking_iniciado?: string;
  time_tracking_pausado?: boolean;
  attachments?: { name: string; url: string; type?: string }[];
  owner_id?: string;
  owner_name?: string;
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
  const [conversaOpen, setConversaOpen] = useState(false);
  const [leadPhone, setLeadPhone] = useState<string | undefined>(undefined);
  const [leadAvatarUrl, setLeadAvatarUrl] = useState<string | null>(null);
  const [leadNome, setLeadNome] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [ownerName, setOwnerName] = useState<string | null>(task.owner_name || null);
  const [isOwnTask, setIsOwnTask] = useState(true);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState("");
  const [pdfViewerName, setPdfViewerName] = useState("");

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

  // Buscar nome do criador e verificar se é tarefa própria
  useEffect(() => {
    const checkOwnership = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        setIsOwnTask(task.owner_id === user.id);
        
        // Se já tiver owner_name, usar ele
        if (task.owner_name) {
          setOwnerName(task.owner_name);
          return;
        }
        
        // Senão, buscar do banco
        if (task.owner_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', task.owner_id)
            .maybeSingle();
          
          if (profile?.full_name) {
            setOwnerName(profile.full_name);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar criador da tarefa:", error);
      }
    };
    
    checkOwnership();
  }, [task.owner_id, task.owner_name]);

  // Normalizar telefone brasileiro
  const normalizePhoneBR = (raw?: string): string | null => {
    if (!raw) return null;
    let n = raw.replace(/\D/g, "");
    if (n.startsWith("55")) return n;
    if (n.length === 10 || n.length === 11) return "55" + n;
    if (n.length >= 8 && n.length <= 13) return n.startsWith("55") ? n : "55" + n;
    return "55" + n;
  };

  // Buscar company_id
  const getCompanyId = async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return userRole?.company_id || null;
  };

  // Inicializar avatar com fallback se já tiver lead_name (apenas uma vez)
  useEffect(() => {
    if (task.lead_id && task.lead_name) {
      setLeadNome(task.lead_name);
      // Só definir fallback se ainda não tiver avatar carregado
      setLeadAvatarUrl(prev => {
        if (prev) return prev; // Manter se já tiver
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(task.lead_name!)}&background=10b981&color=fff&bold=true&size=128`;
      });
    }
  }, [task.lead_id, task.lead_name]);

  // Buscar telefone e foto do lead se houver
  useEffect(() => {
    const fetchLeadData = async () => {
      if (!task.lead_id) {
        setLeadPhone(undefined);
        setLeadAvatarUrl(null);
        setLeadNome(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("leads")
          .select("phone, name")
          .eq("id", task.lead_id)
          .maybeSingle();
        
        if (!error && data) {
          // Buscar telefone
          const phoneValue = data.phone || undefined;
          setLeadPhone(phoneValue);
          setLeadNome(data.name || null);
          
          // Buscar foto de perfil do WhatsApp
          const rawPhone = data.phone || "";
          const nomeLead = data.name || task.lead_name || "Lead";
            
          // Sempre definir fallback primeiro para garantir que o avatar apareça
          setLeadAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(nomeLead)}&background=10b981&color=fff&bold=true&size=128`);
          
          // Tentar buscar foto do WhatsApp em background (não bloqueia)
          if (rawPhone) {
            const numero = normalizePhoneBR(rawPhone);
            if (numero) {
              // Buscar foto de forma assíncrona sem bloquear
              // IMPORTANTE: Esta busca não deve causar erros que bloqueiem a criação da tarefa
              setTimeout(async () => {
                try {
                  const companyId = await getCompanyId();
                  if (!companyId) {
                    // Se não tem company_id, manter fallback
                    return;
                  }
                  
                  // Timeout de 5 segundos para não travar
                  const timeoutPromise = new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                  );
                  
                  // Envolver a chamada da Edge Function em try/catch e .catch() para garantir que nenhum erro seja propagado
                  const fetchPromise = supabase.functions.invoke('get-profile-picture', {
                    body: { number: numero, company_id: companyId }
                  }).catch((err) => {
                    // Capturar qualquer erro da Edge Function e retornar objeto com erro
                    return { data: null, error: err };
                  });
                  
                  try {
                    const result = await Promise.race([
                      fetchPromise,
                      timeoutPromise
                    ]) as any;
                    
                    // Verificar se o resultado é válido e não tem erro
                    if (result && !result.error && result.data?.profilePictureUrl) {
                      setLeadAvatarUrl(result.data.profilePictureUrl);
                    }
                    // Se falhar, manter o fallback que já foi definido acima
                  } catch (raceError) {
                    // Timeout ou outro erro - silenciosamente ignorar
                    // O fallback já foi definido acima
                  }
                } catch (error) {
                  // Silenciosamente manter fallback - não logar erro para não poluir console
                  // O fallback já foi definido acima
                }
              }, 100); // Pequeno delay para não bloquear a renderização inicial
            }
          }
        } else if (task.lead_id) {
          // Se não encontrou dados mas tem lead_id, usar fallback com lead_name
          if (task.lead_name) {
            setLeadNome(task.lead_name);
            setLeadAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(task.lead_name)}&background=10b981&color=fff&bold=true&size=128`);
          }
        }
      } catch (e) {
        console.error("Erro ao buscar dados do lead:", e);
      }
    };
    fetchLeadData();
  }, [task.lead_id, task.lead_name]);

  // ✅ REMOVIDO: Código antigo de timer substituído por useTaskTimer hook

  const addComment = useCallback(async () => {
    const text = newComment.trim();
    if (!text) return;

    const comment = {
      id: (globalThis as any).crypto?.randomUUID?.() || `${Date.now()}`,
      text,
      created_at: new Date().toISOString(),
    };

    const updated = [...(localComments || []), comment];
    setLocalComments(updated);
    setNewComment("");

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      // ✅ CORRIGIDO: Salvar comentários no campo comments JSONB
      const { error } = await supabase
        .from('tasks')
        .update({ comments: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
      toast.success("Comentário adicionado");
    } catch (e) {
      console.error("Erro ao adicionar comentário:", e);
      // Reverter em caso de erro
      setLocalComments(task.comments || []);
      toast.error("Erro ao salvar comentário");
    }
  }, [newComment, localComments, task.id, task.comments, onUpdate]);

  const editComment = useCallback(async (commentId: string) => {
    const text = editingCommentText.trim();
    if (!text) {
      setEditingCommentId(null);
      setEditingCommentText("");
      return;
    }

    const updated = (localComments || []).map((c: any) => {
      const commentIdToCheck = c.id || (typeof c === 'string' ? null : c.id);
      if (commentIdToCheck === commentId) {
        return {
          ...c,
          text: text,
          updated_at: new Date().toISOString(),
        };
      }
      return c;
    });

    setLocalComments(updated);
    setEditingCommentId(null);
    setEditingCommentText("");

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('tasks')
        .update({ comments: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
      toast.success("Comentário editado");
    } catch (e) {
      console.error("Erro ao editar comentário:", e);
      setLocalComments(task.comments || []);
      toast.error("Erro ao salvar alterações");
    }
  }, [editingCommentText, localComments, task.id, task.comments, onUpdate]);

  const deleteComment = useCallback(async (commentId: string) => {
    const updated = (localComments || []).filter((c: any) => {
      const commentIdToCheck = c.id || (typeof c === 'string' ? null : c.id);
      return commentIdToCheck !== commentId;
    });

    setLocalComments(updated);

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('tasks')
        .update({ comments: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
      toast.success("Comentário excluído");
    } catch (e) {
      console.error("Erro ao excluir comentário:", e);
      setLocalComments(task.comments || []);
      toast.error("Erro ao excluir comentário");
    }
  }, [localComments, task.id, task.comments, onUpdate]);

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

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    setUploading(true);
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `task-files/${task.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('internal-chat-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('internal-chat-media')
        .getPublicUrl(fileName);

      // Update task attachments
      const newAttachment = {
        name: file.name,
        url: publicUrl,
        type: file.type
      };

      const updatedAttachments = [...attachments, newAttachment];
      
      // Persistir no banco de dados
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ attachments: updatedAttachments })
        .eq('id', task.id);
      
      if (updateError) throw updateError;
      
      setAttachments(updatedAttachments);
      onUpdate();
      toast.success("Arquivo anexado!");
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      setAttachments(task.attachments || []);
      toast.error("Erro ao salvar anexo");
    } finally {
      setUploading(false);
    }
  }, [task.id, attachments, task.attachments, onUpdate]);

  const addExternalLink = useCallback(async () => {
    if (!attachmentUrl.trim()) return;

    try {
      let url = attachmentUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      const newAttachment = {
        name: attachmentUrl,
        url: url,
        type: 'link'
      };

      const updatedAttachments = [...attachments, newAttachment];
      
      // Persistir no banco de dados
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ attachments: updatedAttachments })
        .eq('id', task.id);
      
      if (updateError) throw updateError;
      
      setAttachments(updatedAttachments);
      setAttachmentUrl("");
      setShowAttachmentDialog(false);
      onUpdate();
      toast.success("Link adicionado!");
    } catch (error) {
      console.error("Erro ao adicionar link:", error);
      toast.error("Erro ao adicionar link");
    }
  }, [attachmentUrl, attachments, task.id, onUpdate]);

  const removeAttachment = useCallback(async (index: number) => {
    try {
      const updatedAttachments = attachments.filter((_, i) => i !== index);
      
      // Persistir no banco de dados
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ attachments: updatedAttachments })
        .eq('id', task.id);
      
      if (updateError) throw updateError;
      
      setAttachments(updatedAttachments);
      onUpdate();
      toast.success("Anexo removido!");
    } catch (error) {
      console.error("Erro ao remover anexo:", error);
      toast.error("Erro ao remover anexo");
    }
  }, [attachments, task.id, onUpdate]);

  // Função para abrir PDF via blob URL (evita bloqueio do navegador)
  const openPdfSafely = useCallback(async (url: string, fileName: string) => {
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
  }, []);

  // Função para duplicar a tarefa
  const duplicateTask = useCallback(async () => {
    try {
      toast.loading('Duplicando tarefa...', { id: 'duplicate-task' });
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Você precisa estar logado para duplicar tarefas', { id: 'duplicate-task' });
        return;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      // Criar novo checklist com novos IDs
      const newChecklist = (task.checklist || []).map(item => ({
        ...item,
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        done: false // Resetar status dos itens
      }));

      // Criar nova tarefa com os mesmos dados
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: `${task.title} (cópia)`,
          description: task.description,
          priority: task.priority,
          assignee_id: task.assignee_id,
          responsaveis: task.responsaveis || [],
          start_date: task.start_date,
          due_date: task.due_date,
          lead_id: task.lead_id,
          checklist: newChecklist,
          comments: [], // Não copiar comentários
          attachments: task.attachments || [],
          owner_id: user.id,
          company_id: userRole?.company_id || null,
          tempo_gasto: 0,
          time_tracking_iniciado: null,
          time_tracking_pausado: true
        });

      if (error) throw error;

      toast.success('Tarefa duplicada com sucesso!', { id: 'duplicate-task' });
      onUpdate();
    } catch (error) {
      console.error('Erro ao duplicar tarefa:', error);
      toast.error('Erro ao duplicar tarefa', { id: 'duplicate-task' });
    }
  }, [task, onUpdate]);

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

  // ✅ NOVO: Função para editar texto de item do checklist
  const startEditingItem = useCallback((itemId: string, currentText: string) => {
    setEditingItemId(itemId);
    setEditingText(currentText);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingItemId(null);
    setEditingText("");
  }, []);

  const saveEditedItem = useCallback(async () => {
    const text = editingText.trim();
    if (!text) {
      toast.error("O texto não pode estar vazio");
      return;
    }
    
    const updated = (localChecklist || []).map((i) => 
      i.id === editingItemId ? { ...i, text } : i
    );
    setLocalChecklist(updated);
    setEditingItemId(null);
    setEditingText("");
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('tasks')
        .update({ checklist: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
      toast.success("Item do checklist atualizado");
    } catch (e) {
      console.error("Erro ao editar item do checklist:", e);
      setLocalChecklist(task.checklist || []);
      toast.error('Erro ao editar item do checklist');
    }
  }, [editingText, editingItemId, localChecklist, task.id, task.checklist, onUpdate]);

  // ✅ NOVO: Função para excluir item do checklist
  const removeChecklistItem = useCallback(async (itemId: string) => {
    const updated = (localChecklist || []).filter((i) => i.id !== itemId);
    setLocalChecklist(updated);
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from('tasks')
        .update({ checklist: updated })
        .eq('id', task.id);
      if (error) throw error;
      onUpdate();
      toast.success("Item do checklist removido");
    } catch (e) {
      console.error("Erro ao remover item do checklist:", e);
      setLocalChecklist(task.checklist || []);
      toast.error('Erro ao remover item do checklist');
    }
  }, [localChecklist, task.id, task.checklist, onUpdate]);

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

  // ✅ NOVO: Calcular progresso do checklist
  const checklistProgress = useMemo(() => {
    if (!localChecklist || localChecklist.length === 0) {
      return { total: 0, completed: 0, percentage: 0, isComplete: false };
    }
    const total = localChecklist.length;
    const completed = localChecklist.filter(i => i.done).length;
    const percentage = Math.round((completed / total) * 100);
    return { total, completed, percentage, isComplete: completed === total };
  }, [localChecklist]);

  // ✅ NOVO: Calcular dias restantes e duração do prazo
  const deadlineInfo = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // ✅ DEBUG: Verificar valores recebidos
    console.log('🔍 [TaskCard Debug]', {
      taskId: task.id,
      title: task.title,
      start_date: task.start_date,
      due_date: task.due_date,
      start_date_type: typeof task.start_date,
      due_date_type: typeof task.due_date
    });
    
    // ✅ Validar start_date: deve ser uma string não vazia e válida
    const startDate = task.start_date && task.start_date.trim() !== '' 
      ? new Date(task.start_date) 
      : null;
    
    // ✅ Validar due_date: deve ser uma string não vazia e válida  
    const endDate = task.due_date && task.due_date.trim() !== '' 
      ? new Date(task.due_date) 
      : null;
    
    // ✅ Verificar se as datas são válidas
    if (startDate && isNaN(startDate.getTime())) {
      console.warn('start_date inválida:', task.start_date);
    }
    if (endDate && isNaN(endDate.getTime())) {
      console.warn('due_date inválida:', task.due_date);
    }
    
    if (startDate && !isNaN(startDate.getTime())) startDate.setHours(0, 0, 0, 0);
    if (endDate && !isNaN(endDate.getTime())) endDate.setHours(0, 0, 0, 0);
    
    let daysRemaining = 0;
    let totalDays = 0;
    let daysElapsed = 0;
    let timeProgress = 0;
    let status: 'not_started' | 'in_progress' | 'overdue' | 'completed' = 'not_started';
    
    if (endDate && !isNaN(endDate.getTime())) {
      daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (startDate && !isNaN(startDate.getTime()) && endDate) {
        totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysElapsed < 0) {
          status = 'not_started';
          timeProgress = 0;
        } else if (daysRemaining < 0) {
          status = 'overdue';
          timeProgress = 100;
        } else {
          status = 'in_progress';
          timeProgress = Math.min(100, Math.max(0, Math.round((daysElapsed / totalDays) * 100)));
        }
      } else {
        if (daysRemaining < 0) {
          status = 'overdue';
        } else {
          status = 'in_progress';
        }
      }
    }
    
    return {
      startDate: startDate && !isNaN(startDate.getTime()) ? startDate : null,
      endDate: endDate && !isNaN(endDate.getTime()) ? endDate : null,
      daysRemaining,
      totalDays,
      daysElapsed,
      timeProgress,
      status,
      hasDeadline: !!(endDate && !isNaN(endDate.getTime()))
    };
  }, [task.start_date, task.due_date]);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative mb-3 border-0 shadow-card hover:shadow-lg transition-all duration-300 overflow-hidden cursor-grab active:cursor-grabbing ${
        isOverdue ? 'ring-2 ring-red-500/50 border-red-200' : ''
      } ${!isOwnTask ? 'opacity-40 saturate-50' : ''} ${
        checklistProgress.isComplete ? 'ring-2 ring-green-500/60 shadow-green-500/20' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-2">
          {/* Conteúdo principal do card com mais espaço */}
          <div className="flex items-center gap-0.5 flex-1">
            <div className={`h-1 w-1 rounded-full ${getPriorityColor(task.priority)} animate-pulse`} />
            
            {/* Layout com foto, nome do lead e título */}
            {task.lead_id ? (
              <div className="flex items-center gap-2 flex-1">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage 
                    src={leadAvatarUrl || undefined} 
                    alt={leadNome || task.lead_name || "Lead"}
                    onError={() => {
                      const nomeLead = leadNome || task.lead_name || "Lead";
                      setLeadAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(nomeLead)}&background=10b981&color=fff&bold=true&size=128`);
                    }}
                  />
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {(leadNome || task.lead_name || "L")?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {leadNome || task.lead_name || "Lead"}
                  </span>
                  <CardTitle className={`text-xs font-normal ${isOverdue ? 'text-red-700' : 'text-muted-foreground'} truncate`}>
                    {task.title}
                    {isOverdue && <span className="ml-1 text-red-500">🔴</span>}
                  </CardTitle>
                  
                  {/* Mostrar nome do criador quando não for tarefa própria */}
                  {!isOwnTask && ownerName && (
                    <span className="text-[10px] text-muted-foreground/70 truncate">
                      Criado por: {ownerName}
                    </span>
                  )}
                  
                  {/* Prazo - Data Inicial e Final com Contador */}
                  {deadlineInfo.hasDeadline && (
                    <div className="flex flex-col gap-1 mt-1">
                      <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md self-start ${
                        deadlineInfo.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        <CalendarIcon className="h-3 w-3" />
                      <span className="font-medium">
                        {deadlineInfo.startDate && deadlineInfo.endDate 
                          ? `${deadlineInfo.startDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: '2-digit' })} - Prazo: ${deadlineInfo.endDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: '2-digit' })}`
                          : deadlineInfo.endDate
                            ? `Prazo: ${deadlineInfo.endDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: '2-digit' })}`
                            : ''
                        }
                      </span>
                      </div>
                      {/* Contador de dias e progresso */}
                      <div className={`flex items-center gap-2 text-[10px] px-2 ${
                        deadlineInfo.status === 'overdue' ? 'text-red-600' : 
                        deadlineInfo.daysRemaining <= 2 ? 'text-orange-600' : 'text-muted-foreground'
                      }`}>
                        <span>
                          {deadlineInfo.status === 'overdue' 
                            ? `⚠️ Atrasado ${Math.abs(deadlineInfo.daysRemaining)} dia(s)`
                            : deadlineInfo.daysRemaining === 0 
                              ? '⏰ Vence hoje!'
                              : deadlineInfo.daysRemaining === 1
                                ? '⏰ Vence amanhã'
                                : `📅 Faltam ${deadlineInfo.daysRemaining} dias`
                          }
                        </span>
                        {deadlineInfo.totalDays > 0 && (
                          <span className="text-muted-foreground">
                            • Duração: {deadlineInfo.totalDays} dia(s)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <CardTitle className={`text-base font-semibold ${isOverdue ? 'text-red-700' : 'text-foreground'}`}>
                  {task.title}
                  {isOverdue && <span className="ml-2 text-red-500">🔴</span>}
                </CardTitle>
                
                {/* Mostrar nome do criador quando não for tarefa própria */}
                {!isOwnTask && ownerName && (
                  <span className="text-[10px] text-muted-foreground/70">
                    Criado por: {ownerName}
                  </span>
                )}
                
                {/* Prazo - Data Inicial e Final com Contador */}
                {deadlineInfo.hasDeadline && (
                  <div className="flex flex-col gap-1">
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-md self-start ${
                      deadlineInfo.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-muted/50 text-muted-foreground'
                    }`}>
                      <CalendarIcon className="h-3 w-3" />
                      <span className="font-medium">
                        {deadlineInfo.startDate && deadlineInfo.endDate 
                          ? `${deadlineInfo.startDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: '2-digit' })} - Prazo: ${deadlineInfo.endDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: '2-digit' })}`
                          : deadlineInfo.endDate
                            ? `Prazo: ${deadlineInfo.endDate.toLocaleDateString("pt-BR", { day: '2-digit', month: '2-digit', year: '2-digit' })}`
                            : ''
                        }
                      </span>
                    </div>
                    {/* Contador de dias e progresso */}
                    <div className={`flex items-center gap-2 text-[10px] px-2 ${
                      deadlineInfo.status === 'overdue' ? 'text-red-600' : 
                      deadlineInfo.daysRemaining <= 2 ? 'text-orange-600' : 'text-muted-foreground'
                    }`}>
                      <span>
                        {deadlineInfo.status === 'overdue' 
                          ? `⚠️ Atrasado ${Math.abs(deadlineInfo.daysRemaining)} dia(s)`
                          : deadlineInfo.daysRemaining === 0 
                            ? '⏰ Vence hoje!'
                            : deadlineInfo.daysRemaining === 1
                              ? '⏰ Vence amanhã'
                              : `📅 Faltam ${deadlineInfo.daysRemaining} dias`
                        }
                      </span>
                      {deadlineInfo.totalDays > 0 && (
                        <span className="text-muted-foreground">
                          • Duração: {deadlineInfo.totalDays} dia(s)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Coluna direita: Indicador de progresso, botão expandir e prioridade */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {/* ✅ Indicador de progresso do checklist - ACIMA do botão expandir */}
            {(checklistProgress.total > 0 || deadlineInfo.hasDeadline) && (
              <div 
                className={`flex items-center justify-center transition-all duration-300 ${
                  checklistProgress.isComplete 
                    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' 
                    : deadlineInfo.status === 'overdue'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-background border-2 border-muted shadow-sm'
                } rounded-full`}
                style={{ width: '28px', height: '28px' }}
                title={
                  checklistProgress.isComplete 
                    ? '✅ Checklist 100% Concluído - GANHO!' 
                    : deadlineInfo.status === 'overdue'
                      ? `⚠️ Atrasado ${Math.abs(deadlineInfo.daysRemaining)} dia(s) | Progresso: ${checklistProgress.percentage}%`
                      : checklistProgress.total > 0
                        ? `Progresso: ${checklistProgress.completed}/${checklistProgress.total} (${checklistProgress.percentage}%)`
                        : `Faltam ${deadlineInfo.daysRemaining} dias para o prazo`
                }
              >
                {checklistProgress.isComplete ? (
                  <CheckCircle2 className="h-4 w-4 animate-pulse" />
                ) : (
                  <div className="relative flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 22 22" className="transform -rotate-90">
                      <circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
                      <circle
                        cx="11" cy="11" r="8" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeDasharray={`${(checklistProgress.percentage / 100) * 50.3} 50.3`}
                        strokeLinecap="round"
                        className={`transition-all duration-500 ${
                          deadlineInfo.status === 'overdue' ? 'text-red-500' :
                          checklistProgress.percentage >= 75 ? 'text-green-500' :
                          checklistProgress.percentage >= 50 ? 'text-yellow-500' :
                          checklistProgress.percentage >= 25 ? 'text-orange-500' : 'text-blue-500'
                        }`}
                      />
                    </svg>
                    <span className={`absolute text-[7px] font-bold ${
                      deadlineInfo.status === 'overdue' ? 'text-white' :
                      deadlineInfo.daysRemaining <= 2 && deadlineInfo.daysRemaining >= 0 ? 'text-orange-600' : 'text-foreground'
                    }`}>
                      {checklistProgress.total > 0 ? `${checklistProgress.percentage}%` : deadlineInfo.hasDeadline ? `${deadlineInfo.daysRemaining}d` : ''}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* Botão de expandir/minimizar */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setIsExpanded(v => !v); }}
              title={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
            
            {/* Badge de prioridade */}
            <Badge className={`${getPriorityColor(task.priority)} border-0 text-white shadow-sm text-[10px] px-1.5 py-0`}>
              {task.priority}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      {/* ✅ BACKUP: CardContent dentro de isExpanded - Se retroceder, verificar esta condicional */}
      {isExpanded && (
      <CardContent className="relative space-y-3">
        {cleanDescription && (
          <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <p 
              className={`text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-md whitespace-pre-wrap break-words ${
                !isDescriptionExpanded && cleanDescription.length > 100 ? 'line-clamp-3' : ''
              }`}
            >
              {cleanDescription}
            </p>
            {cleanDescription.length > 100 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs mt-1 text-primary hover:text-primary/80"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDescriptionExpanded(!isDescriptionExpanded);
                }}
              >
                {isDescriptionExpanded ? 'Ver menos' : 'Ver mais'}
              </Button>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-4 text-xs flex-wrap">
          {/* Responsáveis - Exibição com avatares */}
          {(task.assignee_name || (task.responsaveis_names && task.responsaveis_names.length > 0)) && (
            <div className="flex items-center gap-2">
              {/* Avatares empilhados */}
              <div className="flex -space-x-2">
                {task.assignee_name && (
                  <div 
                    className="h-6 w-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] font-semibold text-primary"
                    title={task.assignee_name}
                  >
                    {task.assignee_name.charAt(0).toUpperCase()}
                  </div>
                )}
                {task.responsaveis_names && task.responsaveis_names.slice(0, 3).map((name, idx) => (
                  <div 
                    key={idx}
                    className="h-6 w-6 rounded-full bg-blue-500/20 border-2 border-background flex items-center justify-center text-[10px] font-semibold text-blue-600"
                    title={name}
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                ))}
                {task.responsaveis_names && task.responsaveis_names.length > 3 && (
                  <div 
                    className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-semibold text-muted-foreground"
                    title={`+${task.responsaveis_names.length - 3} mais`}
                  >
                    +{task.responsaveis_names.length - 3}
                  </div>
                )}
              </div>
              {/* Nomes dos responsáveis */}
              <div className="flex flex-col text-muted-foreground">
                <span className="text-[10px] font-medium truncate max-w-[120px]" title={task.assignee_name || ''}>
                  {task.assignee_name || (task.responsaveis_names?.[0] || '')}
                </span>
                {((task.assignee_name && task.responsaveis_names && task.responsaveis_names.length > 0) || 
                  (!task.assignee_name && task.responsaveis_names && task.responsaveis_names.length > 1)) && (
                  <span className="text-[9px] text-muted-foreground/70">
                    +{task.responsaveis_names!.length - (task.assignee_name ? 0 : 1)} responsável(is)
                  </span>
                )}
              </div>
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

        {/* Botão Conversas - MOVIDO DO HEADER PARA CÁ */}
        {task.lead_id && leadPhone && (
          <div className="flex items-center justify-start pt-2 border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { 
                e.stopPropagation();
                console.log("🔍 Clique no botão WhatsApp:", { 
                  leadPhone, 
                  leadId: task.lead_id, 
                  leadName: leadNome || task.lead_name 
                });
                if (leadPhone) {
                  console.log("✅ Abrindo popup de conversa");
                  setConversaOpen(true);
                } else {
                  console.log("❌ Lead sem telefone");
                  toast.error("Lead sem telefone cadastrado");
                }
              }}
              disabled={!leadPhone}
              className="w-full h-8 text-success border-success/30 hover:bg-success/10 hover:text-success transition-all disabled:opacity-50"
              title={leadPhone ? "Ver histórico de conversas" : "Lead sem telefone cadastrado"}
            >
              <MessageSquare className="h-3.5 w-3.5 mr-2" />
              <span className="text-xs font-medium">Ver Conversas</span>
            </Button>
          </div>
        )}
        
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
          <div className="space-y-2" onPointerDown={(e) => e.stopPropagation()}>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              Anexos ({attachments.length})
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {attachments.map((attachment, index) => {
                const isImage = attachment.type?.startsWith('image/');
                const isPdf = attachment.type === 'application/pdf';
                
                return (
                  <div key={index} className="group">
                    {/* Preview de imagem */}
                    {isImage && (
                      <div className="relative rounded overflow-hidden border">
                        <img 
                          src={attachment.url} 
                          alt={attachment.name}
                          className="w-full max-h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(attachment.url, '_blank')}
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); removeAttachment(index); }}
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Preview de PDF */}
                    {isPdf && (
                      <div 
                        className="flex items-center gap-2 p-2 rounded bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                        onClick={() => {
                          setPdfViewerUrl(attachment.url);
                          setPdfViewerName(attachment.name);
                          setPdfViewerOpen(true);
                        }}
                      >
                        <FileText className="h-5 w-5 text-red-600 flex-shrink-0" />
                        <span className="flex-1 text-xs truncate font-medium">{attachment.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); removeAttachment(index); }}
                          title="Remover"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    
                    {/* Outros arquivos */}
                    {!isImage && !isPdf && (
                      <div className="flex items-center gap-2 text-xs bg-muted/30 p-1.5 rounded">
                        {attachment.type === 'link' ? (
                          <Link className="h-3 w-3 text-blue-500" />
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
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        

        <div className="mt-1 space-y-1">
          {(localChecklist || []).map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-xs p-1 rounded hover:bg-muted/40 group" onPointerDown={(e) => e.stopPropagation()}>
              <Checkbox checked={!!item.done} onCheckedChange={(v: any) => toggleChecklist(item.id!, !!v)} />
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
                    className="h-7 text-xs flex-1"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                    onClick={saveEditedItem}
                    title="Salvar"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={cancelEditing}
                    title="Cancelar"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className={`flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.text}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingItem(item.id!, item.text);
                      }}
                      title="Editar item"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Tem certeza que deseja excluir este item do checklist?")) {
                          removeChecklistItem(item.id!);
                        }
                      }}
                      title="Excluir item"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          <div className="flex items-center gap-1 pt-1" onPointerDown={(e) => e.stopPropagation()}>
            <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Adicionar item..." className="h-7 text-xs" />
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addChecklistItem}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Seção do lead movida para o CardHeader para aparecer sempre */}
        
        <div className="flex justify-end items-center gap-1 pt-2 flex-wrap" onPointerDown={(e) => e.stopPropagation()}>
          {/* Adicionar comentário - apenas botão para não sair do card */}
          {showCommentInput ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addComment();
                    setShowCommentInput(false);
                  } else if (e.key === 'Escape') {
                    setShowCommentInput(false);
                    setNewComment("");
                  }
                }}
                placeholder="Comentário..."
                className="h-7 text-xs flex-1 min-w-0"
                autoFocus
              />
              <Button 
                type="button" 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 flex-shrink-0" 
                onClick={() => {
                  addComment();
                  setShowCommentInput(false);
                }} 
                title="Adicionar"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button 
                type="button" 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 flex-shrink-0" 
                onClick={() => {
                  setShowCommentInput(false);
                  setNewComment("");
                }} 
                title="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button 
              type="button" 
              size="sm" 
              variant="ghost" 
              className="h-7 w-7 p-0 flex-shrink-0"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowCommentInput(true);
              }} 
              title="Adicionar comentário"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onPointerDown={(e) => e.stopPropagation()}
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
              onPointerDown={(e) => e.stopPropagation()}
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
              onPointerDown={(e) => e.stopPropagation()}
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
                onPointerDown={(e) => e.stopPropagation()}
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
          <Button
            variant="ghost"
            size="sm"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); duplicateTask(); }}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Duplicar tarefa"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <EditarTarefaDialog task={task} onTaskUpdated={onUpdate} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onPointerDown={(e) => e.stopPropagation()}
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
          <div className="mt-3 space-y-2 pt-3 border-t border-border/50" onPointerDown={(e) => e.stopPropagation()}>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Comentários ({localComments.length})
            </div>
            {localComments.map((c, idx) => {
              // Extrair texto do comentário, seja string ou objeto
              const commentId = c.id || (typeof c === 'string' ? `comment-${idx}` : c.id || `comment-${idx}`);
              const commentText = typeof c === 'string' ? c : (c.text || JSON.stringify(c));
              const isEditing = editingCommentId === commentId;
              
              return (
                <div key={commentId} className="bg-muted/30 p-2.5 rounded-md border border-border/30 group hover:bg-muted/40 transition-colors">
                  {isEditing ? (
                    <div className="space-y-2">
                      <Input
                        value={editingCommentText}
                        onChange={(e) => setEditingCommentText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            editComment(commentId);
                          } else if (e.key === 'Escape') {
                            setEditingCommentId(null);
                            setEditingCommentText("");
                          }
                        }}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => editComment(commentId)}
                          title="Salvar"
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingCommentText("");
                          }}
                          title="Cancelar"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-foreground leading-relaxed break-words flex-1">
                          {commentText}
                        </p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCommentId(commentId);
                              setEditingCommentText(commentText);
                            }}
                            title="Editar comentário"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Tem certeza que deseja excluir este comentário?")) {
                                deleteComment(commentId);
                              }
                            }}
                            title="Excluir comentário"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {c.created_at && (
                        <span className="text-[10px] text-muted-foreground mt-1 block">
                          {new Date(c.created_at).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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

      {/* Conversa Popup */}
      {task.lead_id && (
        <ConversaPopup
          open={conversaOpen}
          onOpenChange={setConversaOpen}
          leadId={task.lead_id}
          leadName={leadNome || task.lead_name || "Lead"}
          leadPhone={leadPhone || ""}
        />
      )}

      {/* PDF Viewer Dialog */}
      <PdfViewerDialog
        open={pdfViewerOpen}
        onOpenChange={setPdfViewerOpen}
        url={pdfViewerUrl}
        fileName={pdfViewerName}
      />
    </Card>
  );
});
