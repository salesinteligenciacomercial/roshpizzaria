import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LeadCard } from "@/components/funil/LeadCard";
import { DroppableColumn } from "@/components/funil/DroppableColumn";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
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

const Kanban = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const { data: funisData } = await supabase.from("funis").select("*").order("criado_em");
      setFunis(funisData || []);
      
      if (!selectedFunil && funisData && funisData.length > 0) {
        setSelectedFunil(funisData[0].id);
      }

      const { data: etapasData } = await supabase.from("etapas").select("*").order("posicao");
      setEtapas(etapasData || []);

      const { data: leadsData } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      setLeads((leadsData || []).map(lead => ({ ...lead, nome: lead.name || "", name: lead.name || "" })));
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados do funil");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log("=== DRAG END ===");
    console.log("Active ID:", active.id);
    console.log("Active Data:", active.data.current);
    console.log("Over ID:", over?.id);
    console.log("Over Data:", over?.data.current);
    
    if (!over) {
      console.log("❌ Sem destino (over)");
      return;
    }

    // Pegar o ID do lead que está sendo movido
    const leadId = active.id as string;
    
    // Pegar o ID da etapa de destino do data do over
    const overData = over.data.current;
    const newEtapaId = overData?.type === 'etapa' ? over.id as string : overData?.etapaId as string;
    
    console.log("Lead ID:", leadId);
    console.log("Nova Etapa ID:", newEtapaId);

    if (!newEtapaId) {
      console.log("❌ ID da etapa de destino não encontrado");
      toast.error("Etapa de destino inválida");
      return;
    }

    // Verificar se o lead já está na etapa de destino
    const lead = leads.find(l => l.id === leadId);
    if (!lead) {
      console.log("❌ Lead não encontrado:", leadId);
      toast.error("Lead não encontrado");
      return;
    }

    if (lead.etapa_id === newEtapaId) {
      console.log("✅ Lead já está na etapa de destino");
      return;
    }

    // Verificar se o destino é realmente uma etapa válida
    const etapaDestino = etapas.find(e => e.id === newEtapaId);
    if (!etapaDestino) {
      console.log("❌ Etapa de destino não encontrada:", newEtapaId);
      console.log("Etapas disponíveis:", etapas.map(e => ({ id: e.id, nome: e.nome })));
      toast.error("Etapa de destino inválida");
      return;
    }

    console.log(`✅ Movendo lead "${lead.name}" de "${lead.etapa_id}" para "${etapaDestino.nome}"`);

    // Atualizar localmente primeiro
    setLeads((leads) => 
      leads.map((l) => l.id === leadId ? { ...l, etapa_id: newEtapaId } : l)
    );

    // Atualizar no banco
    try {
      const { error } = await supabase
        .from("leads")
        .update({ etapa_id: newEtapaId })
        .eq("id", leadId);

      if (error) throw error;
      console.log("✅ Lead atualizado no banco com sucesso");
      toast.success(`Lead movido para ${etapaDestino.nome}!`);
    } catch (error) {
      console.error("❌ Erro ao mover lead:", error);
      toast.error("Erro ao mover lead");
      carregarDados(); // Recarregar em caso de erro
    }
  };

  const etapasFiltradas = etapas.filter((etapa) => etapa.funil_id === selectedFunil);

  const calcularTotalEtapa = (etapaId: string) => {
    return leads
      .filter(l => l.etapa_id === etapaId)
      .reduce((total, lead) => total + (lead.value || 0), 0);
  };

  const funilSelecionado = funis.find(f => f.id === selectedFunil);

  if (loading) return <div className="flex items-center justify-center h-screen"><p>Carregando...</p></div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Funil de Vendas</h1>
          <p className="text-muted-foreground">Gerencie seus leads por etapas</p>
        </div>
        <div className="flex gap-2">
          <NovoFunilDialog onFunilCreated={carregarDados} />
          
          <NovoLeadDialog 
            onLeadCreated={carregarDados}
            triggerButton={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Lead
              </Button>
            }
          />
        </div>
      </div>

      {funis.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <div className="flex-1 max-w-xs">
            <Label>Funil</Label>
            <select value={selectedFunil} onChange={(e) => setSelectedFunil(e.target.value)} className="w-full p-2 border rounded-md mt-2">
              {funis.map((funil) => <option key={funil.id} value={funil.id}>{funil.nome}</option>)}
            </select>
          </div>
          {funilSelecionado && (
            <div className="mt-6 flex gap-2">
              <AdicionarEtapaDialog 
                funilId={funilSelecionado.id}
                onEtapaAdded={carregarDados}
              />
              <EditarFunilDialog 
                funilId={funilSelecionado.id}
                funilNome={funilSelecionado.nome}
                onFunilUpdated={carregarDados}
              />
            </div>
          )}
        </div>
      )}

      {funis.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhum funil criado ainda</p>
          <NovoFunilDialog onFunilCreated={carregarDados} />
        </div>
      ) : (
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
                    onEtapaUpdated={carregarDados}
                  >
                    {leadsNaEtapa.map((lead) => (
                      <LeadCard 
                        key={lead.id} 
                        lead={lead} 
                        onDelete={async (id) => {
                          const { error } = await supabase.from("leads").delete().eq("id", id);
                          if (error) {
                            toast.error("Erro ao deletar lead");
                            return;
                          }
                          toast.success("Lead deletado!");
                          carregarDados();
                        }}
                        onLeadMoved={carregarDados}
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
      )}
    </div>
  );
};

export default Kanban;