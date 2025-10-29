import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

interface FilaData {
  id?: string;
  nome: string;
  descricao?: string;
  ativa?: boolean;
  prioridade?: number;
}

interface FilaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: FilaData | null;
  onSaved?: () => void;
}

export function FilaDialog({ open, onOpenChange, initialData, onSaved }: FilaDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [prioridade, setPrioridade] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome || "");
      setDescricao(initialData.descricao || "");
      setAtiva(initialData.ativa ?? true);
      setPrioridade(initialData.prioridade ?? 0);
    } else {
      setNome("");
      setDescricao("");
      setAtiva(true);
      setPrioridade(0);
    }
  }, [initialData, open]);

  const handleSubmit = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (initialData?.id) {
        const { error } = await supabase
          .from("filas_atendimento")
          .update({ nome, descricao, ativa, prioridade })
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("filas_atendimento")
          .insert([{ nome, descricao, ativa, prioridade, owner_id: user.id }]);
        if (error) throw error;
      }

      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      console.error("Erro ao salvar fila:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Editar Fila" : "Nova Fila"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Suporte Nível 1" />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Opcional" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input
                type="number"
                value={prioridade}
                onChange={(e) => setPrioridade(Number.isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch checked={ativa} onCheckedChange={setAtiva} />
              <Label>Ativa</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !nome.trim()}>
            {initialData?.id ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


