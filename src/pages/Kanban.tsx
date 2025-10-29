import React, { useState, useEffect } from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LeadCard } from "@/components/funil/LeadCard";
import { DroppableColumn } from "@/components/funil/DroppableColumn";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
import { AdicionarLeadExistenteDialog } from "@/components/funil/AdicionarLeadExistenteDialog";
import { NovoFunilDialog } from "@/components/funil/NovoFunilDialog";
import { EditarFunilDialog } from "@/components/funil/EditarFunilDialog";
import { AdicionarEtapaDialog } from "@/components/funil/AdicionarEtapaDialog";
import { toast } from "sonner";

interface Lead {
  id: string;
  nome: string;
  name: string;
  company?: string;
  value?: number;
  telefone?: string;
  email?: string;
  cpf?: string;
  source?: string;
  notes?: string;
  etapa_id?: string;
  funil_id?: string;
}

interface Etapa {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  funil_id: string;
}

interface Funil {
  id: string;
  nome: string;
  descricao?: string;
}

export default function KanbanPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Carregar funis
        const { data: funisData, error: funisError } = await supabase
          .from("funis")
          .select("*")
          .order("criado_em");

        if (funisError) throw funisError;

        if (!mounted) return;

        // Atualizar funis
        const loadedFunis = funisData || [];
        setFunis(loadedFunis);

        // Selecionar primeiro funil se necessário
        if (loadedFunis.length > 0 && !selectedFunil) {
          setSelectedFunil(loadedFunis[0].id);
        }

        // Carregar etapas
        const { data: etapasData, error: etapasError } = await supabase
          .from("etapas")
          .select("*")
          .order("posicao");

        if (etapasError) throw etapasError;
        if (!mounted) return;

        setEtapas(etapasData || []);

        // Carregar leads
        const { data: leadsData, error: leadsError } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (leadsError) throw leadsError;
        if (!mounted) return;

        setLeads((leadsData || []).map(lead => ({
          ...lead,
          nome: lead.name || "",
          name: lead.name || ""
        })));

      } catch (err: any) {
        console.error("Erro ao carregar dados:", err);
        if (mounted) {
          setError(err.message || "Erro ao carregar dados");
          toast.error("Erro ao carregar funil de vendas");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [selectedFunil]);

  // Atualiza apenas os leads sem recarregar a página
  const refreshLeads = async () => {
    try {
      const { data: leadsData, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (leadsError) throw leadsError;
      setLeads((leadsData || []).map(lead => ({
        ...lead,
        nome: lead.name || "",
        name: lead.name || ""
      })));
    } catch (err) {
      console.error("Erro ao atualizar leads:", err);
    }
  };

  // Atualiza funis
  const refreshFunis = async () => {
    try {
      const { data: funisData, error } = await supabase.from('funis').select('*').order('criado_em');
      if (error) throw error;
      const loaded = funisData || [];
      setFunis(loaded);
      if (!selectedFunil && loaded.length > 0) setSelectedFunil(loaded[0].id);
      if (selectedFunil && !loaded.find(f => f.id === selectedFunil) && loaded.length > 0) {
        setSelectedFunil(loaded[0].id);
      }
    } catch (err) {
      console.error('Erro ao atualizar funis:', err);
    }
  };

  // Atualiza etapas
  const refreshEtapas = async () => {
    try {
      const { data: etapasData, error } = await supabase.from('etapas').select('*').order('posicao');
      if (error) throw error;
      setEtapas(etapasData || []);
    } catch (err) {
      console.error('Erro ao atualizar etapas:', err);
    }
  };

  // Realtime para leads/etapas/funis
  useEffect(() => {
    const formatLead = (lead: any): Lead => ({
      ...lead,
      nome: lead.name || '',
      name: lead.name || ''
    });

    const leadsChannel = supabase
      .channel('kanban_leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setLeads(prev => [formatLead(payload.new), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? formatLead(payload.new) as any : l));
        } else if (payload.eventType === 'DELETE') {
          setLeads(prev => prev.filter(l => l.id !== payload.old.id));
        }
      })
      .subscribe();

    const etapasChannel = supabase
      .channel('kanban_etapas_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etapas' }, () => {
        refreshEtapas();
      })
      .subscribe();

    const funisChannel = supabase
      .channel('kanban_funis_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'funis' }, () => {
        refreshFunis();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(etapasChannel);
      supabase.removeChannel(funisChannel);
    };
  }, [selectedFunil]);

  const handleDragEnd = async (event: DragEndEvent) => {
    try {
      const { active, over } = event;
      
      if (!over) return;

      const leadId = active.id as string;
      const overData = over.data.current;
      const newEtapaId = overData?.type === 'etapa' ? over.id as string : overData?.etapaId as string;
      
      if (!newEtapaId) {
        toast.error("Etapa de destino inválida");
        return;
      }

      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        toast.error("Lead não encontrado");
        return;
      }

      const etapaDestino = etapas.find(e => e.id === newEtapaId);
      if (!etapaDestino) {
        toast.error("Etapa de destino inválida");
        return;
      }

      // Atualizar localmente primeiro
      setLeads(leads => 
        leads.map(l => l.id === leadId ? { ...l, etapa_id: newEtapaId } : l)
      );

      // Atualizar no banco
      const { error } = await supabase
        .from("leads")
        .update({ 
          etapa_id: newEtapaId,
          funil_id: etapaDestino.funil_id,
          stage: etapaDestino.nome.toLowerCase()
        })
        .eq("id", leadId);

      if (error) throw error;
      
    } catch (error) {
      console.error("Erro ao mover lead:", error);
      toast.error("Erro ao mover lead");
    }
  };

  const etapasFiltradas = etapas.filter((etapa) => etapa.funil_id === selectedFunil);

  const calcularTotalEtapa = (etapaId: string) => {
    return leads
      .filter(l => l.etapa_id === etapaId)
      .reduce((total, lead) => total + (lead.value || 0), 0);
  };

  const funilSelecionado = funis.find(f => f.id === selectedFunil);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Carregando funil de vendas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
          </div>
        </div>
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!funis || funis.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
          </div>
          <NovoFunilDialog onFunilCreated={() => window.location.reload()} />
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhum funil criado ainda</p>
          <NovoFunilDialog onFunilCreated={() => window.location.reload()} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Funil de Vendas</h1>
          <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
        </div>
        <div className="flex gap-2">
          <NovoFunilDialog onFunilCreated={async () => { await refreshFunis(); await refreshEtapas(); }} />
          <NovoLeadDialog 
            onLeadCreated={refreshLeads}
            triggerButton={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Lead
              </Button>
            }
          />
          {funilSelecionado && etapasFiltradas.length > 0 && (
            <AdicionarLeadExistenteDialog
              funilId={funilSelecionado.id}
              etapaInicial={{ id: etapasFiltradas[0].id, nome: etapasFiltradas[0].nome }}
              onLeadAdded={refreshLeads}
            />
          )}
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex-1 max-w-xs">
          <Label>Funil</Label>
          <select 
            value={selectedFunil} 
            onChange={(e) => setSelectedFunil(e.target.value)} 
            className="w-full p-2 border rounded-md mt-2"
          >
            {funis.map((funil) => (
              <option key={funil.id} value={funil.id}>{funil.nome}</option>
            ))}
          </select>
        </div>
        {funilSelecionado && (
          <div className="mt-6 flex gap-2">
            <AdicionarEtapaDialog 
              funilId={funilSelecionado.id}
              onEtapaAdded={async () => { await refreshEtapas(); }}
            />
            <EditarFunilDialog 
              funilId={funilSelecionado.id}
              funilNome={funilSelecionado.nome}
              onFunilUpdated={async () => { await refreshFunis(); await refreshEtapas(); }}
            />
          </div>
        )}
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="flex overflow-x-auto gap-4 pb-4">
          {etapasFiltradas.map((etapa) => {
            const totalEtapa = calcularTotalEtapa(etapa.id);
            const quantidadeLeads = leads.filter(l => l.etapa_id === etapa.id).length;
            const leadsNaEtapa = leads.filter(l => l.etapa_id === etapa.id);
            
            return (
              <div key={etapa.id} className="min-w-[300px] flex-shrink-0">
                <DroppableColumn
                  id={etapa.id}
                  cor={etapa.cor}
                  nome={etapa.nome}
                  quantidadeLeads={quantidadeLeads}
                  totalEtapa={totalEtapa}
                  onEtapaUpdated={async () => { await refreshEtapas(); await refreshLeads(); }}
                >
                  {leadsNaEtapa.map((lead) => (
                  <LeadCard 
                      key={lead.id} 
                      lead={lead} 
                    onDelete={async (id) => {
                      try {
                        // Remover do funil sem deletar o lead (evita falha por relacionamentos)
                        const { error } = await supabase
                          .from("leads")
                          .update({ funil_id: null, etapa_id: null })
                          .eq("id", id);
                        if (error) throw error;

                        setLeads(current => current.filter(l => l.id !== id));
                        toast.success("Lead removido do funil");
                      } catch (error) {
                        console.error("Erro ao remover do funil:", error);
                        toast.error("Erro ao remover do funil");
                      }
                    }}
                    onLeadMoved={refreshLeads}
                    />
                  ))}
                  {leadsNaEtapa.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Arraste leads para cá
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}