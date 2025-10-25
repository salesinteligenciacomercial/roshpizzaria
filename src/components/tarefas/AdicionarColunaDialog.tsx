import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdicionarColunaDialogProps {
  boardId: string;
  currentColumnsCount: number;
  onColumnAdded: () => void;
}

const CORES_PADRAO = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#eab308", // yellow
  "#f97316", // orange
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

export function AdicionarColunaDialog({ 
  boardId, 
  currentColumnsCount, 
  onColumnAdded 
}: AdicionarColunaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_PADRAO[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nomeFormatado = nome.trim();
    
    if (!nomeFormatado) {
      toast.error("Digite o nome da coluna");
      return;
    }

    if (nomeFormatado.length < 2) {
      toast.error("Nome deve ter pelo menos 2 caracteres");
      return;
    }

    if (nomeFormatado.length > 50) {
      toast.error("Nome deve ter no máximo 50 caracteres");
      return;
    }

    setLoading(true);

    try {
      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "criar_coluna",
          data: {
            nome: nomeFormatado,
            board_id: boardId,
            posicao: currentColumnsCount,
            cor: cor,
          },
        },
      });

      toast.success(`Coluna "${nomeFormatado}" criada com sucesso!`);
      setNome("");
      setCor(CORES_PADRAO[0]);
      setOpen(false);
      onColumnAdded();
    } catch (error: any) {
      console.error("Erro ao criar coluna:", error);
      toast.error(error.message || "Erro ao criar coluna");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nova Coluna
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Coluna</DialogTitle>
          <DialogDescription>
            Crie uma nova coluna para organizar suas tarefas
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Coluna *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Em Revisão, Aguardando Cliente"
              disabled={loading}
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {nome.length}/50 caracteres
            </p>
          </div>

          <div>
            <Label>Cor da Coluna</Label>
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
              {loading ? "Criando..." : "Criar Coluna"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
