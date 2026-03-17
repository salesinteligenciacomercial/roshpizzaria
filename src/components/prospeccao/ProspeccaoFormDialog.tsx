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
  channelType: "organic" | "paid";
  onSuccess: () => void;
}

const ORGANIC_SOURCES = [
  { value: "disparo_massa", label: "Disparo em Massa" },
  { value: "ligacao", label: "Ligação" },
  { value: "social_selling", label: "Social Selling" },
  { value: "indicacao", label: "Indicação" },
  { value: "outro", label: "Outro" },
];

const PAID_SOURCES = [
  { value: "facebook_ads", label: "Facebook / Instagram Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "tiktok_ads", label: "TikTok Ads" },
  { value: "linkedin_ads", label: "LinkedIn Ads" },
  { value: "outro", label: "Outro" },
];

export function ProspeccaoFormDialog({ open, onOpenChange, channelType, onSuccess }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    log_date: new Date().toISOString().slice(0, 10),
    source: "",
    leads_prospected: 0,
    opportunities: 0,
    meetings_scheduled: 0,
    sales_closed: 0,
    gross_value: 0,
    ad_spend: 0,
    notes: "",
  });

  const sources = channelType === "organic" ? ORGANIC_SOURCES : PAID_SOURCES;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const companyId = await supabase.rpc("get_my_company_id");

      if (!user.user || !companyId.data) {
        toast({ title: "Erro de autenticação", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("prospecting_daily_logs").insert({
        company_id: companyId.data,
        user_id: user.user.id,
        log_date: form.log_date,
        channel_type: channelType,
        source: form.source || null,
        leads_prospected: form.leads_prospected,
        opportunities: form.opportunities,
        meetings_scheduled: form.meetings_scheduled,
        sales_closed: form.sales_closed,
        gross_value: form.gross_value,
        ad_spend: channelType === "paid" ? form.ad_spend : 0,
        notes: form.notes || null,
      });

      if (error) throw error;

      toast({ title: "Registro salvo com sucesso!" });
      onOpenChange(false);
      onSuccess();
      setForm({
        log_date: new Date().toISOString().slice(0, 10),
        source: "",
        leads_prospected: 0,
        opportunities: 0,
        meetings_scheduled: 0,
        sales_closed: 0,
        gross_value: 0,
        ad_spend: 0,
        notes: "",
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Prospecção — {channelType === "organic" ? "Orgânica" : "Tráfego Pago"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
            </div>
            <div>
              <Label>Fonte</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {sources.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {channelType === "paid" && (
            <div>
              <Label>Gasto em Ads (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.ad_spend} onChange={(e) => setForm({ ...form, ad_spend: parseFloat(e.target.value) || 0 })} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Leads Prospectados</Label>
              <Input type="number" min={0} value={form.leads_prospected} onChange={(e) => setForm({ ...form, leads_prospected: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Oportunidades</Label>
              <Input type="number" min={0} value={form.opportunities} onChange={(e) => setForm({ ...form, opportunities: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reuniões Agendadas</Label>
              <Input type="number" min={0} value={form.meetings_scheduled} onChange={(e) => setForm({ ...form, meetings_scheduled: parseInt(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Vendas Fechadas</Label>
              <Input type="number" min={0} value={form.sales_closed} onChange={(e) => setForm({ ...form, sales_closed: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div>
            <Label>Valor Bruto (R$)</Label>
            <Input type="number" min={0} step="0.01" value={form.gross_value} onChange={(e) => setForm({ ...form, gross_value: parseFloat(e.target.value) || 0 })} />
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas sobre o dia..." />
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Registro"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
