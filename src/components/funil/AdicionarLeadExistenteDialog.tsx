import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

interface AdicionarLeadExistenteDialogProps {
  funilId: string;
  etapaInicial: {
    id: string;
    nome: string;
  };
  onLeadAdded: () => void;
}

interface Lead {
  id: string;
  name: string;
  company?: string;
  telefone?: string;
  email?: string;
}

export function AdicionarLeadExistenteDialog({ funilId, etapaInicial, onLeadAdded }: AdicionarLeadExistenteDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    if (open) {
      carregarLeadsDisponiveis();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => carregarLeadsDisponiveis(), 300);
      return () => clearTimeout(id);
    }
  }, [search, open]);

  const carregarLeadsDisponiveis = async () => {
    try {
      // Busca leads que não estão em nenhum funil
      let query = supabase
        .from("leads")
        .select("id, name, company, telefone, phone, email")
        .is("funil_id", null);

      if (search.trim()) {
        const q = search.trim();
        const phoneDigits = q.replace(/\D/g, "");
        // Buscar por nome ou telefone (telefone/phone)
        const orFilters = [
          `name.ilike.%${q}%`,
          `telefone.ilike.%${q}%`,
          `phone.ilike.%${q}%`,
        ];
        if (phoneDigits.length >= 4) {
          orFilters.push(`telefone.ilike.%${phoneDigits}%`);
          orFilters.push(`phone.ilike.%${phoneDigits}%`);
        }
        query = query.or(orFilters.join(","));
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      setLeads(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar leads:", error);
      toast.error("Erro ao carregar leads disponíveis");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLead) {
      toast.error("Selecione um lead");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          funil_id: funilId,
          etapa_id: etapaInicial.id,
          status: "ativo"
        })
        .eq("id", selectedLead);

      if (error) throw error;

      toast.success("Lead adicionado ao funil com sucesso!");
      setOpen(false);
      onLeadAdded();
    } catch (error: any) {
      console.error("Erro ao adicionar lead ao funil:", error);
      toast.error("Erro ao adicionar lead ao funil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Lead Existente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Lead ao Funil</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Buscar (nome ou telefone)</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex: Maria ou 5599999"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead">Selecionar Lead *</Label>
            <Select
              value={selectedLead}
              onValueChange={setSelectedLead}
            >
              <SelectTrigger id="lead">
                <SelectValue placeholder="Escolha um lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    <div className="flex flex-col">
                      <span>{lead.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {lead.company && `${lead.company} • `}
                        {lead.telefone || (lead as any).phone || lead.email}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {leads.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum lead disponível
                  </div>
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Apenas leads que não estão em nenhum funil são exibidos
            </p>
          </div>

          <div className="pt-4 border-t flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedLead}
            >
              {loading ? "Adicionando..." : "Adicionar ao Funil"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

