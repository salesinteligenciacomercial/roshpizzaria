import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LeadCard } from "@/components/funil/LeadCard";
import { NovoLeadDialog } from "@/components/funil/NovoLeadDialog";
import { NovoFunilDialog } from "@/components/funil/NovoFunilDialog";
import { EditarFunilDialog } from "@/components/funil/EditarFunilDialog";
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
    if (!over) return;

    const leadId = active.id as string;
    const newEtapaId = over.id as string;

    setLeads((leads) => leads.map((lead) => lead.id === leadId ? { ...lead, etapa_id: newEtapaId } : lead));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Não autenticado");

      await supabase.functions.invoke("api-funil-vendas", {
        body: { action: "mover_lead", data: { lead_id: leadId, nova_etapa_id: newEtapaId } }
      });

      toast.success("Lead movido!");
    } catch (error) {
      toast.error("Erro ao mover lead");
      carregarDados();
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
            <div className="mt-6">
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
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {etapasFiltradas.map((etapa) => {
              const totalEtapa = calcularTotalEtapa(etapa.id);
              const quantidadeLeads = leads.filter(l => l.etapa_id === etapa.id).length;
              
              return (
                <div key={etapa.id}>
                  <div className="text-white p-3 rounded-t-lg" style={{ backgroundColor: etapa.cor }}>
                    <h3 className="font-semibold">{etapa.nome}</h3>
                    <div className="text-sm mt-1">
                      <div>{quantidadeLeads} lead{quantidadeLeads !== 1 ? 's' : ''}</div>
                      <div className="font-bold">
                        R$ {totalEtapa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                  <SortableContext id={etapa.id} items={leads.filter(l => l.etapa_id === etapa.id)} strategy={verticalListSortingStrategy}>
                    <div className="bg-secondary/20 p-4 rounded-b-lg min-h-[500px]">
                      {leads.filter(l => l.etapa_id === etapa.id).map((lead) => (
                        <LeadCard key={lead.id} lead={lead} onDelete={async (id) => {
                          const { error } = await supabase.from("leads").delete().eq("id", id);
                          if (error) {
                            toast.error("Erro ao deletar lead");
                            return;
                          }
                          toast.success("Lead deletado!");
                          carregarDados();
                        }} />
                      ))}
                      {leads.filter(l => l.etapa_id === etapa.id).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Nenhum lead nesta etapa
                        </div>
                      )}
                    </div>
                  </SortableContext>
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