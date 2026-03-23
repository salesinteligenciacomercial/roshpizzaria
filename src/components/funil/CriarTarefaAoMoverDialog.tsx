import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CriarTarefaAoMoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  etapaDestino: string;
}

export function CriarTarefaAoMoverDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  etapaDestino,
}: CriarTarefaAoMoverDialogProps) {
  const [title, setTitle] = useState(`Acompanhar ${leadName} - ${etapaDestino}`);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("media");
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate,
        status: "pendente",
        lead_id: leadId,
        owner_id: user.id,
        company_id: profile.company_id,
        assigned_to: user.id,
      });

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!", {
        description: `"${title}" vinculada ao lead ${leadName}`,
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao criar tarefa:", err);
      toast.error("Erro ao criar tarefa", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-primary" />
            Criar tarefa para este lead?
          </DialogTitle>
          <DialogDescription>
            <strong>{leadName}</strong> foi movido para <strong>{etapaDestino}</strong>. Deseja criar uma tarefa de acompanhamento?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Título da tarefa</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Enviar proposta, Ligar para cliente..."
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data limite</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Não, obrigado
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Criando..." : "Criar Tarefa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
