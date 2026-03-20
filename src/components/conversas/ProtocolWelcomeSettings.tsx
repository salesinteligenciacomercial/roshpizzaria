import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getProtocolWelcomeTemplate,
  setProtocolWelcomeTemplate,
  isProtocolWelcomeEnabled,
  setProtocolWelcomeEnabled,
} from "@/hooks/useAttendanceProtocol";
import { toast } from "sonner";

export function ProtocolWelcomeSettings() {
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (open) {
      setTemplate(getProtocolWelcomeTemplate());
      setEnabled(isProtocolWelcomeEnabled());
    }
  }, [open]);

  const handleSave = () => {
    setProtocolWelcomeTemplate(template);
    setProtocolWelcomeEnabled(enabled);
    toast.success("Configurações do protocolo salvas!");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Configurar mensagem de protocolo">
          <Settings2 className="h-3.5 w-3.5" />
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
              onCheckedChange={setEnabled}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Modelo da mensagem</Label>
            <Textarea
              rows={6}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              disabled={!enabled}
              placeholder="Digite o modelo da mensagem..."
            />
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px] font-mono">{"{protocolo}"}</Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">{"{nome}"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Use as variáveis acima para personalizar a mensagem. Elas serão substituídas pelo número do protocolo e nome do contato.
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
