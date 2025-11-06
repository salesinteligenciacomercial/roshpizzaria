import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AgendaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    nome: string;
    telefone?: string;
  };
  onAgendamentoCriado?: () => void;
}

export function AgendaModal({ open, onOpenChange, lead, onAgendamentoCriado }: AgendaModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    data_hora_inicio: "",
    data_hora_fim: "",
    tipo_servico: "",
    observacoes: "",
    custo_estimado: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.titulo.trim()) {
      toast.error("Digite o título do compromisso");
      return;
    }

    if (!formData.data_hora_inicio || !formData.data_hora_fim) {
      toast.error("Selecione a data e hora do compromisso");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Converter datas para ISO e validar
      const inicio = new Date(formData.data_hora_inicio);
      const fim = new Date(formData.data_hora_fim);
      if (isNaN(inicio.getTime()) || isNaN(fim.getTime())) {
        toast.error("Datas inválidas");
        return;
      }
      if (fim <= inicio) {
        toast.error("Data/hora fim deve ser após o início");
        return;
      }

      const inicioISO = inicio.toISOString();
      const fimISO = fim.toISOString();

      // Buscar company_id (usuário ou do lead como fallback)
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .single();
      const { data: leadRow } = await supabase
        .from('leads')
        .select('company_id')
        .eq('id', lead.id)
        .single();
      const companyId = userRole?.company_id || leadRow?.company_id || undefined;

      // Criar compromisso e obter o id
      const insertPayload: any = {
        data_hora_inicio: inicioISO,
        data_hora_fim: fimISO,
        tipo_servico: formData.tipo_servico?.trim() || 'reuniao',
        observacoes: formData.observacoes,
        custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : null,
        lead_id: lead.id,
        owner_id: session.user.id,
        usuario_responsavel_id: session.user.id,
        status: "agendado"
      };
      if (companyId) insertPayload.company_id = companyId;

      const { data: compromissoCriado, error } = await supabase
        .from("compromissos")
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) throw error;

      // Criar lembrete automático
      if (lead.telefone && compromissoCriado?.id) {
        const lembretePayload: any = {
          compromisso_id: compromissoCriado.id,
          canal: "whatsapp",
          horas_antecedencia: 24,
          mensagem: `Olá ${lead.nome}! Lembrete do seu compromisso: ${formData.titulo} agendado para ${new Date(formData.data_hora_inicio).toLocaleString()}`,
          status_envio: 'pendente',
          destinatario: 'lead'
        };
        if (companyId) lembretePayload.company_id = companyId;
        await supabase.from("lembretes").insert(lembretePayload);
      }

      toast.success("Compromisso agendado com sucesso!");
      onOpenChange(false);
      onAgendamentoCriado?.();

      // Limpar formulário
      setFormData({
        titulo: "",
        data_hora_inicio: "",
        data_hora_fim: "",
        tipo_servico: "",
        observacoes: "",
        custo_estimado: ""
      });
    } catch (error: any) {
      console.error("Erro ao criar compromisso:", error);
      toast.error(error?.message || "Erro ao agendar compromisso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Agendar Compromisso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 flex-1" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div>
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Reunião de apresentação"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_hora_inicio">Data/Hora Início *</Label>
              <Input
                id="data_hora_inicio"
                type="datetime-local"
                value={formData.data_hora_inicio}
                onChange={(e) => setFormData({ ...formData, data_hora_inicio: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="data_hora_fim">Data/Hora Fim *</Label>
              <Input
                id="data_hora_fim"
                type="datetime-local"
                value={formData.data_hora_fim}
                onChange={(e) => setFormData({ ...formData, data_hora_fim: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tipo_servico">Tipo de Serviço</Label>
            <Select
              value={formData.tipo_servico}
              onValueChange={(value) => setFormData({ ...formData, tipo_servico: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reuniao">Reunião</SelectItem>
                <SelectItem value="apresentacao">Apresentação</SelectItem>
                <SelectItem value="visita">Visita</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="custo_estimado">Custo Estimado (R$)</Label>
            <Input
              id="custo_estimado"
              type="number"
              step="0.01"
              value={formData.custo_estimado}
              onChange={(e) => setFormData({ ...formData, custo_estimado: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais sobre o compromisso"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

