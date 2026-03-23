import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings2, Send, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getProtocolWelcomeTemplate,
  setProtocolWelcomeTemplate,
  isProtocolWelcomeEnabled,
  setProtocolWelcomeEnabled,
} from "@/hooks/useAttendanceProtocol";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProtocolWelcomeSettingsProps {
  protocolNumber?: string | null;
  contactPhone?: string;
  contactName?: string;
  companyId?: string | null;
}

export function ProtocolWelcomeSettings({ protocolNumber, contactPhone, contactName, companyId }: ProtocolWelcomeSettingsProps) {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setTemplate(getProtocolWelcomeTemplate());
      setEnabled(isProtocolWelcomeEnabled());
    }
  }, [open]);

  const handleToggleEnabled = (value: boolean) => {
    setEnabled(value);
    setProtocolWelcomeEnabled(value);
    toast.success(value ? "Mensagem de protocolo ativada!" : "Mensagem de protocolo desativada!");
  };

  const handleSave = () => {
    setProtocolWelcomeTemplate(template);
    setProtocolWelcomeEnabled(enabled);
    toast.success("Configurações do protocolo salvas!");
    setOpen(false);
  };

  const handleSendNow = async () => {
    if (!protocolNumber || !contactPhone || !companyId) {
      toast.error("Dados insuficientes para enviar a mensagem.");
      return;
    }

    const message = template
      .replace(/{protocolo}/g, protocolNumber)
      .replace(/{nome}/g, contactName || 'cliente');

    setSending(true);
    try {
      console.log('📤 [PROTOCOL-WELCOME] Enviando:', { companyId, contactPhone, messageLength: message.length });
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          company_id: companyId,
          numero: contactPhone,
          mensagem: message,
          tipo_mensagem: 'text',
        },
      });

      console.log('📤 [PROTOCOL-WELCOME] Resposta:', { data, error });
      if (error) throw error;

      // Persist in conversas
      await supabase.from('conversas').insert({
        company_id: companyId,
        numero: contactPhone,
        telefone_formatado: contactPhone,
        mensagem: message,
        fromme: true,
        status: 'sent',
        origem: 'manual',
        sent_by: 'system_protocol',
        tipo_mensagem: 'text',
      });

      toast.success("Mensagem do protocolo enviada!");
      setOpen(false);
    } catch (err) {
      console.error('❌ [PROTOCOL-WELCOME] Erro ao enviar:', err);
      toast.error("Erro ao enviar mensagem do protocolo.");
    } finally {
      setSending(false);
    }
  };

  const previewMessage = protocolNumber
    ? template.replace(/{protocolo}/g, protocolNumber).replace(/{nome}/g, contactName || 'cliente')
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8" title="Enviar mensagem de protocolo">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mensagem de Boas-vindas do Protocolo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="protocol-welcome-enabled" className="text-sm">
              Enviar automaticamente ao criar protocolo
            </Label>
            <Switch
              id="protocol-welcome-enabled"
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Modelo da mensagem</Label>
            <Textarea
              rows={6}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Digite o modelo da mensagem..."
            />
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-mono">{"{protocolo}"}</Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">{"{nome}"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Use as variáveis acima para personalizar a mensagem.
            </p>
          </div>

          {/* Preview */}
          {previewMessage && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div className="rounded-md border border-border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                {previewMessage}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handleSave}>Salvar</Button>
            {protocolNumber && contactPhone && enabled && (
              <Button onClick={handleSendNow} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Enviar agora
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
