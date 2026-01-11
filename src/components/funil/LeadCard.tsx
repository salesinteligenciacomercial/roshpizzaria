import React, { useEffect, useState, memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, Trash2, MessageCircle, Building2, Tag, Calendar, CheckSquare, ChevronDown, ChevronUp, MoreVertical, UserPlus, Paperclip, Clock } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { LeadAttachments } from "@/components/leads/LeadAttachments";

/**
 * ✅ BACKUP ATUALIZADO - 2024-11-01
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
    created_at?: string;
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
  const [responsaveisNomes, setResponsaveisNomes] = useState<string[]>([]);
  const [responsavelDialogOpen, setResponsavelDialogOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [responsaveisSelecionados, setResponsaveisSelecionados] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [attachmentsCount, setAttachmentsCount] = useState(0);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [diasNoFunil, setDiasNoFunil] = useState<number | null>(null);
  const [creatorColor, setCreatorColor] = useState<string>('#6366f1');
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Função para gerar cor consistente baseada no ID do usuário
  const generateColorFromId = (id: string): string => {
    const colors = [
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#d946ef', // fuchsia
      '#ec4899', // pink
      '#f43f5e', // rose
      '#ef4444', // red
      '#f97316', // orange
      '#eab308', // yellow
      '#84cc16', // lime
      '#22c55e', // green
      '#14b8a6', // teal
      '#06b6d4', // cyan
      '#0ea5e9', // sky
      '#3b82f6', // blue
    ];
    
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

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
        // Se já houver avatar_url no lead, usar direto
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
      // Carregar próximo compromisso
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
          `${tarefas[0].title} - ${new Date(tarefas[0].due_date).toLocaleDateString('pt-BR')}`
        );
      }
    } catch (error) {
      console.error("Erro ao carregar atividades:", error);
    }
  }, [lead.id]);

  const carregarResponsaveis = useCallback(async () => {
    try {
      const { data: leadData } = await supabase
        .from("leads")
        .select("responsavel_id, responsaveis")
        .eq("id", lead.id)
        .maybeSingle();
      
      if (!leadData) {
        setResponsaveisNomes([]);
        setResponsaveisSelecionados([]);
        return;
      }
      
      const todosResponsaveis: string[] = [];
      if (leadData.responsavel_id) {
        todosResponsaveis.push(leadData.responsavel_id);
      }
      if (leadData.responsaveis && Array.isArray(leadData.responsaveis)) {
        leadData.responsaveis.forEach((id: string) => {
          if (!todosResponsaveis.includes(id)) {
            todosResponsaveis.push(id);
          }
        });
      }
      
      setResponsaveisSelecionados(todosResponsaveis);
      
      if (todosResponsaveis.length === 0) {
        setResponsaveisNomes([]);
        return;
      }
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", todosResponsaveis);
      
      if (profiles) {
        const nomes = profiles.map(p => p.full_name || p.email || "Sem nome");
        setResponsaveisNomes(nomes);
      }
    } catch (error) {
      console.error("Erro ao carregar responsáveis:", error);
    }
  }, [lead.id]);

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
      console.error("Erro ao carregar usuários:", error);
    }
  }, []);

  const atribuirResponsaveis = async () => {
    if (responsaveisSelecionados.length === 0) {
      toast.error("Selecione pelo menos um responsável");
      return;
    }

    try {
      const { data: leadData } = await supabase
        .from("leads")
        .select("company_id")
        .eq("id", lead.id)
        .single();

      const { error } = await supabase
        .from("leads")
        .update({ 
          responsaveis: responsaveisSelecionados,
          company_id: leadData?.company_id
        })
        .eq("id", lead.id);

      if (error) throw error;

      toast.success(`${responsaveisSelecionados.length} responsável(is) atribuído(s) com sucesso`);
      setResponsavelDialogOpen(false);
      carregarResponsaveis();
      onLeadMoved?.();
    } catch (error) {
      console.error("Erro ao atribuir responsáveis:", error);
      toast.error("Erro ao atribuir responsáveis");
    }
  };
  
  const toggleResponsavel = (userId: string) => {
    setResponsaveisSelecionados(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  // Carregar contagem de anexos
  const carregarAttachmentsCount = useCallback(async () => {
    try {
      const companyId = await getCompanyId();
      if (!companyId) return;
      setUserCompanyId(companyId);
      
      const { count, error } = await supabase
        .from("lead_attachments")
        .select("*", { count: "exact", head: true })
        .eq("lead_id", lead.id)
        .eq("company_id", companyId);
      
      if (!error && count !== null) {
        setAttachmentsCount(count);
      }
    } catch (error) {
      console.error("Erro ao carregar anexos:", error);
    }
  }, [lead.id]);

  // Calcular dias no funil
  useEffect(() => {
    const calcularDiasNoFunil = () => {
      if (lead.created_at) {
        const dataEntrada = new Date(lead.created_at);
        const hoje = new Date();
        const diffTime = Math.abs(hoje.getTime() - dataEntrada.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        setDiasNoFunil(diffDays);
      }
    };
    calcularDiasNoFunil();
  }, [lead.created_at]);

  // Carregar informações do criador do lead
  useEffect(() => {
    const carregarCriador = async () => {
      try {
        const { data: leadData } = await supabase
          .from("leads")
          .select("owner_id")
          .eq("id", lead.id)
          .maybeSingle();
        
        if (leadData?.owner_id) {
          setCreatorColor(generateColorFromId(leadData.owner_id));
          
          // Buscar nome do criador
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", leadData.owner_id)
            .maybeSingle();
          
          if (profile) {
            setCreatorName(profile.full_name || profile.email || null);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar criador:", error);
      }
    };
    
    carregarCriador();
  }, [lead.id]);

  useEffect(() => {
    if (lead.id) {
      carregarProximasAtividades();
      carregarResponsaveis();
      carregarAttachmentsCount();
    }
  }, [lead.id, carregarProximasAtividades, carregarResponsaveis, carregarAttachmentsCount]);

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

  const abrirConversa = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lead.telefone) {
      setConversaOpen(true);
      toast.success("Abrindo conversa...");
    } else {
      toast.error("Lead não possui telefone cadastrado");
    }
  }, [lead.telefone, lead.nome]);

  const ligarWhatsApp = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (lead.telefone) {
      const numero = lead.telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${numero}`, "_blank");
    } else {
      toast.error("Lead não possui telefone cadastrado");
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
      style={{
        ...style,
        borderLeftWidth: '4px',
        borderLeftColor: creatorColor,
      }}
      {...attributes}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }
      }}
      className={`group relative p-4 mb-3 cursor-grab active:cursor-grabbing border-0 shadow-card hover:shadow-lg transition-all duration-300 bg-card overflow-hidden min-h-[120px] ${
        isDragging ? 'shadow-2xl scale-105 z-50 ring-2 ring-primary/50 bg-gradient-to-br from-card to-primary/5' : ''
      }`}
    >
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Indicador visual do criador no topo direito - SEMPRE VISÍVEL */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className="absolute top-2 right-2 w-4 h-4 rounded-full cursor-default shadow-sm border border-white/50"
              style={{ backgroundColor: creatorColor }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Criado por: <span className="font-medium">{creatorName || 'Não identificado'}</span></p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="relative space-y-2">
        {/* Header sempre visível */}
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
              
              {/* Responsáveis (múltiplos) */}
              {responsaveisNomes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mb-1">
                  {responsaveisNomes.map((nome, index) => (
                    <Badge key={index} variant="outline" className="text-xs bg-primary/5 border-primary/20">
                      <User className="h-2.5 w-2.5 mr-1" />
                      {nome}
                    </Badge>
                  ))}
                </div>
              )}
              
              {lead.tags && lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <TooltipProvider key={tag} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs max-w-[60px] cursor-default hover:max-w-none transition-all">
                            <Tag className="h-2.5 w-2.5 mr-1 flex-shrink-0" />
                            <span className="truncate">{tag}</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="z-[9999]">
                          <p className="font-medium">{tag}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ações (menu) + agenda + expandir */}
          <div className="flex items-center gap-1">
            {/* Dias no funil */}
            {diasNoFunil !== null && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className={`text-xs cursor-default ${
                        diasNoFunil <= 7 
                          ? 'bg-success/10 border-success/20 text-success' 
                          : diasNoFunil <= 30 
                            ? 'bg-warning/10 border-warning/20 text-warning' 
                            : 'bg-destructive/10 border-destructive/20 text-destructive'
                      }`}
                    >
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {diasNoFunil}d
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">
                      {diasNoFunil === 0 
                        ? 'Entrou hoje no funil' 
                        : diasNoFunil === 1 
                          ? '1 dia no funil' 
                          : `${diasNoFunil} dias no funil`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Indicador de anexos/prontuário */}
            {attachmentsCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-primary/10 border-primary/20 text-primary cursor-pointer hover:bg-primary/20"
                      onClick={(e) => { e.stopPropagation(); setAttachmentsOpen(true); }}
                    >
                      <Paperclip className="h-2.5 w-2.5 mr-1" />
                      {attachmentsCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-medium">{attachmentsCount} arquivo(s) no prontuário</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Data da Agenda - Mostrar ao lado do botão apagar */}
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
                  Atribuir responsáveis
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

        {/* Valor Estimado + Botões de ação - NA MESMA LINHA */}
        <div 
          className="flex items-center justify-between pt-2 border-t border-border/50"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Valor Estimado à esquerda */}
          {lead.value !== undefined && lead.value > 0 ? (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium">Valor Estimado</span>
              <Badge className="font-semibold bg-gradient-success text-success-foreground shadow-sm mt-0.5 w-fit text-xs">
                R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          ) : (
            <div />
          )}

          {/* Botões de ação à direita */}
          <div className="flex items-center gap-0.5">
            {/* Botão Ver Conversas */}
            {lead.telefone && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-success hover:text-success hover:bg-success/10 transition-all"
                      onClick={abrirConversa}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ver histórico de conversas</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <div onClick={(e) => e.stopPropagation()}>
              <MoverLeadFunilDialog
                leadId={lead.id}
                leadNome={lead.nome}
                funilAtualId={lead.funil_id}
                etapaAtualId={lead.etapa_id}
                onLeadMoved={() => onLeadMoved?.()}
              />
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleAgendaModal}
                  >
                    <Calendar className="h-3.5 w-3.5" />
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
                    className="h-7 w-7"
                    onClick={handleTarefaModal}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
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
              className="h-7 w-7 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={handleDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>


        {/* Conteúdo expandido */}
        {isExpanded && (
          <div className="space-y-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
            {/* Botões adicionais */}
            <div
              className="flex gap-1 flex-wrap"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <EditarLeadDialog lead={lead} onLeadUpdated={onLeadMoved || (() => {})} />
              </div>
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

            {/* Informações adicionais - só no modo expandido */}
            {lead.company && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md">
                <Building2 className="h-3 w-3" />
                <span>{lead.company}</span>
              </div>
            )}

            {lead.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1.5 rounded-md">
                <Mail className="h-3 w-3" />
                <span className="truncate">{lead.email}</span>
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

        {/* Popup de Conversa (reutilizado do menu Leads) */}
        <ConversaPopup
          open={conversaOpen}
          onOpenChange={setConversaOpen}
          leadId={lead.id}
          leadName={lead.nome}
          leadPhone={lead.telefone}
        />

        {/* Dialogo de edição (controlado pelo menu) */}
        <EditarLeadDialog
          lead={lead}
          onLeadUpdated={onLeadMoved || (() => {})}
          open={editOpen}
          onOpenChange={setEditOpen}
        />

        {/* Dialog de atribuir responsáveis (múltiplos) */}
        <Dialog open={responsavelDialogOpen} onOpenChange={setResponsavelDialogOpen}>
          <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Atribuir Responsáveis</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {usuarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum usuário disponível</p>
                ) : (
                  usuarios.map((usuario) => (
                    <div 
                      key={usuario.id} 
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleResponsavel(usuario.id)}
                    >
                      <Checkbox
                        checked={responsaveisSelecionados.includes(usuario.id)}
                        onCheckedChange={() => toggleResponsavel(usuario.id)}
                      />
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(usuario.full_name || usuario.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{usuario.full_name || usuario.email}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setResponsavelDialogOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={atribuirResponsaveis}
                  disabled={responsaveisSelecionados.length === 0}
                  className="flex-1"
                >
                  Atribuir {responsaveisSelecionados.length > 0 && `(${responsaveisSelecionados.length})`}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Anexos/Prontuário */}
        {attachmentsOpen && userCompanyId && (
          <LeadAttachments
            open={attachmentsOpen}
            onOpenChange={setAttachmentsOpen}
            leadId={lead.id}
            companyId={userCompanyId}
            leadName={lead.nome}
          />
        )}
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
    prevProps.lead.responsavel_id === nextProps.lead.responsavel_id &&
    prevProps.isDragging === nextProps.isDragging &&
    JSON.stringify(prevProps.lead.tags) === JSON.stringify(nextProps.lead.tags)
  );
});
