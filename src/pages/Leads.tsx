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
  avatar_url?: string | null;
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
  const SEARCH_DEBOUNCE_MS = 500; // Debounce de 500ms para busca
  // Cache de company_id para evitar múltiplas consultas
  const companyIdCache = useRef<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const observerRef = useRef<HTMLDivElement>(null);
  const isInitialLoadRef = useRef(false); // Flag para evitar múltiplas cargas iniciais
  const isLoadingRef = useRef(false); // Ref para evitar múltiplas chamadas simultâneas
  const hasErrorRef = useRef(false); // Flag para desabilitar Observer quando há erro
  const lastSearchParamsRef = useRef({ searchTerm: "", selectedStatus: "all", selectedTag: null }); // Cache dos últimos parâmetros de busca
  // Refs para valores atuais (evitar recriações de função)
  const currentPageRef = useRef(page);
  const currentSearchTermRef = useRef(searchTerm);
  const currentSelectedStatusRef = useRef(selectedStatus);
  const currentSelectedTagRef = useRef(selectedTag);

  // Função auxiliar para obter company_id do usuário (com cache)
  const getCompanyId = async () => {
    // Retornar cache se disponível
    if (companyIdCache.current !== null) {
      return companyIdCache.current;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        companyIdCache.current = null;
        return null;
      }

      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        console.error("Erro ao buscar company_id:", roleError);
        companyIdCache.current = null;
        return null;
      }

      const companyId = userRole?.company_id || null;
      companyIdCache.current = companyId;
      return companyId;
    } catch (error) {
      console.error("Erro ao obter company_id:", error);
      companyIdCache.current = null;
      return null;
    }
  };

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

  // Sistema de workflows automatizados - obter companyId antes de usar
  const [workflowCompanyId, setWorkflowCompanyId] = useState<string | undefined>(undefined);
  
  // Obter companyId para workflows
  useEffect(() => {
    const fetchCompanyId = async () => {
      const companyId = await getCompanyId();
      if (companyId) {
        setWorkflowCompanyId(companyId);
      }
    };
    fetchCompanyId();
  }, []);

  // Sistema de workflows automatizados - só inicializar quando tiver companyId
  useWorkflowAutomation({
    companyId: workflowCompanyId,
    showNotifications: true
  });

  // Integrar sincronização de leads em tempo real
  // IMPORTANTE: Usar useRef para callbacks estáveis e evitar loops
  const leadsSyncCallbacksRef = useRef({
    onInsert: (newLead: Lead) => {
      console.log('📡 [Leads] Novo lead adicionado via sync:', newLead);
      // Validar company_id antes de adicionar
      const currentCompanyId = companyIdCache.current;
      if (currentCompanyId && newLead.company_id !== currentCompanyId) {
        console.log('🚫 [Leads] Lead ignorado - empresa diferente:', {
          leadCompanyId: newLead.company_id,
          userCompanyId: currentCompanyId,
          leadId: newLead.id
        });
        return; // Ignorar leads de outras empresas
      }
      // Usar setTimeout para desacoplar da render atual e evitar loops
      setTimeout(() => {
        setLeads(prev => {
          // Verificar se já existe para evitar duplicatas
          if (prev.some(l => l.id === newLead.id)) {
            return prev;
          }
          const updated = [newLead, ...prev];
          // Atualizar filteredLeads apenas se não há filtros ativos
          const hasNoFilters = !currentSearchTermRef.current && 
                               currentSelectedStatusRef.current === "all" && 
                               !currentSelectedTagRef.current;
          if (hasNoFilters) {
            setFilteredLeads(updated);
          }
          return updated;
        });
      }, 0);
    },
    onUpdate: (updatedLead: Lead) => {
      console.log('📡 [Leads] Lead atualizado via sync:', updatedLead);
      // Validar company_id antes de atualizar
      const currentCompanyId = companyIdCache.current;
      if (currentCompanyId && updatedLead.company_id !== currentCompanyId) {
        console.log('🚫 [Leads] Lead ignorado - empresa diferente:', {
          leadCompanyId: updatedLead.company_id,
          userCompanyId: currentCompanyId,
          leadId: updatedLead.id
        });
        return; // Ignorar leads de outras empresas
      }
      setTimeout(() => {
        setLeads(prev => {
          const exists = prev.some(l => l.id === updatedLead.id);
          if (!exists) {
            // Se não existe, pode ser que seja de outra empresa ou ainda não carregado
            // Não adicionar automaticamente aqui, deixar carregar via query
            return prev;
          }
          const updated = prev.map(lead => 
        lead.id === updatedLead.id ? updatedLead : lead
          );
          // Atualizar filteredLeads apenas se não há filtros ativos
          const hasNoFilters = !currentSearchTermRef.current && 
                               currentSelectedStatusRef.current === "all" && 
                               !currentSelectedTagRef.current;
          if (hasNoFilters) {
            setFilteredLeads(updated);
          }
          return updated;
        });
      }, 0);
    },
    onDelete: (deletedLead: Lead) => {
      console.log('📡 [Leads] Lead removido via sync:', deletedLead);
      setTimeout(() => {
        setLeads(prev => {
          const updated = prev.filter(lead => lead.id !== deletedLead.id);
          // Atualizar filteredLeads apenas se não há filtros ativos
          const hasNoFilters = !currentSearchTermRef.current && 
                               currentSelectedStatusRef.current === "all" && 
                               !currentSelectedTagRef.current;
          if (hasNoFilters) {
            setFilteredLeads(updated);
          }
          return updated;
        });
      }, 0);
    }
  });

  useLeadsSync({
    onInsert: leadsSyncCallbacksRef.current.onInsert,
    onUpdate: leadsSyncCallbacksRef.current.onUpdate,
    onDelete: leadsSyncCallbacksRef.current.onDelete,
    showNotifications: true,
    companyId: workflowCompanyId || companyIdCache.current || undefined
  });

  // Atualizar refs quando valores mudarem
  // IMPORTANTE: Este useEffect NÃO deve causar re-renders ou loops
  useEffect(() => {
    // Atualizar refs sem causar re-renders
    if (currentPageRef.current !== page) {
      currentPageRef.current = page;
    }
    if (currentSearchTermRef.current !== searchTerm) {
      currentSearchTermRef.current = searchTerm;
    }
    if (currentSelectedStatusRef.current !== selectedStatus) {
      currentSelectedStatusRef.current = selectedStatus;
    }
    if (currentSelectedTagRef.current !== selectedTag) {
      currentSelectedTagRef.current = selectedTag;
    }
    // Este useEffect NÃO deve causar nenhum loop porque apenas atualiza refs
  }, [page, searchTerm, selectedStatus, selectedTag]);

  // Sincronizar filteredLeads com leads quando não há filtros ativos
  // IMPORTANTE: Só sincronizar quando não há busca/filtros para evitar loops
  useEffect(() => {
    // Só sincronizar se não há busca ou filtros ativos (os leads já vêm filtrados do servidor)
    const hasNoFilters = !searchTerm && selectedStatus === "all" && !selectedTag;
    
    if (hasNoFilters) {
      // Sincronizar se filteredLeads está vazio mas leads tem dados
      // ou se os arrays são diferentes
      const needsSync = filteredLeads.length === 0 && leads.length > 0 ||
        filteredLeads.length !== leads.length ||
        filteredLeads.some((lead, idx) => lead.id !== leads[idx]?.id);
      
      if (needsSync) {
        console.log('🔄 [Leads] Sincronizando filteredLeads com leads:', leads.length);
        setFilteredLeads([...leads]); // Criar nova referência para garantir atualização
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length, searchTerm, selectedStatus, selectedTag]); // Quando leads ou filtros mudam

  const carregarLeads = useCallback(async (reset = false) => {
    // Prevenir múltiplas chamadas simultâneas usando ref
    if (isLoadingRef.current) {
      console.log('⏸️ [Leads] Carregamento já em andamento, ignorando chamada');
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    try {
      // Validar company_id antes de carregar leads
      const companyId = await getCompanyId();
      console.log('🔍 [Leads] Carregando leads para company_id:', companyId);
      
      if (!companyId) {
        console.error('❌ [Leads] company_id não encontrado!');
        toast({
          variant: "destructive",
          title: "Acesso restrito",
          description: "Você precisa estar vinculado a uma empresa para gerenciar leads.",
        });
        isLoadingRef.current = false;
        setLoading(false);
        setLeads([]);
        setFilteredLeads([]);
        return;
      }
      
      // Atualizar cache se necessário
      companyIdCache.current = companyId;

      // Obter valores atuais dos refs (evita valores stale)
      const currentPage = reset ? 0 : currentPageRef.current;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Selecionar apenas campos necessários para listagem inicial (performance)
      // REMOVIDO: avatar_url - não existe na tabela (causa erro 400)
      const camposNecessarios = "id,name,email,phone,telefone,company,source,status,stage,value,created_at,tags,cpf,notes,funil_id,etapa_id";
      
      // Construir query com filtros server-side para melhor performance
      let query = supabase
        .from("leads")
        .select(camposNecessarios)
        .eq("company_id", companyId);

      // Filtro por status server-side (usar ref)
      const statusFilter = currentSelectedStatusRef.current;
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      // Filtro por tag server-side (usar ref)
      const tagFilter = currentSelectedTagRef.current;
      if (tagFilter) {
        query = query.contains("tags", [tagFilter]);
      }

      // Busca server-side quando houver searchTerm (usar ref)
      const searchTermValue = currentSearchTermRef.current;
      if (searchTermValue && searchTermValue.trim()) {
        const searchTrimmed = searchTermValue.trim();
        
        // Busca por valor com operadores (> < = >= <=) - tem prioridade
        // Regex melhorado para suportar: >, <, =, >=, <= com valores decimais
        // Suporta: >1000, <500, =3000, >=1000.50, <=500.25
        const valueMatch = searchTrimmed.match(/^([><=]{1,2})(\d+(?:\.\d+)?)$/);
        if (valueMatch) {
          const operator = valueMatch[1]; // Pode ser >, <, =, >=, <=
          const valueStr = valueMatch[2];
          const value = parseFloat(valueStr);
          
          // Validar se o valor é um número válido
          if (isNaN(value) || !isFinite(value)) {
            console.warn('⚠️ [Leads] Valor inválido na busca:', valueStr);
            // Fallback para busca textual
            const searchLower = searchTrimmed.toLowerCase();
            query = query.or(`name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchTrimmed}%,telefone.ilike.%${searchTrimmed}%,company.ilike.%${searchLower}%,source.ilike.%${searchLower}%,cpf.ilike.%${searchTrimmed}%,notes.ilike.%${searchLower}%`);
          } else {
            // Aplicar filtro por valor usando operadores do Supabase
            // O Supabase valida automaticamente se o valor é numérico antes de comparar
            switch (operator) {
              case '>':
                query = query.gt("value", value);
                console.log(`🔍 [Leads] Busca por valor: > ${value}`);
                break;
              case '<':
                query = query.lt("value", value);
                console.log(`🔍 [Leads] Busca por valor: < ${value}`);
                break;
              case '=':
              case '==': // Suporta também == para compatibilidade
                query = query.eq("value", value);
                console.log(`🔍 [Leads] Busca por valor: = ${value}`);
                break;
              case '>=':
                query = query.gte("value", value);
                console.log(`🔍 [Leads] Busca por valor: >= ${value}`);
                break;
              case '<=':
                query = query.lte("value", value);
                console.log(`🔍 [Leads] Busca por valor: <= ${value}`);
                break;
              default:
                console.warn('⚠️ [Leads] Operador não suportado:', operator);
                // Fallback para busca textual
                const searchLower = searchTrimmed.toLowerCase();
                query = query.or(`name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchTrimmed}%,telefone.ilike.%${searchTrimmed}%,company.ilike.%${searchLower}%,source.ilike.%${searchLower}%,cpf.ilike.%${searchTrimmed}%,notes.ilike.%${searchLower}%`);
            }
          }
        } else {
          // Busca textual por múltiplos campos usando ilike
          const searchLower = searchTrimmed.toLowerCase();
          query = query.or(`name.ilike.%${searchLower}%,email.ilike.%${searchLower}%,phone.ilike.%${searchTrimmed}%,telefone.ilike.%${searchTrimmed}%,company.ilike.%${searchLower}%,source.ilike.%${searchLower}%,cpf.ilike.%${searchTrimmed}%,notes.ilike.%${searchLower}%`);
        }
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error('❌ [Leads] Erro ao carregar leads:', {
          error,
          companyId,
          from,
          to,
          reset,
          message: error.message
        });
        
        // Marcar erro para desabilitar Observer
        hasErrorRef.current = true;
        
        toast({
          variant: "destructive",
          title: "Erro ao carregar leads",
          description: error.message || "Erro desconhecido ao carregar leads",
        });
        
        // Parar Observer se há erro
        setHasMore(false);
        isLoadingRef.current = false;
        setLoading(false);
        return;
      }
      
      // Limpar flag de erro se sucesso
      hasErrorRef.current = false;

      const newLeads = data || [];
      console.log('✅ [Leads] Leads carregados:', {
        quantidade: newLeads.length,
        companyId,
        reset,
        filtros: {
          status: currentSelectedStatusRef.current,
          tag: currentSelectedTagRef.current,
          search: currentSearchTermRef.current
        },
        leadsIds: newLeads.map(l => l.id).slice(0, 5) // Primeiros 5 IDs para debug
      });

      if (reset) {
        // Reset: substituir todos os leads
        setLeads(newLeads);
        setFilteredLeads(newLeads);
        console.log('🔄 [Leads] Reset aplicado, filteredLeads atualizado:', newLeads.length);
        // Não atualizar page se já está em 0 (evitar re-render desnecessário)
        if (currentPageRef.current !== 0) {
        setPage(0);
          currentPageRef.current = 0;
        }
        setHasMore(newLeads.length === PAGE_SIZE);
      } else {
        // Paginação: adicionar novos leads
        setLeads(prev => {
          const existingIds = new Set(prev.map(l => l.id));
          const uniqueNewLeads = newLeads.filter(l => !existingIds.has(l.id));
          
          // Se não há novos leads, retornar o estado anterior
          if (uniqueNewLeads.length === 0) {
            return prev;
          }
          
          const updatedLeads = [...prev, ...uniqueNewLeads];
          // Atualizar filteredLeads dentro do setState para sincronizar
          // IMPORTANTE: Só atualizar filteredLeads se não há filtros ativos
          // (se houver filtros, filteredLeads será atualizado no reset)
          const hasNoFilters = !currentSearchTermRef.current && 
                               currentSelectedStatusRef.current === "all" && 
                               !currentSelectedTagRef.current;
          if (hasNoFilters) {
            setFilteredLeads(updatedLeads);
          }
          return updatedLeads;
        });
        
        // Atualizar página e hasMore separadamente
        // Só atualizar page se realmente mudou (evitar re-render)
        setPage(prev => {
          const newPage = prev + 1;
          currentPageRef.current = newPage;
          return newPage;
        });

        // Parar de carregar se não há mais dados
        setHasMore(newLeads.length === PAGE_SIZE);
      }
      
      // Limpar flag de erro em caso de sucesso
      hasErrorRef.current = false;
    } catch (error) {
      // Erro capturado, já foi tratado acima
      hasErrorRef.current = true;
      setHasMore(false);
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []); // Sem dependências - usar valores atuais via closure

  const resetAndLoadLeads = useCallback(async () => {
    if (isLoadingRef.current) {
      console.log('⏸️ [Leads] Carregamento já em andamento, ignorando reset');
      return; // Evitar múltiplas chamadas simultâneas
    }
    setPage(0);
    setHasMore(true);
    await carregarLeads(true);
  }, []); // SEM dependências - usar closure

  // Carregar leads apenas uma vez no mount inicial - usar ref para evitar loops
  useEffect(() => {
    // Múltiplas verificações para garantir que só executa UMA vez
    if (isInitialLoadRef.current) return;
    if (isLoadingRef.current) return;
    
    // Marcar imediatamente para evitar múltiplas execuções
    isInitialLoadRef.current = true;
    
    // Executar em timeout separado para garantir isolamento
    const timeoutId = setTimeout(async () => {
      if (isLoadingRef.current) return; // Verificar novamente
      
      isLoadingRef.current = true;
      setLoading(true);
      setPage(0);
      setHasMore(true);
      
      try {
        await carregarLeads(true);
      } catch (error) {
        console.error('❌ [Leads] Erro no carregamento inicial:', error);
      } finally {
        isLoadingRef.current = false;
        setLoading(false);
      }
    }, 100); // Pequeno delay para garantir que tudo está inicializado

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Executar apenas uma vez no mount - SEM dependências

  // Intersection Observer para carregamento infinito
  useEffect(() => {
    // Múltiplas verificações para garantir que Observer só funciona quando apropriado
    if (!isInitialLoadRef.current) return; // Não configurar até carregamento inicial
    if (hasErrorRef.current) return; // Não configurar se há erro
    if (isLoadingRef.current) return; // Não configurar se já está carregando
    
    // Não configurar Observer se não há mais dados ou se há erro
    if (!hasMore || hasErrorRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        // Verificações múltiplas ANTES de chamar carregarLeads
        if (!target.isIntersecting) return;
        if (!hasMore) return;
        if (isLoadingRef.current) return;
        if (loading) return;
        if (hasErrorRef.current) return; // NÃO chamar se há erro
        if (!isInitialLoadRef.current) return;
        
        console.log('📜 [Leads] Observer detectou intersecção, carregando mais leads');
        
        // Marcar como carregando ANTES de chamar
        isLoadingRef.current = true;
        setLoading(true);
        
        // Chamar carregarLeads
        carregarLeads().catch(error => {
          console.error('❌ [Leads] Erro no Observer ao carregar mais leads:', error);
          hasErrorRef.current = true;
          setHasMore(false);
        }).finally(() => {
          isLoadingRef.current = false;
          setLoading(false);
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading]); // NÃO incluir carregarLeads nas dependências

  // Reset quando filtros mudam com debounce de 500ms
  useEffect(() => {
    // Múltiplas verificações de segurança
    if (!isInitialLoadRef.current) return; // Não fazer nada até carregamento inicial
    if (isLoadingRef.current) return; // Não fazer nada se já está carregando

    // Verificar se os parâmetros realmente mudaram para evitar chamadas desnecessárias
    const currentParams = { searchTerm, selectedStatus, selectedTag };
    const paramsChanged = 
      currentParams.searchTerm !== lastSearchParamsRef.current.searchTerm ||
      currentParams.selectedStatus !== lastSearchParamsRef.current.selectedStatus ||
      currentParams.selectedTag !== lastSearchParamsRef.current.selectedTag;

    if (!paramsChanged) {
      return; // Parâmetros não mudaram, não fazer nada
    }

    // Atualizar cache dos parâmetros ANTES de resetar (para evitar loops)
    lastSearchParamsRef.current = currentParams;

    // Timeout com debounce
    const timeoutId = setTimeout(() => {
      // Verificações múltiplas antes de executar
      if (!isInitialLoadRef.current) return;
      if (isLoadingRef.current) return;
      
      // Verificar se os parâmetros ainda são os mesmos (evitar race conditions)
      const stillSame = 
        currentParams.searchTerm === searchTerm &&
        currentParams.selectedStatus === selectedStatus &&
        currentParams.selectedTag === selectedTag;
      
      if (!stillSame) {
        console.log('⏭️ [Leads] Filtros mudaram novamente durante debounce, ignorando');
        return;
      }

      // Verificar novamente se não está carregando
      if (isLoadingRef.current) {
        console.log('⏸️ [Leads] Carregamento iniciado durante debounce, ignorando');
        return;
      }

      console.log('🔄 [Leads] Filtros mudaram, resetando leads:', currentParams);
      
      // Marcar como carregando ANTES de chamar
      isLoadingRef.current = true;
      setLoading(true);
      
      // Chamar diretamente sem usar resetAndLoadLeads para evitar dependências
      (async () => {
        try {
          setPage(0);
          setHasMore(true);
          await carregarLeads(true);
        } catch (error) {
          console.error('❌ [Leads] Erro ao resetar leads:', error);
        } finally {
          isLoadingRef.current = false;
          setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedStatus, selectedTag]); // NÃO incluir carregarLeads nas dependências

  // filterLeads simplificado - a maioria dos filtros é feita server-side
  // Este é usado apenas como fallback quando necessário
  const filterLeads = () => {
    // Quando há busca/filtros, os leads já vêm filtrados do servidor
    // Apenas aplicar filtro client-side adicional se necessário
    setFilteredLeads(leads);
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
    if (!leadParaExcluir) return;

    try {
      // Validar company_id antes de excluir
      const companyId = await getCompanyId();
      
      if (!companyId) {
        toast({
          variant: "destructive",
          title: "Acesso restrito",
          description: "Você precisa estar vinculado a uma empresa para gerenciar leads.",
        });
        setLeadParaExcluir(null);
        setShowDeleteDialog(false);
        return;
      }

      // Verificar se o lead pertence à empresa do usuário
      const { data: leadData, error: fetchError } = await supabase
        .from("leads")
        .select("company_id")
        .eq("id", leadParaExcluir.id)
        .maybeSingle();

      if (fetchError || !leadData) {
        toast({
          variant: "destructive",
          title: "Erro ao verificar lead",
          description: "Não foi possível verificar o lead. Tente novamente.",
        });
        return;
      }

      if (leadData.company_id !== companyId) {
        toast({
          variant: "destructive",
          title: "Acesso negado",
          description: "Você não tem permissão para excluir este lead.",
        });
        setLeadParaExcluir(null);
        setShowDeleteDialog(false);
        return;
      }

      // Excluir o lead
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadParaExcluir.id)
        .eq("company_id", companyId);

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

  // Função auxiliar para obter avatar do cache localStorage
  const getCachedAvatar = (leadId: string): string | null => {
    try {
      const cached = localStorage.getItem(`avatar_${leadId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Cache válido por 24 horas
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.url;
        }
      }
    } catch (error) {
      console.error('Erro ao ler cache de avatar:', error);
    }
    return null;
  };

  // Função auxiliar para salvar avatar no cache localStorage
  const setCachedAvatar = (leadId: string, url: string) => {
    try {
      localStorage.setItem(`avatar_${leadId}`, JSON.stringify({
        url,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Erro ao salvar cache de avatar:', error);
    }
  };

  // Função para buscar foto de perfil do WhatsApp com retry e cache
  const buscarFotoPerfil = async (lead: Lead, retryCount = 0) => {
    const telefone = lead.phone || lead.telefone;
    if (!telefone) {
      // Sem telefone, usar fallback imediatamente
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=128&bold=true`;
      setLeadAvatars(prev => ({ ...prev, [lead.id]: avatarUrl }));
      return;
    }

    // Verificar se já está em memória
    if (leadAvatars[lead.id]) return;

    // Verificar cache do localStorage
    const cachedAvatar = getCachedAvatar(lead.id);
    if (cachedAvatar) {
      setLeadAvatars(prev => ({ ...prev, [lead.id]: cachedAvatar }));
      return;
    }

    try {
      // Normalizar número (remover caracteres não numéricos)
      const telefoneNormalizado = telefone.replace(/\D/g, "");
      
      // Criar promise com timeout de 5 segundos
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout na busca de avatar')), 5000);
      });

      // Promise para buscar foto via edge function
      const fetchPromise = supabase.functions.invoke('get-profile-picture', {
        body: { number: telefoneNormalizado }
      });

      // Race entre fetch e timeout
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (!error && data?.profilePictureUrl) {
        // Avatar encontrado - salvar no cache e no estado
        const avatarUrl = data.profilePictureUrl;
        setCachedAvatar(lead.id, avatarUrl);
        setLeadAvatars(prev => ({
          ...prev,
          [lead.id]: avatarUrl
        }));
      } else {
        // Erro na busca - usar fallback
        throw new Error('Avatar não encontrado');
      }
    } catch (error: any) {
      console.error(`Erro ao buscar foto de perfil (tentativa ${retryCount + 1}):`, error);

      // Retry automático (máximo 2 tentativas)
      if (retryCount < 2 && error?.message !== 'Timeout na busca de avatar') {
        // Aguardar 1 segundo antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 1000));
        return buscarFotoPerfil(lead, retryCount + 1);
      }

      // Após esgotar tentativas ou timeout, usar fallback sempre
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=128&bold=true`;
      
      // Salvar fallback no cache para evitar tentativas futuras
      setCachedAvatar(lead.id, avatarUrl);
      setLeadAvatars(prev => ({
        ...prev,
        [lead.id]: avatarUrl
      }));
    }
  };

  // Buscar fotos de perfil quando os leads são carregados (com debounce)
  // Usar ref para rastrear leads processados e evitar loops
  const processedLeadsRef = useRef<Set<string>>(new Set());
  const lastLeadsLengthRef = useRef(0);
  
  useEffect(() => {
    // Só executar se o número de leads realmente mudou (não apenas re-render)
    if (leads.length === 0) return;
    if (leads.length === lastLeadsLengthRef.current) return;
    
    lastLeadsLengthRef.current = leads.length;

    // Carregar avatares do cache primeiro
    const timeoutId1 = setTimeout(() => {
      leads.forEach(lead => {
        if (processedLeadsRef.current.has(lead.id)) return; // Já processado
        
        const cachedAvatar = getCachedAvatar(lead.id);
        if (cachedAvatar && !leadAvatars[lead.id]) {
          setLeadAvatars(prev => {
            if (prev[lead.id]) return prev; // Já tem avatar, não atualizar
            return { ...prev, [lead.id]: cachedAvatar };
          });
        }
      });
    }, 100);

    // Buscar avatares do WhatsApp com debounce para evitar muitas requisições simultâneas
    const timeoutId2 = setTimeout(() => {
      leads.forEach((lead, index) => {
        // Espaçar requisições em 100ms cada para evitar sobrecarga
        setTimeout(() => {
          if (processedLeadsRef.current.has(lead.id)) return; // Já processado
          
          if ((lead.phone || lead.telefone) && !leadAvatars[lead.id] && !getCachedAvatar(lead.id)) {
            processedLeadsRef.current.add(lead.id); // Marcar como processado
            buscarFotoPerfil(lead);
          } else {
            processedLeadsRef.current.add(lead.id); // Marcar como processado mesmo sem buscar
          }
        }, index * 100);
      });
    }, 500);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length]); // Apenas length, não o array completo

  // Função para obter avatar do lead (com cache do localStorage)
  const getLeadAvatar = (lead: Lead): string => {
    // Primeiro tentar avatar do banco de dados
    if (lead.avatar_url) {
      return lead.avatar_url;
    }
    
    // Depois tentar avatar buscado do WhatsApp (em memória)
    if (leadAvatars[lead.id]) {
      return leadAvatars[lead.id];
    }
    
    // Tentar buscar no cache do localStorage
    const cachedAvatar = getCachedAvatar(lead.id);
    if (cachedAvatar) {
      // Atualizar estado em memória também
      setLeadAvatars(prev => ({ ...prev, [lead.id]: cachedAvatar }));
      return cachedAvatar;
    }
    
    // Fallback sempre funcional: UI Avatars
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
          <ImportarLeadsDialog onLeadsImported={() => {
            // Recarregar leads do início após importar
            console.log('🔄 [Leads] Recarregando leads após importar');
            resetAndLoadLeads();
          }} />
          <NovoLeadDialog onLeadCreated={() => {
            // Recarregar leads do início após criar novo lead
            console.log('🔄 [Leads] Recarregando leads após criar novo lead');
            resetAndLoadLeads();
          }} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email, telefone, empresa, CPF, origem, valor (>1000, <500), data ou observações..."
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
          }}
          open={showEditDialog}
          onOpenChange={(open) => {
            setShowEditDialog(open);
            if (!open) {
              setLeadParaEditar(null);
            }
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
          leadName={leadParaConversa.name}
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