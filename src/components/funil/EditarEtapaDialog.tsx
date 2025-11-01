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
    
    const nomeFormatado = nome.trim();
    
    if (!nomeFormatado) {
      toast.error("Digite o nome da etapa");
      return;
    }

    if (nomeFormatado.length < 3) {
      toast.error("Nome deve ter pelo menos 3 caracteres");
      return;
    }

    if (nomeFormatado.length > 50) {
      toast.error("Nome deve ter no máximo 50 caracteres");
      return;
    }

    setLoading(true);

    try {
      // Buscar funil_id da etapa atual
      const { data: etapaAtual } = await supabase
        .from("etapas")
        .select("funil_id")
        .eq("id", etapaId)
        .single();

      if (!etapaAtual) throw new Error("Etapa não encontrada");

      // Verificar duplicata apenas se mudou o nome
      if (nomeFormatado.toLowerCase() !== nomeAtual.toLowerCase()) {
        const { data: etapaExistente } = await supabase
          .from("etapas")
          .select("id")
          .eq("funil_id", etapaAtual.funil_id)
          .ilike("nome", nomeFormatado)
          .neq("id", etapaId)
          .maybeSingle();

        if (etapaExistente) {
          toast.error("Já existe uma etapa com este nome neste funil");
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.rpc("update_etapa", {
        p_etapa_id: etapaId,
        p_nome: nomeFormatado,
        p_cor: cor,
        p_posicao: null,
      });

      if (error) throw error;

      toast.success(`Etapa "${nomeFormatado}" atualizada com sucesso!`);
      setOpen(false);
      onEtapaUpdated();
    } catch (error: any) {
      console.error("Erro ao atualizar etapa:", error);
      toast.error(error.message || "Erro ao atualizar etapa");
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
            <Label htmlFor="nome">Nome da Etapa *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Qualificação, Negociação"
              disabled={loading}
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {nome.length}/50 caracteres
            </p>
          </div>

          <div>
            <Label>Cor da Etapa</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {CORES_PADRAO.map((corPadrao) => (
                <button
                  key={corPadrao}
                  type="button"
                  className="w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 shadow-sm"
                  style={{
                    backgroundColor: corPadrao,
                    borderColor: cor === corPadrao ? "#000" : "transparent",
                    boxShadow: cor === corPadrao ? "0 0 0 2px rgba(0,0,0,0.1)" : "none",
                  }}
                  onClick={() => setCor(corPadrao)}
                  disabled={loading}
                  title={corPadrao}
                />
              ))}
              <div className="flex items-center ml-2">
                <Input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-10 h-10 p-1 cursor-pointer"
                  disabled={loading}
                  title="Escolher cor personalizada"
                />
              </div>
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
