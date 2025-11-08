import React, { useEffect, useState, memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, Trash2, MessageCircle, Building2, Tag, Calendar, CheckSquare, ChevronDown, ChevronUp, MoreVertical, UserPlus } from "lucide-react";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { EditarLeadDialog } from "./EditarLeadDialog";
import { MoverLeadFunilDialog } from "./MoverLeadFunilDialog";
import { LeadComments } from "./LeadComments";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ConversaPopup } from "@/components/leads/ConversaPopup";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

/**
 * âœ… BACKUP ATUALIZADO - 2024-11-01
 * IMPORTANTE: Deve passar initialNotes={lead.notes ?? null} ao LeadComments
 * Se este arquivo retroceder, verificar:
 * 1. Interface LeadCardProps inclui notes?: string | null
 * 2. LeadComments recebe initialNotes={lead.notes ?? null}
 */

interface LeadCardProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
      phone?: string;
    email?: string;
    value?: number;
    company?: string;
    source?: string;
    tags?: string[];
    funil_id?: string;
    etapa_id?: string;
    notes?: string | null;
    responsavel_id?: string | null;
      avatar_url?: string | null;
  };
  onDelete: (leadId: string) => void;
  onLeadMoved?: () => void;
  isDragging?: boolean;
}

export const LeadCard = memo(function LeadCard({ lead, onDelete, onLeadMoved, isDragging: externalIsDragging }: LeadCardProps) {
  const navigate = useNavigate();
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  const [proximoCompromisso, setProximoCompromisso] = useState<string | null>(null);
  const [proximoCompromissoData, setProximoCompromissoData] = useState<string | null>(null);
  const [proximaTarefa, setProximaTarefa] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversaOpen, setConversaOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [responsavelNome, setResponsavelNome] = useState<string | null>(null);
  const [responsavelDialogOpen, setResponsavelDialogOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [novoResponsavel, setNovoResponsavel] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const normalizePhoneBR = (raw?: string): string | null => {
    if (!raw) return null;
    let n = raw.replace(/\D/g, "");
    if (n.startsWith("55")) return n;
    if (n.length === 10 || n.length === 11) return "55" + n;
    if (n.length >= 8 && n.length <= 13) return n.startsWith("55") ? n : "55" + n;
    return "55" + n;
  };

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

  useEffect(() => {
    const fetchAvatar = async () => {
      try {
        // Se jÃ¡ houver avatar_url no lead, usar direto
        if (lead.avatar_url) {
          setAvatarUrl(lead.avatar_url);
          return;
        }

        const rawPhone = lead.telefone || (lead as any)?.phone || "";
        if (!rawPhone) {
          setAvatarUrl(null);
          return;
        }
        const numero = normalizePhoneBR(rawPhone);
        if (!numero) {
          setAvatarUrl(null);
          return;
        }
        const companyId = await getCompanyId();
        const { data, error } = await supabase.functions.invoke('get-profile-picture', {
          body: { number: numero, company_id: companyId }
        });
        if (!error && data?.profilePictureUrl) {
          setAvatarUrl(data.profilePictureUrl);
        } else {
          setAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(lead.nome)}&background=10b981&color=fff&bold=true&size=128`);
        }
      } catch {
        setAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(lead.nome)}&background=10b981&color=fff&bold=true&size=128`);
      }
    };
    fetchAvatar();
  }, [lead.telefone, (lead as any)?.phone, lead.nome, lead.avatar_url]);

  const carregarProximasAtividades = useCallback(async () => {
    try {
      // Carregar prÃ³ximo compromisso
      const { data: compromissos } = await supabase
        .from("compromissos")
        .select("tipo_servico, data_hora_inicio")
        .eq("lead_id", lead.id)
        .gte("data_hora_inicio", new Date().toISOString())
        .order("data_hora_inicio")
        .limit(1);

      if (compromissos?.[0]) {
        const dataFormatada = new Date(compromissos[0].data_hora_inicio).toLocaleDateString('pt-BR');
        const titulo = compromissos[0].tipo_servico || 'Compromisso';
        setProximoCompromisso(`${titulo} - ${dataFormatada}`);
        setProximoCompromissoData(dataFormatada);
      } else {
        setProximoCompromisso(null);
        setProximoCompromissoData(null);
      }

      // Carregar prÃ³xima tarefa
      const { data: tarefas } = await supabase
        .from("tasks")
        .select("title, due_date")
        .eq("lead_id", lead.id)
        .eq("status", "pendente")
        .order("due_date")
        .limit(1);

      if (tarefas?.[0]) {
        setProximaTarefa(
          `${tarefas[0].title} - ${new Date(tarefas[0].due_date).toLocaleDateString('pt-BR')}`
        );
      }
    } catch (error) {
      console.error("Erro ao carregar atividades:", error);
    }
  }, [lead.id]);

  const carregarResponsavel = useCallback(async () => {
    if (!lead.responsavel_id) {
      setResponsavelNome(null);
      return;
    }
    
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", lead.responsavel_id)
        .maybeSingle();
      
      if (profile) {
        setResponsavelNome(profile.full_name || profile.email || "Sem nome");
      }
    } catch (error) {
      console.error("Erro ao carregar responsÃ¡vel:", error);
    }
  }, [lead.responsavel_id]);

  const carregarUsuarios = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", userRole.company_id);

      if (!userRoles || userRoles.length === 0) return;

      const userIds = userRoles.map(ur => ur.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in('id', userIds);

      if (profiles) {
        setUsuarios(profiles);
      }
    } catch (error) {
      console.error("Erro ao carregar usuÃ¡rios:", error);
    }
  }, []);

  const atribuirResponsavel = async () => {
    if (!novoResponsavel) {
      toast.error("Selecione um responsÃ¡vel");
      return;
    }

    try {
      // ðŸ”’ Buscar lead para preservar company_id
      const { data: leadData } = await supabase
        .from("leads")
        .select("company_id")
        .eq("id", lead.id)
        .single();

      const { error } = await supabase
        .from("leads")
        .update({ 
          responsavel_id: novoResponsavel,
          company_id: leadData?.company_id // ðŸ”’ Preservar company_id
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("ResponsÃ¡vel atribuÃ­do com sucesso");
      setResponsavelDialogOpen(false);
      carregarResponsavel();
      onLeadMoved?.();
    } catch (error) {
      console.error("Erro ao atribuir responsÃ¡vel:", error);
      toast.error("Erro ao atribuir responsÃ¡vel");
    }
  };

  useEffect(() => {
    if (lead.id) {
      carregarProximasAtividades();
      carregarResponsavel();
    }
  }, [lead.id, carregarProximasAtividades, carregarResponsavel]);

  useEffect(() => {
    if (responsavelDialogOpen) {
      carregarUsuarios();
    }
  }, [responsavelDialogOpen, carregarUsuarios]);

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
      lead: lead
    }
  });

  const isDragging = externalIsDragging || internalIsDragging;

  // Desabilita o drag quando estiver clicando em botÃµes
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

  const abrirConversa = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lead.telefone) {
      setConversaOpen(true);
      toast.success("Abrindo conversa...");
    } else {
      toast.error("Lead nÃ£o possui telefone cadastrado");
    }
  }, [lead.telefone, lead.nome]);

  const ligarWhatsApp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lead.telefone) {
      const numero = lead.telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${numero}`, "_blank");
    } else {
      toast.error("Lead nÃ£o possui telefone cadastrado");
    }
  }, [lead.telefone]);

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
        {/* Header sempre visÃ­vel */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-start gap-2 flex-1" {...(modifiedListeners as any)}>
            <Avatar className="h-8 w-8">
              <AvatarImage 
                src={avatarUrl || lead.avatar_url || undefined} 
                alt={lead.nome}
                onError={() => {
                  setAvatarUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(lead.nome)}&background=10b981&color=fff&bold=true&size=128`);
                }}
              />
              <AvatarFallback className="bg-primary/10 text-primary">
                {lead.nome && lead.nome.length > 0 ? lead.nome.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground mb-1">{lead.nome}</h4>
              
              {/* ResponsÃ¡vel */}
              {responsavelNome && (
                <div className="flex items-center gap-1 mb-1">
                  <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20">
                    <User className="h-2.5 w-2.5 mr-1" />
                    {responsavelNome}
                  </Badge>
                </div>
              )}
              
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

          {/* AÃ§Ãµes (menu) + agenda + expandir */}
          <div className="flex items-center gap-1">
            {/* Data da Agenda - Mostrar ao lado do botÃ£o apagar */}
            {proximoCompromissoData && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs bg-success/10 border-success/20 text-success cursor-pointer">
                      <Calendar className="h-2.5 w-2.5 mr-1" />
                      {proximoCompromissoData}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{proximoCompromisso}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => { e.stopPropagation(); }}
                  onMouseDown={(e) => { e.stopPropagation(); }}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>Editar lead</DropdownMenuItem>
                <DropdownMenuItem onClick={abrirConversa} disabled={!lead.telefone}>Ver conversas</DropdownMenuItem>
                <DropdownMenuItem onClick={ligarWhatsApp} disabled={!lead.telefone}>Ligar no WhatsApp</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResponsavelDialogOpen(true)}>
                  <UserPlus className="h-3 w-3 mr-2" />
                  Atribuir responsÃ¡vel
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { handleDelete(e as any); }}>Excluir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

        {/* ConteÃºdo expandido */}
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
                    <p>PrÃ³ximo compromisso:</p>
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
                    <p>PrÃ³xima tarefa:</p>
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
                    title="Ver histÃ³rico de conversas"
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

            {/* âœ… CRÃTICO: Passa notes do lead ao LeadComments - Se retroceder, verificar se passa initialNotes */}
            <LeadComments
              leadId={lead.id}
              initialNotes={lead.notes ?? null} // âœ… IMPORTANTE: Passa notes do lead
              onCommentAdded={() => onLeadMoved?.()}
            />
          </div>
        )}

        {/* Popup de Conversa (reutilizado do menu Leads) */}
        <ConversaPopup
          open={conversaOpen}
          onOpenChange={setConversaOpen}
          leadId={lead.id}
          leadName={lead.nome}
          leadPhone={lead.telefone}
        />

        {/* Dialogo de ediÃ§Ã£o (controlado pelo menu) */}
        <EditarLeadDialog
          lead={lead}
          onLeadUpdated={onLeadMoved || (() => {})}
          open={editOpen}
          onOpenChange={setEditOpen}
        />

        {/* Dialog de atribuir responsÃ¡vel */}
        <Dialog open={responsavelDialogOpen} onOpenChange={setResponsavelDialogOpen}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Atribuir ResponsÃ¡vel</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <Select value={novoResponsavel} onValueChange={setNovoResponsavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um responsÃ¡vel" />
                </SelectTrigger>
                <SelectContent>
                  {usuarios.map((usuario) => (
                    <SelectItem key={usuario.id} value={usuario.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {(usuario.full_name || usuario.email).charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{usuario.full_name || usuario.email}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setResponsavelDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={atribuirResponsavel}
                  disabled={!novoResponsavel}
                  className="flex-1"
                >
                  Atribuir
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // ðŸŽ¯ OtimizaÃ§Ã£o: comparaÃ§Ã£o customizada para evitar re-renders desnecessÃ¡rios
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
    prevProps.lead.responsavel_id === nextProps.lead.responsavel_id &&
    prevProps.isDragging === nextProps.isDragging &&
    JSON.stringify(prevProps.lead.tags) === JSON.stringify(nextProps.lead.tags)
  );
});
