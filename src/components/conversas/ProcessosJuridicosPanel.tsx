import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Scale, Plus, ChevronDown, Gavel, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessosJuridicosPanelProps {
  leadId: string;
  companyId: string;
}

interface LegalProcess {
  id: string;
  numero_processo: string | null;
  tipo: string;
  status: string;
  parte_contraria: string | null;
  vara: string | null;
  comarca: string | null;
  valor_causa: number | null;
  data_audiencia: string | null;
  data_distribuicao: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  em_andamento: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  aguardando_audiencia: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  aguardando_pericia: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  suspenso: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  arquivado: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  ganho: "bg-green-500/10 text-green-600 border-green-500/20",
  perdido: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  em_andamento: "Em Andamento",
  aguardando_audiencia: "Ag. Audiência",
  aguardando_pericia: "Ag. Perícia",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  ganho: "Ganho",
  perdido: "Perdido",
};

const TIPO_LABELS: Record<string, string> = {
  comercial: "Comercial",
  trabalhista: "Trabalhista",
  civil: "Civil",
  tributario: "Tributário",
  criminal: "Criminal",
  administrativo: "Administrativo",
};

export function ProcessosJuridicosPanel({ leadId, companyId }: ProcessosJuridicosPanelProps) {
  const [processes, setProcesses] = useState<LegalProcess[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    numero_processo: "",
    tipo: "civil",
    vara: "",
    comarca: "",
    parte_contraria: "",
    valor_causa: "",
    data_audiencia: "",
  });

  useEffect(() => {
    if (leadId) fetchProcesses();
  }, [leadId]);

  const fetchProcesses = async () => {
    const { data } = await supabase
      .from("legal_processes")
      .select("id, numero_processo, tipo, status, parte_contraria, vara, comarca, valor_causa, data_audiencia, data_distribuicao")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setProcesses((data as LegalProcess[]) || []);
  };

  const handleCreate = async () => {
    if (!form.numero_processo.trim()) {
      toast.error("Informe o número do processo");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("legal_processes").insert({
        company_id: companyId,
        lead_id: leadId,
        numero_processo: form.numero_processo,
        tipo: form.tipo,
        vara: form.vara || null,
        comarca: form.comarca || null,
        parte_contraria: form.parte_contraria || null,
        valor_causa: form.valor_causa ? Number(form.valor_causa) : 0,
        data_audiencia: form.data_audiencia || null,
      });
      if (error) throw error;
      toast.success("Processo cadastrado!");
      setDialogOpen(false);
      setForm({ numero_processo: "", tipo: "civil", vara: "", comarca: "", parte_contraria: "", valor_causa: "", data_audiencia: "" });
      fetchProcesses();
    } catch {
      toast.error("Erro ao cadastrar processo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent/50 transition">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Processos Jurídicos</span>
            {processes.length > 0 && (
              <Badge variant="secondary" className="text-xs">{processes.length}</Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {processes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum processo vinculado</p>
          ) : (
            processes.map(p => (
              <div key={p.id} className="p-2 rounded-lg border bg-card text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.numero_processo || "Sem número"}</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[p.status] || ""}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gavel className="h-3 w-3" />
                  <span>{TIPO_LABELS[p.tipo] || p.tipo}</span>
                  {p.parte_contraria && <span>• vs {p.parte_contraria}</span>}
                </div>
                {p.data_audiencia && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Calendar className="h-3 w-3" />
                    <span>Audiência: {format(new Date(p.data_audiencia), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {p.valor_causa && Number(p.valor_causa) > 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <DollarSign className="h-3 w-3" />
                    <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p.valor_causa))}</span>
                  </div>
                )}
              </div>
            ))
          )}
          <Button size="sm" variant="outline" className="w-full" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" />
            Novo Processo
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Novo Processo Jurídico
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nº do Processo (CNJ) *</Label>
              <Input value={form.numero_processo} onChange={e => setForm({ ...form, numero_processo: e.target.value })} placeholder="0000000-00.0000.0.00.0000" />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Vara</Label>
                <Input value={form.vara} onChange={e => setForm({ ...form, vara: e.target.value })} placeholder="2ª Vara Cível" />
              </div>
              <div>
                <Label>Comarca</Label>
                <Input value={form.comarca} onChange={e => setForm({ ...form, comarca: e.target.value })} placeholder="São Paulo/SP" />
              </div>
            </div>
            <div>
              <Label>Parte Contrária</Label>
              <Input value={form.parte_contraria} onChange={e => setForm({ ...form, parte_contraria: e.target.value })} placeholder="Nome da parte contrária" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Valor da Causa (R$)</Label>
                <Input type="number" value={form.valor_causa} onChange={e => setForm({ ...form, valor_causa: e.target.value })} placeholder="0,00" />
              </div>
              <div>
                <Label>Data da Audiência</Label>
                <Input type="datetime-local" value={form.data_audiencia} onChange={e => setForm({ ...form, data_audiencia: e.target.value })} />
              </div>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar Processo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
