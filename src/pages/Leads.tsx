import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Upload, Search, Tag, MessageSquare, Phone, Mail, User, Building2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadActionsDialog } from "@/components/leads/LeadActionsDialog";
import { LeadQuickActions } from "@/components/leads/LeadQuickActions";
import { LeadTagsDialog } from "@/components/leads/LeadTagsDialog";
import { TagsManager } from "@/components/leads/TagsManager";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
import { EditarLeadDialog } from "@/components/funil/EditarLeadDialog";
import { ImportarLeadsDialog } from "@/components/funil/ImportarLeadsDialog";
import { ConversaPopup } from "@/components/leads/ConversaPopup";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { formatPhoneNumber } from "@/utils/phoneFormatter";
import { useNavigate } from "react-router-dom";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  telefone?: string | null;
  company: string | null;
  company_id?: string | null;
  source: string | null;
  status: string;
  stage: string;
  value: number;
  created_at: string;
  tags?: string[];
  cpf?: string | null;
  notes?: string | null;
  funil_id?: string | null;
  etapa_id?: string | null;
  responsavel_id?: string | null;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [leadParaEditar, setLeadParaEditar] = useState<Lead | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [leadParaExcluir, setLeadParaExcluir] = useState<Lead | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [leadParaConversa, setLeadParaConversa] = useState<Lead | null>(null);
  const [showConversaDialog, setShowConversaDialog] = useState(false);
  const [leadParaAgenda, setLeadParaAgenda] = useState<Lead | null>(null);
  const [showAgendaDialog, setShowAgendaDialog] = useState(false);
  const [leadParaTarefa, setLeadParaTarefa] = useState<Lead | null>(null);
  const [showTarefaDialog, setShowTarefaDialog] = useState(false);
  const [leadAvatars, setLeadAvatars] = useState<Record<string, string>>({});
  const PAGE_SIZE = 50; // Carregar 50 leads por vez
  const { toast } = useToast();
  const navigate = useNavigate();
  const observerRef = useRef<HTMLDivElement>(null);
  const companyIdRef = useRef<string | null>(null); // Cache de company_id
  const avatarFetchingRef = useRef<Set<string>>(new Set()); // Controle de fetching

  const abrirConversa = (lead: Lead) => {
    setLeadParaConversa(lead);
    setShowConversaDialog(true);
  };

  const abrirAgenda = (lead: Lead) => {
    setLeadParaAgenda(lead);
    setShowAgendaDialog(true);
  };

  const abrirTarefa = (lead: Lead) => {
    setLeadParaTarefa(lead);
    setShowTarefaDialog(true);
  };

  // Sistema de eventos globais para comunicação entre módulos
  const { emitGlobalEvent } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: (data) => {
        console.log('🌍 [Leads] Lead atualizado via evento global:', data);
        setLeads(prev => prev.map(lead => {
          if (lead.id === data.id) {
            return { ...lead, ...data };
          }
          return lead;
        }));
      },
      onTaskCreated: (data) => {
        console.log('🌍 [Leads] Nova tarefa criada, verificar se vinculada ao lead:', data);
        // Se uma tarefa foi criada vinculada a um lead, podemos atualizar o status
        if (data.lead_id) {
          // Opcional: marcar lead como tendo tarefas ativas
        }
      },
      onMeetingScheduled: (data) => {
        console.log('🌍 [Leads] Reunião agendada, verificar se vinculada ao lead:', data);
        // Se uma reunião foi agendada vinculada a um lead, podemos atualizar o status
        if (data.lead_id) {
          // Opcional: marcar lead como tendo reunião agendada
        }
      },
      onFunnelStageChanged: (data) => {
        console.log('🌍 [Leads] Lead movido no funil:', data);
        // Atualizar lead com nova etapa
        setLeads(prev => prev.map(lead => {
          if (lead.id === data.leadId) {
            return {
              ...lead,
              stage: data.newStage
            };
          }
          return lead;
        }));
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });

  // Integrar sincronização de leads em tempo real
  useLeadsSync({
    onInsert: (newLead) => {
      console.log('📡 [Leads] Novo lead adicionado via sync:', newLead);
      setLeads(prev => [newLead, ...prev]);
    },
    onUpdate: (updatedLead) => {
      console.log('📡 [Leads] Lead atualizado via sync:', updatedLead);
      setLeads(prev => prev.map(lead => 
        lead.id === updatedLead.id ? updatedLead : lead
      ));
    },
    onDelete: (deletedLead) => {
      console.log('📡 [Leads] Lead removido via sync:', deletedLead);
      setLeads(prev => prev.filter(lead => lead.id !== deletedLead.id));
    },
    showNotifications: true
  });

  useEffect(() => {
    carregarCompanyIdELeads();
  }, []);

  const carregarCompanyIdELeads = async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      
      if (!userId) {
        toast({
          variant: "destructive",
          title: "Erro de autenticação",
          description: "Você precisa estar autenticado para gerenciar leads.",
        });
        return;
      }

      const { data: role, error: roleError } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError || !role?.company_id) {
        toast({
          variant: "destructive",
          title: "Empresa não encontrada",
          description: "Você precisa estar vinculado a uma empresa para gerenciar leads.",
        });
        return;
      }

      companyIdRef.current = role.company_id;
      carregarLeads();
    } catch (error) {
      console.error('Erro ao carregar company_id:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações de empresa.",
      });
    }
  };

  useEffect(() => {
    filterLeads();
  }, [searchTerm, selectedStatus, selectedTag, leads]);

  const carregarLeads = async (reset = false) => {
    if (loading || !companyIdRef.current) return;

    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Query base com filtro de company_id e campos otimizados
      let query = supabase
        .from("leads")
        .select("id, name, email, phone, telefone, company, company_id, source, status, stage, value, created_at, tags, cpf, notes, funil_id, etapa_id, responsavel_id")
        .eq('company_id', companyIdRef.current)
        .order("created_at", { ascending: false });

      // Aplicar filtros server-side
      if (selectedStatus !== "all") {
        query = query.eq('status', selectedStatus);
      }

      // Busca server-side
      if (searchTerm) {
        const searchTrimmed = searchTerm.trim();
        
        // Busca por valor com operadores (>=, <=, >, <, =)
        const valueOperatorMatch = searchTrimmed.match(/^([><=]{1,2})(\d+(?:\.\d+)?)$/);
        
        if (valueOperatorMatch) {
          const operator = valueOperatorMatch[1];
          const value = parseFloat(valueOperatorMatch[2]);
          
          if (!isNaN(value) && isFinite(value)) {
            switch (operator) {
              case '>=': query = query.gte('value', value); break;
              case '<=': query = query.lte('value', value); break;
              case '>': query = query.gt('value', value); break;
              case '<': query = query.lt('value', value); break;
              case '=': query = query.eq('value', value); break;
            }
          }
        } else {
          // Busca textual - usar or com ilike para campos text
          query = query.or(
            `name.ilike.%${searchTrimmed}%,` +
            `email.ilike.%${searchTrimmed}%,` +
            `phone.ilike.%${searchTrimmed}%,` +
            `telefone.ilike.%${searchTrimmed}%,` +
            `company.ilike.%${searchTrimmed}%,` +
            `cpf.ilike.%${searchTrimmed}%,` +
            `source.ilike.%${searchTrimmed}%,` +
            `notes.ilike.%${searchTrimmed}%`
          );
        }
      }

      // Paginação
      query = query.range(from, to);

      const { data, error } = await query;

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar leads",
          description: error.message,
        });
        return;
      }

      // Prevenir duplicatas
      const newLeads = data || [];
      const existingIds = new Set(leads.map(l => l.id));
      const uniqueNewLeads = newLeads.filter(lead => !existingIds.has(lead.id));

      if (reset) {
        setLeads(newLeads);
        setPage(0);
        setHasMore(newLeads.length === PAGE_SIZE);
      } else {
        setLeads(prev => [...prev, ...uniqueNewLeads]);
        setPage(prev => prev + 1);
        setHasMore(newLeads.length === PAGE_SIZE);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetAndLoadLeads = useCallback(async () => {
    setPage(0);
    setHasMore(true);
    await carregarLeads(true);
  }, []);

  // Intersection Observer para carregamento infinito
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !loading) {
          carregarLeads();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px'
      }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observer.unobserve(observerRef.current);
      }
    };
  }, [hasMore, loading]);

  // Reset quando filtros mudam
  useEffect(() => {
    if (!companyIdRef.current) return;
    
    const timeoutId = setTimeout(() => {
      resetAndLoadLeads();
    }, 500); // Debounce de 500ms para busca

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedStatus, selectedTag, resetAndLoadLeads]);

  const filterLeads = () => {
    let filtered = leads;

    const normalizeString = (s: string | null | undefined) =>
      (s || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const onlyDigits = (s: string | null | undefined) =>
      (s || "").toString().replace(/\D/g, "");

    if (searchTerm) {
      const searchTrimmed = searchTerm.trim();
      const searchNormalized = normalizeString(searchTerm);
      const searchDigits = onlyDigits(searchTerm);

      filtered = filtered.filter((lead) => {
        const leadName = (lead.name || (lead as any)?.nome || "") as string;
        const leadEmail = lead.email || "";
        const leadPhone = lead.phone || "";
        const leadTelefone = lead.telefone || "";
        const leadCompany = lead.company || "";
        const leadCpf = lead.cpf || "";
        const leadSource = lead.source || "";
        const leadNotes = lead.notes || "";

        const textMatch =
          normalizeString(leadName).includes(searchNormalized) ||
          normalizeString(leadEmail).includes(searchNormalized) ||
          normalizeString(leadCompany).includes(searchNormalized) ||
          normalizeString(leadSource).includes(searchNormalized) ||
          lead.value.toString().includes(searchTerm) ||
          new Date(lead.created_at).toLocaleDateString('pt-BR').includes(searchTerm) ||
          normalizeString(leadNotes).includes(searchNormalized);

        const digitsMatch =
          searchDigits.length > 0 &&
          (onlyDigits(leadPhone).includes(searchDigits) ||
            onlyDigits(leadTelefone).includes(searchDigits) ||
            onlyDigits(leadCpf).includes(searchDigits));

        const valueMatch = (() => {
          if (!searchTrimmed.match(/^[<>=]\d+(\.\d+)?$/)) return false;
          const operator = searchTrimmed[0];
          const value = parseFloat(searchTrimmed.slice(1));
          switch (operator) {
            case '>':
              return lead.value > value;
            case '<':
              return lead.value < value;
            case '=':
              return lead.value === value;
            default:
              return false;
          }
        })();

        return textMatch || digitsMatch || valueMatch;
      });
    }

    if (selectedStatus !== "all") {
      filtered = filtered.filter((lead) => lead.status === selectedStatus);
    }

    if (selectedTag) {
      filtered = filtered.filter((lead) =>
        lead.tags?.includes(selectedTag)
      );
    }

    setFilteredLeads(filtered);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      novo: "bg-blue-500",
      contato: "bg-yellow-500",
      qualificado: "bg-green-500",
      proposta: "bg-purple-500",
      ganho: "bg-emerald-500",
      perdido: "bg-red-500",
    };
    return colors[status] || "bg-gray-500";
  };

  const exportarLeads = () => {
    try {
      if (filteredLeads.length === 0) {
        toast({
          variant: "destructive",
          title: "Nenhum lead para exportar",
          description: "Aplique filtros ou adicione leads antes de exportar.",
        });
        return;
      }

      // Headers do CSV
      const headers = [
        "Nome",
        "Email",
        "Telefone",
        "CPF",
        "Empresa",
        "Origem",
        "Status",
        "Valor",
        "Tags",
        "Observações",
        "Data de Criação"
      ];

      // Converter leads para linhas CSV
      const csvRows = filteredLeads.map(lead => [
        lead.name,
        lead.email || "",
        formatPhoneNumber(lead.phone || lead.telefone || ""),
        lead.cpf || "",
        lead.company || "",
        lead.source || "",
        lead.status,
        lead.value.toString(),
        lead.tags ? lead.tags.join(";") : "",
        lead.notes || "",
        new Date(lead.created_at).toLocaleDateString('pt-BR')
      ]);

      // Criar conteúdo CSV
      const csvContent = [
        headers.join(","),
        ...csvRows.map(row =>
          row.map(field => {
            // Escapar campos que contenham vírgulas ou aspas
            if (field.includes(",") || field.includes('"') || field.includes("\n")) {
              return `"${field.replace(/"/g, '""')}"`;
            }
            return field;
          }).join(",")
        )
      ].join("\n");

      // Criar e baixar arquivo
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute("download", `leads_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Exportação concluída",
        description: `${filteredLeads.length} leads exportados com sucesso.`,
      });

    } catch (error) {
      console.error("Erro ao exportar leads:", error);
      toast({
        variant: "destructive",
        title: "Erro na exportação",
        description: "Não foi possível exportar os leads. Tente novamente.",
      });
    }
  };

  const handleEditarLead = (lead: Lead) => {
    setLeadParaEditar(lead);
    setShowEditDialog(true);
  };

  const handleExcluirLead = (lead: Lead) => {
    setLeadParaExcluir(lead);
    setShowDeleteDialog(true);
  };

  const confirmarExclusao = async () => {
    if (!leadParaExcluir || !companyIdRef.current) return;

    try {
      // Validar company_id antes de excluir
      const { data: leadData } = await supabase
        .from("leads")
        .select("company_id")
        .eq("id", leadParaExcluir.id)
        .single();

      if (leadData?.company_id !== companyIdRef.current) {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "Você não tem permissão para excluir este lead.",
        });
        return;
      }

      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadParaExcluir.id)
        .eq("company_id", companyIdRef.current);

      if (error) {
        throw error;
      }

      toast({
        title: "Lead excluído",
        description: `O lead "${leadParaExcluir.name}" foi excluído com sucesso.`,
      });

      setLeads(prev => prev.filter(lead => lead.id !== leadParaExcluir.id));
      setLeadParaExcluir(null);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      toast({
        variant: "destructive",
        title: "Erro ao excluir lead",
        description: "Não foi possível excluir o lead. Tente novamente.",
      });
    }
  };

  // Funções de cache de avatar
  const getCachedAvatar = (leadId: string): string | null => {
    try {
      const cached = localStorage.getItem(`avatar_${leadId}`);
      if (!cached) return null;
      
      const { url, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      
      // Cache válido por 24 horas
      if (age < 24 * 60 * 60 * 1000) {
        return url;
      }
      
      localStorage.removeItem(`avatar_${leadId}`);
      return null;
    } catch {
      return null;
    }
  };

  const setCachedAvatar = (leadId: string, url: string) => {
    try {
      localStorage.setItem(`avatar_${leadId}`, JSON.stringify({
        url,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Erro ao salvar avatar no cache:', error);
    }
  };

  // Função para buscar foto de perfil do WhatsApp com retry e timeout
  const buscarFotoPerfil = async (lead: Lead, retryCount = 0): Promise<void> => {
    const telefone = lead.phone || lead.telefone;
    if (!telefone) return;

    // Evitar múltiplos fetches simultâneos do mesmo lead
    if (avatarFetchingRef.current.has(lead.id)) return;
    avatarFetchingRef.current.add(lead.id);

    try {
      // 1. Verificar cache de memória
      if (leadAvatars[lead.id]) return;

      // 2. Verificar cache do localStorage
      const cachedUrl = getCachedAvatar(lead.id);
      if (cachedUrl) {
        setLeadAvatars(prev => ({ ...prev, [lead.id]: cachedUrl }));
        return;
      }

      // 3. Buscar do WhatsApp com timeout de 5s
      const telefoneNormalizado = telefone.replace(/\D/g, "");
      const companyId = lead.company_id || companyIdRef.current;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      const fetchPromise = supabase.functions.invoke('get-profile-picture', {
        body: { number: telefoneNormalizado, company_id: companyId }
      });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!error && data?.profilePictureUrl) {
        setLeadAvatars(prev => ({ ...prev, [lead.id]: data.profilePictureUrl }));
        setCachedAvatar(lead.id, data.profilePictureUrl);
      } else {
        throw new Error('Falha ao buscar avatar');
      }
    } catch (error) {
      const isTimeout = error instanceof Error && error.message === 'Timeout';
      
      // Retry automático (máx 2 tentativas, exceto timeout)
      if (!isTimeout && retryCount < 2) {
        console.log(`🔄 Retry ${retryCount + 1}/2 para avatar do lead ${lead.id}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return buscarFotoPerfil(lead, retryCount + 1);
      }

      // Fallback para UI Avatars
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=128&bold=true`;
      setLeadAvatars(prev => ({ ...prev, [lead.id]: fallbackUrl }));
      setCachedAvatar(lead.id, fallbackUrl);
    } finally {
      avatarFetchingRef.current.delete(lead.id);
    }
  };

  // Buscar fotos de perfil de forma otimizada (debounce + espaçamento)
  useEffect(() => {
    if (leads.length === 0) return;

    const timeoutId = setTimeout(() => {
      leads.forEach((lead, index) => {
        if ((lead.phone || lead.telefone) && !leadAvatars[lead.id] && !avatarFetchingRef.current.has(lead.id)) {
          // Espaçar requisições em 100ms para evitar sobrecarga
          setTimeout(() => buscarFotoPerfil(lead), index * 100);
        }
      });
    }, 500); // Debounce de 500ms

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]);

  // Função para obter avatar do lead (prioridade: Memória > Cache > Fallback)
  const getLeadAvatar = (lead: Lead): string => {
    // 1. Avatar em memória
    if (leadAvatars[lead.id]) {
      return leadAvatars[lead.id];
    }
    
    // 2. Tentar cache do localStorage
    const cachedUrl = getCachedAvatar(lead.id);
    if (cachedUrl) {
      setLeadAvatars(prev => ({ ...prev, [lead.id]: cachedUrl }));
      return cachedUrl;
    }
    
    // 3. Fallback garantido
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=128&bold=true`;
  };

  // Função para obter iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leads</h1>
          <p className="text-muted-foreground">
            Gerencie todos os seus leads em um só lugar
          </p>
        </div>
        <div className="flex gap-2">
          <TagsManager
            onTagSelected={setSelectedTag}
            selectedTag={selectedTag}
          />
          <Button variant="outline" onClick={exportarLeads}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <ImportarLeadsDialog onLeadsImported={carregarLeads} />
          <NovoLeadDialog onLeadCreated={carregarLeads} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone, empresa, CPF, origem, valor (>=1000, <=500, >100, <50, =200) ou observações..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedStatus === "all" ? "default" : "outline"}
              onClick={() => setSelectedStatus("all")}
            >
              Todos
            </Button>
            <Button
              variant={selectedStatus === "novo" ? "default" : "outline"}
              onClick={() => setSelectedStatus("novo")}
            >
              Novos
            </Button>
            <Button
              variant={selectedStatus === "qualificado" ? "default" : "outline"}
              onClick={() => setSelectedStatus("qualificado")}
            >
              Qualificados
            </Button>
          </div>
        </div>

        {/* Filtro ativo de tag */}
        {selectedTag && (
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Tag className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Filtrando por tag:</span>
            <Badge variant="secondary" className="gap-1">
              {selectedTag}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectedTag(null)}
            >
              Limpar filtro
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {filteredLeads.map((lead) => (
          <Card key={lead.id} className="transition-all hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage 
                        src={getLeadAvatar(lead)} 
                        alt={lead.name}
                        onError={(e) => {
                          // Fallback se a imagem não carregar
                          const target = e.target as HTMLImageElement;
                          target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=128&bold=true`;
                        }}
                      />
                      <AvatarFallback>
                        {getInitials(lead.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-3 flex-1">
                    <h3 className="text-lg font-semibold">{lead.name}</h3>
                    <Badge className={getStatusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                    {lead.source && (
                      <Badge variant="outline">
                        <Tag className="mr-1 h-3 w-3" />
                        {lead.source}
                      </Badge>
                    )}
                    </div>
                  </div>
                  
                  {lead.tags && lead.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {lead.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
                    {lead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {lead.email}
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {lead.phone}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 ml-2 text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10 transition-all"
                          onClick={() => abrirConversa(lead)}
                          title="Abrir Conversa no WhatsApp"
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" />
                          <span className="text-xs font-medium">WhatsApp</span>
                        </Button>
                      </div>
                    )}
                    {lead.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="font-medium">{lead.company}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-xl font-bold text-primary">
                    R$ {Number(lead.value).toLocaleString("pt-BR")}
                  </div>
                  <div className="flex gap-2">
                    <LeadQuickActions 
                      leadId={lead.id} 
                      leadName={lead.name} 
                      leadPhone={lead.phone || lead.telefone || undefined}
                      onEdit={() => handleEditarLead(lead)}
                      onDelete={() => handleExcluirLead(lead)}
                      onOpenConversa={() => abrirConversa(lead)}
                      onOpenAgenda={() => abrirAgenda(lead)}
                      onOpenTarefa={() => abrirTarefa(lead)}
                    />
                    <LeadTagsDialog 
                      leadId={lead.id}
                      currentTags={lead.tags}
                      onTagsUpdated={carregarLeads}
                      triggerButton={
                        <Button variant="outline" size="sm">
                          <Tag className="h-4 w-4 mr-2" />
                          Tags
                        </Button>
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredLeads.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Nenhum lead encontrado</p>
          </CardContent>
        </Card>
      )}

      {/* Indicador de carregamento e observer para scroll infinito */}
      <div ref={observerRef} className="flex justify-center py-4">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Carregando leads...
          </div>
        )}
        {!loading && hasMore && leads.length > 0 && (
          <div className="text-muted-foreground text-sm">
            Role para baixo para carregar mais leads
          </div>
        )}
        {!hasMore && leads.length > 0 && (
          <div className="text-muted-foreground text-sm">
            Todos os {leads.length} leads foram carregados
          </div>
        )}
      </div>

      {/* Dialog de Editar Lead */}
      {leadParaEditar && (
        <EditarLeadDialog
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setLeadParaEditar(null);
            }
          }}
          lead={{
            id: leadParaEditar.id,
            nome: leadParaEditar.name,
            telefone: leadParaEditar.phone || leadParaEditar.telefone || "",
            email: leadParaEditar.email || "",
            cpf: leadParaEditar.cpf || "",
            value: leadParaEditar.value,
            company: leadParaEditar.company || "",
            source: leadParaEditar.source || "",
            notes: leadParaEditar.notes || "",
            tags: leadParaEditar.tags || [],
            funil_id: leadParaEditar.funil_id || undefined,
            etapa_id: leadParaEditar.etapa_id || undefined,
            company_id: leadParaEditar.company_id || undefined,
            ...(leadParaEditar.responsavel_id ? { responsavel_id: leadParaEditar.responsavel_id } : {}),
          }}
          onLeadUpdated={() => {
            // Recarregar leads após editar
            console.log('🔄 [Leads] Recarregando leads após editar');
            resetAndLoadLeads();
            setLeadParaEditar(null);
            setShowEditDialog(false);
          }}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead "{leadParaExcluir?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setLeadParaExcluir(null);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Conversa */}
      {leadParaConversa && (
        <ConversaPopup
          open={showConversaDialog}
          onOpenChange={(open) => {
            setShowConversaDialog(open);
            if (!open) {
              setLeadParaConversa(null);
            }
          }}
          leadId={leadParaConversa.id}
          leadName={leadParaConversa.name || "Lead sem nome"}
          leadPhone={leadParaConversa.phone || leadParaConversa.telefone || undefined}
        />
      )}

      {/* Dialog de Agendamento */}
      {leadParaAgenda && (
        <AgendaModal
          open={showAgendaDialog}
          onOpenChange={(open) => {
            setShowAgendaDialog(open);
            if (!open) setLeadParaAgenda(null);
          }}
          lead={{ id: leadParaAgenda.id, nome: leadParaAgenda.name, telefone: leadParaAgenda.phone || leadParaAgenda.telefone || undefined }}
          onAgendamentoCriado={() => {
            toast({
              title: "Compromisso criado",
              description: "O compromisso foi agendado com sucesso.",
            });
            emitGlobalEvent({
              type: 'meeting-scheduled',
              data: { lead_id: leadParaAgenda.id },
              source: 'Leads'
            });
            carregarLeads(true);
          }}
        />
      )}

      {/* Dialog de Tarefa */}
      {leadParaTarefa && (
        <TarefaModal
          open={showTarefaDialog}
          onOpenChange={(open) => {
            setShowTarefaDialog(open);
            if (!open) setLeadParaTarefa(null);
          }}
          lead={{ id: leadParaTarefa.id, nome: leadParaTarefa.name }}
          onTarefaCriada={() => {
            toast({
              title: "Tarefa criada",
              description: "A tarefa foi criada com sucesso.",
            });
            emitGlobalEvent({
              type: 'task-created',
              data: { lead_id: leadParaTarefa.id },
              source: 'Leads'
            });
            carregarLeads(true);
          }}
        />
      )}
    </div>
  );
}
