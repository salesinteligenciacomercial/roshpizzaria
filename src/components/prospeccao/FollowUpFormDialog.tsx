import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}

export function FollowUpFormDialog({ open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    source: "whatsapp",
    followups_sent: "",
    responses: "",
    meetings_scheduled: "",
    sales_closed: "",
    gross_value: "",
    notes: "",
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: companyId } = await supabase.rpc("get_my_company_id");

      if (!userData.user || !companyId) {
        toast({ title: "Erro de autenticação", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("followup_daily_logs").insert({
        company_id: companyId,
        user_id: userData.user.id,
        log_date: form.log_date,
        source: form.source,
        followups_sent: parseInt(form.followups_sent) || 0,
        responses: parseInt(form.responses) || 0,
        meetings_scheduled: parseInt(form.meetings_scheduled) || 0,
        sales_closed: parseInt(form.sales_closed) || 0,
        gross_value: parseFloat(form.gross_value) || 0,
        notes: form.notes || null,
      });

      if (error) throw error;

      toast({ title: "Follow-up registrado com sucesso!" });
      onOpenChange(false);
      onSuccess();
      setForm({
        log_date: new Date().toISOString().slice(0, 10),
        source: "whatsapp",
        followups_sent: "",
        responses: "",
        meetings_scheduled: "",
        sales_closed: "",
        gross_value: "",
        notes: "",
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Follow-Up</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.log_date} onChange={e => set("log_date", e.target.value)} />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={form.source} onValueChange={v => set("source", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Follow-ups Enviados</Label>
              <Input type="number" min="0" value={form.followups_sent} onChange={e => set("followups_sent", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Respostas</Label>
              <Input type="number" min="0" value={form.responses} onChange={e => set("responses", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Reuniões Agendadas</Label>
              <Input type="number" min="0" value={form.meetings_scheduled} onChange={e => set("meetings_scheduled", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Vendas</Label>
              <Input type="number" min="0" value={form.sales_closed} onChange={e => set("sales_closed", e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label>Valor Bruto (R$)</Label>
            <Input type="number" min="0" step="0.01" value={form.gross_value} onChange={e => set("gross_value", e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notas sobre o follow-up do dia..." />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Follow-Up"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
