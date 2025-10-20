import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, DollarSign, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Lead {
  id: string;
  name: string;
  company?: string;
  value: number;
  stage: string;
  phone?: string;
  email?: string;
}

interface Stage {
  id: string;
  name: string;
  color: string;
}

const initialStages: Stage[] = [
  { id: "new", name: "Novo", color: "bg-blue-500" },
  { id: "contact", name: "Contato Feito", color: "bg-yellow-500" },
  { id: "proposal", name: "Proposta Enviada", color: "bg-purple-500" },
  { id: "negotiation", name: "Negociação", color: "bg-orange-500" },
  { id: "won", name: "Ganho", color: "bg-green-500" },
  { id: "lost", name: "Perdido", color: "bg-red-500" },
];

const STORAGE_KEY = "crm_kanban_leads";
const STAGES_KEY = "crm_stages";

function LeadCard({ lead, onDelete }: { lead: Lead; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-3 cursor-move hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-sm font-semibold">{lead.name}</CardTitle>
              {lead.company && <p className="text-xs text-muted-foreground mt-1">{lead.company}</p>}
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1" onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-600">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.value || 0)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Kanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", company: "", value: "", stage: "new" });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setLeads(JSON.parse(saved));
  }, []);

  const saveLeads = (updated: Lead[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setLeads(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || !stages.some((s) => s.id === over.id)) return;
    
    const updatedLeads = leads.map((lead) => lead.id === active.id ? { ...lead, stage: over.id as string } : lead);
    saveLeads(updatedLeads);
    toast.success("Lead movido!");
  };

  const handleCreateLead = () => {
    if (!newLead.name.trim()) return toast.error("Nome obrigatório");
    const lead: Lead = { id: Date.now().toString(), name: newLead.name, company: newLead.company, value: parseFloat(newLead.value) || 0, stage: newLead.stage };
    saveLeads([...leads, lead]);
    setNewLeadOpen(false);
    setNewLead({ name: "", company: "", value: "", stage: "new" });
    toast.success("Lead criado!");
  };

  const getLeadsByStage = (stageId: string) => leads.filter((l) => l.stage === stageId);
  const getStageValue = (stageId: string) => getLeadsByStage(stageId).reduce((sum, l) => sum + (l.value || 0), 0);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Funil de Vendas</h1>
          <p className="text-muted-foreground">Arraste e solte leads entre os estágios</p>
        </div>
        <Dialog open={newLeadOpen} onOpenChange={setNewLeadOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Novo Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Novo Lead</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Nome *</Label><Input value={newLead.name} onChange={(e) => setNewLead({ ...newLead, name: e.target.value })} /></div>
              <div><Label>Empresa</Label><Input value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} /></div>
              <div><Label>Valor</Label><Input type="number" value={newLead.value} onChange={(e) => setNewLead({ ...newLead, value: e.target.value })} /></div>
              <Button onClick={handleCreateLead} className="w-full">Criar Lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="grid gap-4 overflow-x-auto pb-4" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(300px, 1fr))` }}>
          {stages.map((stage) => (
            <SortableContext key={stage.id} id={stage.id} items={getLeadsByStage(stage.id).map((l) => l.id)}>
              <Card className="h-full">
                <CardHeader className={`${stage.color} text-white`}>
                  <CardTitle className="flex items-center justify-between">
                    <span>{stage.name}</span>
                    <span className="text-sm font-normal">{getLeadsByStage(stage.id).length}</span>
                  </CardTitle>
                  <p className="text-sm text-white/90">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(getStageValue(stage.id))}</p>
                </CardHeader>
                <CardContent className="pt-4 min-h-[200px]">
                  {getLeadsByStage(stage.id).map((lead) => <LeadCard key={lead.id} lead={lead} onDelete={(id) => saveLeads(leads.filter((l) => l.id !== id))} />)}
                  {getLeadsByStage(stage.id).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Arraste leads para cá</p>}
                </CardContent>
              </Card>
            </SortableContext>
          ))}
        </div>
        <DragOverlay>{activeLead && <Card className="w-[280px] opacity-90"><CardHeader className="pb-3"><CardTitle className="text-sm">{activeLead.name}</CardTitle></CardHeader></Card>}</DragOverlay>
      </DndContext>
    </div>
  );
}
