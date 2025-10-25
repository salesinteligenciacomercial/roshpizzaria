import { useState } from "react";
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
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdicionarEtapaDialogProps {
  funilId: string;
  onEtapaAdded: () => void;
}

const CORES_PADRAO = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#8b5cf6", "#ec4899"];

export function AdicionarEtapaDialog({ funilId, onEtapaAdded }: AdicionarEtapaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_PADRAO[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome.trim()) {
      toast.error("Digite o nome da etapa");
      return;
    }

    setLoading(true);

    try {
      // Pegar company_id do usuário
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", userData.user.id)
        .single();

      if (!userRole) throw new Error("Empresa não encontrada");

      // Buscar maior posição atual
      const { data: etapas } = await supabase
        .from("etapas")
        .select("posicao")
        .eq("funil_id", funilId)
        .order("posicao", { ascending: false })
        .limit(1);

      const novaPosicao = etapas && etapas.length > 0 ? etapas[0].posicao + 1 : 0;

      // Criar nova etapa
      const { error } = await supabase.from("etapas").insert({
        nome: nome.trim(),
        cor,
        posicao: novaPosicao,
        funil_id: funilId,
        company_id: userRole.company_id,
      });

      if (error) throw error;

      toast.success("Etapa adicionada com sucesso!");
      setNome("");
      setCor(CORES_PADRAO[0]);
      setOpen(false);
      onEtapaAdded();
    } catch (error) {
      console.error("Erro ao adicionar etapa:", error);
      toast.error("Erro ao adicionar etapa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nova Etapa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Etapa</DialogTitle>
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
              {loading ? "Adicionando..." : "Adicionar Etapa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
