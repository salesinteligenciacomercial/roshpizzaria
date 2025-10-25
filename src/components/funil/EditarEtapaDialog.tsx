import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditarEtapaDialogProps {
  etapaId: string;
  nomeAtual: string;
  corAtual: string;
  onEtapaUpdated: () => void;
}

const CORES_PADRAO = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#8b5cf6", "#ec4899"];

export function EditarEtapaDialog({ etapaId, nomeAtual, corAtual, onEtapaUpdated }: EditarEtapaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(nomeAtual);
  const [cor, setCor] = useState(corAtual);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(nomeAtual);
      setCor(corAtual);
    }
  }, [open, nomeAtual, corAtual]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("Digite o nome da etapa");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("etapas")
        .update({
          nome: nome.trim(),
          cor,
        })
        .eq("id", etapaId);

      if (error) throw error;

      toast.success("Etapa atualizada com sucesso!");
      setOpen(false);
      onEtapaUpdated();
    } catch (error) {
      console.error("Erro ao atualizar etapa:", error);
      toast.error("Erro ao atualizar etapa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Etapa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Etapa</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Qualificação"
              disabled={loading}
            />
          </div>

          <div>
            <Label>Cor da Etapa</Label>
            <div className="flex gap-2 mt-2">
              {CORES_PADRAO.map((corPadrao) => (
                <button
                  key={corPadrao}
                  type="button"
                  className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
                  style={{
                    backgroundColor: corPadrao,
                    borderColor: cor === corPadrao ? "#000" : "transparent",
                  }}
                  onClick={() => setCor(corPadrao)}
                  disabled={loading}
                />
              ))}
            </div>
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
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
