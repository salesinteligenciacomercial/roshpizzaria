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

      // Buscar company_id do usuário - VALIDAÇÃO CRÍTICA
      console.log('🔍 [AgendaModal] Buscando company_id para usuário:', session.user.id);
      
      const { data: userRole, error: userRoleError } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .single();

      if (userRoleError || !userRole) {
        console.error('❌ [AgendaModal] Erro ao buscar user_role:', userRoleError);
        toast.error("Erro: Usuário não está associado a uma empresa.");
        return;
      }

      if (!userRole.company_id) {
        console.error('❌ [AgendaModal] company_id não encontrado no user_role');
        toast.error("Erro: Não foi possível identificar a empresa do usuário.");
        return;
      }

      console.log('✅ [AgendaModal] company_id obtido:', userRole.company_id);
      
      const companyId = userRole.company_id;

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
      <DialogContent className="max-w-md">
        <DialogHeader className="pb-3">
          <DialogTitle>Agendar Compromisso</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label htmlFor="titulo" className="text-sm">Título *</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Ex: Reunião de apresentação"
              required
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data_hora_inicio" className="text-sm">Data/Hora Início *</Label>
              <Input
                id="data_hora_inicio"
                type="datetime-local"
                value={formData.data_hora_inicio}
                onChange={(e) => setFormData({ ...formData, data_hora_inicio: e.target.value })}
                required
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="data_hora_fim" className="text-sm">Data/Hora Fim *</Label>
              <Input
                id="data_hora_fim"
                type="datetime-local"
                value={formData.data_hora_fim}
                onChange={(e) => setFormData({ ...formData, data_hora_fim: e.target.value })}
                required
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="tipo_servico" className="text-sm">Tipo de Serviço</Label>
              <Select
                value={formData.tipo_servico}
                onValueChange={(value) => setFormData({ ...formData, tipo_servico: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione" />
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
              <Label htmlFor="custo_estimado" className="text-sm">Custo Estimado (R$)</Label>
              <Input
                id="custo_estimado"
                type="number"
                step="0.01"
                value={formData.custo_estimado}
                onChange={(e) => setFormData({ ...formData, custo_estimado: e.target.value })}
                placeholder="0.00"
                className="h-9"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes" className="text-sm">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              size="sm"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} size="sm">
              {loading ? "Agendando..." : "Agendar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

