import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditarColunaDialogProps {
  columnId: string;
  nomeAtual: string;
  corAtual: string;
  onColumnUpdated: () => void;
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

export function EditarColunaDialog({ 
  columnId, 
  nomeAtual, 
  corAtual, 
  onColumnUpdated 
}: EditarColunaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState(nomeAtual);
  const [cor, setCor] = useState(corAtual);
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
          action: "editar_coluna",
          data: { 
            column_id: columnId, 
            nome: nomeFormatado, 
            cor: cor 
          },
        },
      });

      toast.success(`Coluna "${nomeFormatado}" atualizada com sucesso!`);
      setOpen(false);
      // ✅ OTIMIZADO: Não chamar carregarDados() - o Realtime já atualiza automaticamente
      console.log('✅ [EditarColunaDialog] Coluna atualizada - Realtime irá atualizar automaticamente');
    } catch (error: any) {
      console.error("Erro ao atualizar coluna:", error);
      toast.error(error.message || "Erro ao atualizar coluna");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen(true)}
        title="Editar Coluna"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Coluna</DialogTitle>
            <DialogDescription>
              Atualize o nome e a cor da coluna
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
                {loading ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
