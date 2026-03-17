import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScripts, OUTCOME_OPTIONS } from "@/hooks/useInteractions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  logType: "prospecting" | "followup";
  onSuccess: () => void;
}

interface LeadOption {
  id: string;
  name: string;
  phone: string | null;
}

export function InteractionLogDialog({ open, onOpenChange, logType, onSuccess }: Props) {
  const { toast } = useToast();
  const { data: scripts } = useScripts();
  const [loading, setLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadOptions, setLeadOptions] = useState<LeadOption[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadOption | null>(null);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  const [form, setForm] = useState({
    interaction_date: new Date().toISOString().slice(0, 10),
    channel: "whatsapp",
    script_used: "",
    outcome: "contacted",
    interaction_summary: "",
    gross_value: "",
    next_action: "",
    next_action_date: "",
  });

  useEffect(() => {
    if (leadSearch.length < 2) {
      setLeadOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, name, telefone, phone")
        .or(`name.ilike.%${leadSearch}%,telefone.ilike.%${leadSearch}%,phone.ilike.%${leadSearch}%`)
        .limit(10);

      if (data) {
        setLeadOptions(data.map(l => ({
          id: l.id,
          name: l.name || "Sem nome",
          phone: l.telefone || l.phone || null,
        })));
        setShowLeadDropdown(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: companyId } = await supabase.rpc("get_my_company_id");

      if (!userData.user || !companyId) {
        toast({ title: "Erro de autenticação", variant: "destructive" });
        return;
      }

      const { error } = await supabase.from("prospecting_interactions").insert({
        company_id: companyId,
        user_id: userData.user.id,
        log_type: logType,
        lead_id: selectedLead?.id || null,
        lead_name: selectedLead?.name || null,
        lead_phone: selectedLead?.phone || null,
        interaction_date: form.interaction_date,
        channel: form.channel,
        script_used: form.script_used || null,
        outcome: form.outcome,
        interaction_summary: form.interaction_summary || null,
        gross_value: parseFloat(form.gross_value) || 0,
        next_action: form.next_action || null,
        next_action_date: form.next_action_date || null,
      });

      if (error) throw error;

      toast({ title: "Interação registrada com sucesso!" });
      onOpenChange(false);
      onSuccess();
      resetForm();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      interaction_date: new Date().toISOString().slice(0, 10),
      channel: "whatsapp",
      script_used: "",
      outcome: "contacted",
      interaction_summary: "",
      gross_value: "",
      next_action: "",
      next_action_date: "",
    });
    setSelectedLead(null);
    setLeadSearch("");
  };

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Interação Individual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Lead search */}
          <div className="relative">
            <Label>Lead</Label>
            {selectedLead ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <div className="flex-1">
                  <span className="font-medium text-sm">{selectedLead.name}</span>
                  {selectedLead.phone && (
                    <span className="text-xs text-muted-foreground ml-2">{selectedLead.phone}</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedLead(null); setLeadSearch(""); }}>
                  Trocar
                </Button>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Buscar lead por nome ou telefone..."
                  value={leadSearch}
                  onChange={e => setLeadSearch(e.target.value)}
                  onFocus={() => leadOptions.length > 0 && setShowLeadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowLeadDropdown(false), 200)}
                />
                {showLeadDropdown && leadOptions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {leadOptions.map(l => (
                      <button
                        key={l.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onMouseDown={() => {
                          setSelectedLead(l);
                          setLeadSearch("");
                          setShowLeadDropdown(false);
                        }}
                      >
                        <span className="font-medium">{l.name}</span>
                        {l.phone && <span className="text-muted-foreground ml-2 text-xs">{l.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.interaction_date} onChange={e => set("interaction_date", e.target.value)} />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={v => set("channel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="social">Social Selling</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Script Usado</Label>
              <Select value={form.script_used} onValueChange={v => set("script_used", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum / Livre</SelectItem>
                  {(scripts || []).map(s => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resultado</Label>
              <Select value={form.outcome} onValueChange={v => set("outcome", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTCOME_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Resumo da Interação</Label>
            <Textarea
              value={form.interaction_summary}
              onChange={e => set("interaction_summary", e.target.value)}
              placeholder="O que foi conversado, objeções, interesse demonstrado..."
              rows={3}
            />
          </div>

          {form.outcome === "sale_closed" && (
            <div>
              <Label>Valor da Venda (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.gross_value} onChange={e => set("gross_value", e.target.value)} placeholder="0,00" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Próximo Passo</Label>
              <Input value={form.next_action} onChange={e => set("next_action", e.target.value)} placeholder="Ex: Enviar proposta" />
            </div>
            <div>
              <Label>Data Próx. Passo</Label>
              <Input type="date" value={form.next_action_date} onChange={e => set("next_action_date", e.target.value)} />
            </div>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Interação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
