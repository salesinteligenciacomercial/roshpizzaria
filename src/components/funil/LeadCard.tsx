import React, { useEffect, useState, memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, Trash2, MessageCircle, Building2, Tag, Calendar, CheckSquare, ChevronDown, ChevronUp } from "lucide-react";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { EditarLeadDialog } from "./EditarLeadDialog";
import { MoverLeadFunilDialog } from "./MoverLeadFunilDialog";
import { LeadComments } from "./LeadComments";
import { ConversasModal } from "./ConversasModal";
import { supabase } from "@/integrations/supabase/client";

/**
 * ✅ BACKUP ATUALIZADO - 2024-11-01 (TARDE)
 * IMPORTANTE: 
 * 1. Deve passar initialNotes={lead.notes ?? null} ao LeadComments
 * 2. useDraggable DEVE passar etapaId no data (linha 105)
 * 
 * Se este arquivo retroceder, verificar:
 * 1. Interface LeadCardProps inclui notes?: string | null
 * 2. LeadComments recebe initialNotes={lead.notes ?? null}
 * 3. useDraggable data inclui etapaId: lead.etapa_id (CRÍTICO para identificar destino)
 */

interface LeadCardProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    value?: number;
    company?: string;
    source?: string;
    tags?: string[];
    funil_id?: string;
    etapa_id?: string;
    notes?: string | null;
  };
  onDelete: (leadId: string) => void;
  onLeadMoved?: () => void;
  isDragging?: boolean;
}

export const LeadCard = memo(function LeadCard({ lead, onDelete, onLeadMoved, isDragging: externalIsDragging }: LeadCardProps) {
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [conversasModalOpen, setConversasModalOpen] = useState(false);
  const [proximoCompromisso, setProximoCompromisso] = useState<string | null>(null);
  const [proximaTarefa, setProximaTarefa] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const carregarProximasAtividades = useCallback(async () => {
    try {
      // Carregar próximo compromisso
      const { data: compromissos } = await supabase
        .from("compromissos")
        .select("tipo_servico, data_hora_inicio")
        .eq("lead_id", lead.id)
        .gte("data_hora_inicio", new Date().toISOString())
        .order("data_hora_inicio")
        .limit(1);

      if (compromissos?.[0]) {
        const titulo = compromissos[0].tipo_servico || 'Compromisso';
        setProximoCompromisso(
          `${titulo} - ${new Date(compromissos[0].data_hora_inicio).toLocaleDateString()}`
        );
      }

      // Carregar próxima tarefa
      const { data: tarefas } = await supabase
        .from("tasks")
        .select("title, due_date")
        .eq("lead_id", lead.id)
        .eq("status", "pendente")
        .order("due_date")
        .limit(1);

      if (tarefas?.[0]) {
        setProximaTarefa(
          `${tarefas[0].title} - ${new Date(tarefas[0].due_date).toLocaleDateString()}`
        );
      }
    } catch (error) {
      console.error("Erro ao carregar atividades:", error);
    }
  }, [lead.id]);

  useEffect(() => {
    if (lead.id) {
      carregarProximasAtividades();
    }
  }, [lead.id, carregarProximasAtividades]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: internalIsDragging,
  } = useDraggable({
    id: lead.id,
    data: {
      type: 'lead',
      lead: lead,
      etapaId: lead.etapa_id // ✅ CRÍTICO: Passar etapaId para identificar etapa de destino
    }
  });

  const isDragging = externalIsDragging || internalIsDragging;

  // Desabilita o drag quando estiver clicando em botões
  const modifiedListeners = {
    ...listeners,
    onMouseDown: (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest('button, input, select')) {
        listeners?.onMouseDown?.(e);
      }
    }
  };

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0) ${isDragging ? 'rotate(3deg) scale(1.05)' : 'rotate(0deg) scale(1)'}`,
    opacity: isDragging ? 0.8 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'all 200ms ease',
    zIndex: isDragging ? 1000 : 'auto',
    boxShadow: isDragging ? '0 20px 50px rgba(0,0,0,0.3)' : undefined,
  } : {
    cursor: 'grab',
    transition: 'all 200ms ease',
  };

  // ✅ Novo: Abre modal de conversas ao invés de redirecionar
  const abrirConversa = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (lead.telefone) {
      setConversasModalOpen(true);
    } else {
      console.warn('Lead sem telefone:', lead.nome);
    }
  }, [lead.telefone, lead.nome]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Tem certeza que deseja excluir este lead?")) {
      onDelete(lead.id);
    }
  }, [lead.id, onDelete]);

  const handleAgendaModal = useCallback(() => {
    setAgendaModalOpen(true);
  }, []);

  const handleTarefaModal = useCallback(() => {
    setTarefaModalOpen(true);
  }, []);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }
      }}
      className={`group relative p-4 mb-3 cursor-grab active:cursor-grabbing border-0 shadow-card hover:shadow-lg transition-all duration-300 bg-card overflow-hidden ${
        isDragging ? 'shadow-2xl scale-105 z-50 ring-2 ring-primary/50 bg-gradient-to-br from-card to-primary/5' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="relative space-y-3">
        {/* Header sempre visível */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-start gap-2 flex-1" {...(modifiedListeners as any)}>
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground mb-1">{lead.nome}</h4>
              {lead.tags && lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="h-2.5 w-2.5 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Botão de expandir/colapsar */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Conteúdo expandido */}
        {isExpanded && (
          <div className="space-y-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
            <div
              className="flex gap-1"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <MoverLeadFunilDialog
                  leadId={lead.id}
                  leadNome={lead.nome}
                  funilAtualId={lead.funil_id}
                  etapaAtualId={lead.etapa_id}
                  onLeadMoved={() => onLeadMoved?.()}
                />
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <EditarLeadDialog lead={lead} onLeadUpdated={onLeadMoved || (() => {})} />
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleAgendaModal}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Próximo compromisso:</p>
                    <p className="font-medium">{proximoCompromisso || "Nenhum agendado"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleTarefaModal}
                    >
                      <CheckSquare className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Próxima tarefa:</p>
                    <p className="font-medium">{proximaTarefa || "Nenhuma pendente"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <AgendaModal
              open={agendaModalOpen}
              onOpenChange={setAgendaModalOpen}
              lead={lead}
              onAgendamentoCriado={() => {
                carregarProximasAtividades();
                onLeadMoved?.();
              }}
            />

            <TarefaModal
              open={tarefaModalOpen}
              onOpenChange={setTarefaModalOpen}
              lead={lead}
              onTarefaCriada={() => {
                carregarProximasAtividades();
                onLeadMoved?.();
              }}
            />

            {lead.company && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md">
                <Building2 className="h-3 w-3" />
                <span>{lead.company}</span>
              </div>
            )}

            {lead.telefone && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{lead.telefone}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-success hover:text-success hover:bg-success/10 transition-all"
                    onClick={abrirConversa}
                    title="Ver histórico de conversas"
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs font-medium">Ver Conversas</span>
                  </Button>
                </div>
              </div>
            )}

            {lead.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1.5 rounded-md">
                <Mail className="h-3 w-3" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}

            {lead.value !== undefined && lead.value > 0 && (
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground font-medium">Valor Estimado</span>
                <Badge className="font-semibold bg-gradient-success text-success-foreground shadow-sm">
                  R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </Badge>
              </div>
            )}

            {lead.source && (
              <Badge variant="outline" className="text-xs font-medium border-primary/20 text-primary">
                <Tag className="h-3 w-3 mr-1" />
                {lead.source}
              </Badge>
            )}

            {/* ✅ CRÍTICO: Passa notes do lead ao LeadComments - Se retroceder, verificar se passa initialNotes */}
            <LeadComments
              leadId={lead.id}
              initialNotes={lead.notes ?? null} // ✅ IMPORTANTE: Passa notes do lead
              onCommentAdded={() => onLeadMoved?.()}
            />
          </div>
        )}

        {/* ✅ Modal de Conversas - Abre popup sem redirecionar */}
        <ConversasModal
          open={conversasModalOpen}
          onOpenChange={setConversasModalOpen}
          lead={lead}
        />
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // 🎯 Otimização: comparação customizada para evitar re-renders desnecessários
  return (
    prevProps.lead.id === nextProps.lead.id &&
    prevProps.lead.nome === nextProps.lead.nome &&
    prevProps.lead.telefone === nextProps.lead.telefone &&
    prevProps.lead.email === nextProps.lead.email &&
    prevProps.lead.value === nextProps.lead.value &&
    prevProps.lead.company === nextProps.lead.company &&
    prevProps.lead.source === nextProps.lead.source &&
    prevProps.lead.funil_id === nextProps.lead.funil_id &&
    prevProps.lead.etapa_id === nextProps.lead.etapa_id &&
    prevProps.isDragging === nextProps.isDragging &&
    JSON.stringify(prevProps.lead.tags) === JSON.stringify(nextProps.lead.tags)
  );
});
