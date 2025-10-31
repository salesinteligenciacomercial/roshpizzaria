import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Search, Tag, MessageSquare, Phone, Mail, User, Building2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LeadActionsDialog } from "@/components/leads/LeadActionsDialog";
import { LeadQuickActions } from "@/components/leads/LeadQuickActions";
import { LeadTagsDialog } from "@/components/leads/LeadTagsDialog";
import { TagsManager } from "@/components/leads/TagsManager";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
import { ImportarLeadsDialog } from "@/components/funil/ImportarLeadsDialog";
import { formatPhoneNumber } from "@/utils/phoneFormatter";
import { useNavigate } from "react-router-dom";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  telefone?: string | null;
  company: string | null;
  source: string | null;
  status: string;
  stage: string;
  value: number;
  created_at: string;
  tags?: string[];
  cpf?: string | null;
  notes?: string | null;
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
  const PAGE_SIZE = 50; // Carregar 50 leads por vez
  const MAX_TOTAL_LEADS = 1000; // Limite máximo para evitar problemas de performance
  const { toast } = useToast();
  const navigate = useNavigate();
  const observerRef = useRef<HTMLDivElement>(null);

  const abrirConversa = (leadId: string, leadName: string) => {
    navigate('/conversas', { state: { leadId } });
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
    carregarLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [searchTerm, selectedStatus, selectedTag, leads]);

  const carregarLeads = async (reset = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const currentPage = reset ? 0 : page;
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Verificar se já atingiu o limite máximo
      if (!reset && leads.length >= MAX_TOTAL_LEADS) {
        setHasMore(false);
        return;
      }

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        toast({
          variant: "destructive",
          title: "Erro ao carregar leads",
          description: error.message,
        });
        return;
      }

      if (reset) {
        setLeads(data || []);
        setPage(0);
        setHasMore((data || []).length === PAGE_SIZE);
      } else {
        const newLeads = data || [];
        const combinedLeads = [...leads, ...newLeads];

        // Limitar ao máximo total para performance
        const limitedLeads = combinedLeads.slice(0, MAX_TOTAL_LEADS);

        setLeads(limitedLeads);
        setPage(prev => prev + 1);

        // Parar de carregar se atingiu o limite ou não há mais dados
        setHasMore(newLeads.length === PAGE_SIZE && limitedLeads.length < MAX_TOTAL_LEADS);
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
    const timeoutId = setTimeout(() => {
      resetAndLoadLeads();
    }, 300); // Debounce de 300ms para busca

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedStatus, selectedTag, resetAndLoadLeads]);

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const searchTrimmed = searchTerm.trim();

      filtered = filtered.filter(
        (lead) => {
          // Busca textual normal
          const textMatch =
            lead.name.toLowerCase().includes(searchLower) ||
            lead.email?.toLowerCase().includes(searchLower) ||
            lead.phone?.includes(searchTerm) ||
            lead.telefone?.includes(searchTerm) ||
            lead.company?.toLowerCase().includes(searchLower) ||
            lead.cpf?.includes(searchTerm) ||
            lead.source?.toLowerCase().includes(searchLower) ||
            lead.value.toString().includes(searchTerm) ||
            new Date(lead.created_at).toLocaleDateString('pt-BR').includes(searchTerm) ||
            lead.notes?.toLowerCase().includes(searchLower);

          // Busca por valor com operadores (> < =)
          const valueMatch = (() => {
            if (!searchTrimmed.match(/^[<>=]\d+(\.\d+)?$/)) return false;

            const operator = searchTrimmed[0];
            const value = parseFloat(searchTrimmed.slice(1));

            switch (operator) {
              case '>': return lead.value > value;
              case '<': return lead.value < value;
              case '=': return lead.value === value;
              default: return false;
            }
          })();

          return textMatch || valueMatch;
        }
      );
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
                          onClick={() => abrirConversa(lead.id, lead.name)}
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
        {!hasMore && leads.length >= MAX_TOTAL_LEADS && (
          <div className="text-muted-foreground text-sm">
            {leads.length} leads carregados (limite atingido para performance)
          </div>
        )}
        {!hasMore && leads.length > 0 && leads.length < MAX_TOTAL_LEADS && (
          <div className="text-muted-foreground text-sm">
            Todos os {leads.length} leads foram carregados
          </div>
        )}
      </div>
    </div>
  );
}
