import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MoverLeadFunilDialogProps {
  leadId: string;
  leadNome: string;
  funilAtualId?: string;
  etapaAtualId?: string;
  onLeadMoved: () => void;
}

interface Funil {
  id: string;
  nome: string;
}

interface Etapa {
  id: string;
  nome: string;
  funil_id: string;
  cor: string;
}

export function MoverLeadFunilDialog({ 
  leadId, 
  leadNome, 
  funilAtualId, 
  etapaAtualId,
  onLeadMoved 
}: MoverLeadFunilDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string>("");
  const [selectedEtapa, setSelectedEtapa] = useState<string>("");

  useEffect(() => {
    if (open) {
      carregarFunis();
    }
  }, [open]);

  useEffect(() => {
    if (selectedFunil) {
      carregarEtapas(selectedFunil);
    } else {
      setEtapas([]);
      setSelectedEtapa("");
    }
  }, [selectedFunil]);

  const carregarFunis = async () => {
    try {
      const { data, error } = await supabase
        .from("funis")
        .select("id, nome")
        .order("criado_em");

      if (error) throw error;

      setFunis(data || []);

      // Se há funil atual, seleciona automaticamente
      if (funilAtualId && data?.some(f => f.id === funilAtualId)) {
        setSelectedFunil(funilAtualId);
      }
    } catch (error: any) {
      console.error("Erro ao carregar funis:", error);
      toast.error("Erro ao carregar funis");
    }
  };

  const carregarEtapas = async (funilId: string) => {
    try {
      const { data, error } = await supabase
        .from("etapas")
        .select("id, nome, funil_id, cor")
        .eq("funil_id", funilId)
        .order("posicao");

      if (error) throw error;

      setEtapas(data || []);

      // Se há etapa atual no funil selecionado, seleciona automaticamente
      if (etapaAtualId && funilId === funilAtualId && data?.some(e => e.id === etapaAtualId)) {
        setSelectedEtapa(etapaAtualId);
      } else if (data && data.length > 0) {
        // Seleciona a primeira etapa por padrão
        setSelectedEtapa(data[0].id);
      }
    } catch (error: any) {
      console.error("Erro ao carregar etapas:", error);
      toast.error("Erro ao carregar etapas");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFunil) {
      toast.error("Selecione um funil");
      return;
    }

    if (!selectedEtapa) {
      toast.error("Selecione uma etapa");
      return;
    }

    // Verificar se já está nessa posição
    if (selectedFunil === funilAtualId && selectedEtapa === etapaAtualId) {
      toast.info("Lead já está nesta etapa");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({
          funil_id: selectedFunil,
          etapa_id: selectedEtapa,
        })
        .eq("id", leadId);

      if (error) throw error;

      const funilNome = funis.find(f => f.id === selectedFunil)?.nome;
      const etapaNome = etapas.find(e => e.id === selectedEtapa)?.nome;

      toast.success(`Lead "${leadNome}" movido para ${funilNome} - ${etapaNome}`);
      setOpen(false);
      onLeadMoved();
    } catch (error: any) {
      console.error("Erro ao mover lead:", error);
      toast.error(error.message || "Erro ao mover lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          title="Mover para outro funil"
        >
          <ArrowRightLeft className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover Lead Entre Funis</DialogTitle>
          <DialogDescription>
            Mover <strong>{leadNome}</strong> para outro funil/etapa
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="funil">Selecionar Funil *</Label>
            <Select
              value={selectedFunil}
              onValueChange={setSelectedFunil}
              disabled={loading}
            >
              <SelectTrigger id="funil">
                <SelectValue placeholder="Escolha um funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    {funil.nome}
                    {funil.id === funilAtualId && " (Atual)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="etapa">Selecionar Etapa *</Label>
            <Select
              value={selectedEtapa}
              onValueChange={setSelectedEtapa}
              disabled={loading || !selectedFunil}
            >
              <SelectTrigger id="etapa">
                <SelectValue placeholder="Escolha uma etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((etapa) => (
                  <SelectItem key={etapa.id} value={etapa.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: etapa.cor }}
                      />
                      {etapa.nome}
                      {etapa.id === etapaAtualId && " (Atual)"}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedFunil && (
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um funil primeiro
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Movendo..." : "Mover Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
