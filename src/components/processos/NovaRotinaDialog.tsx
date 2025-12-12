import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Workflow, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

interface Step {
  day: number;
  action: string;
  channel: string;
  description: string;
}

interface NovaRotinaDialogProps {
  companyId: string | null;
  onSuccess: () => void;
}

export function NovaRotinaDialog({ companyId, onSuccess }: NovaRotinaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("prospeccao");
  const [channels, setChannels] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([{ day: 1, action: "", channel: "whatsapp", description: "" }]);
  const { toast } = useToast();

  const channelOptions = [
    { id: "whatsapp", label: "WhatsApp" },
    { id: "telefone", label: "Telefone" },
    { id: "email", label: "E-mail" },
    { id: "sms", label: "SMS" },
    { id: "linkedin", label: "LinkedIn" }
  ];

  const handleChannelToggle = (channelId: string) => {
    setChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const addStep = () => {
    const lastDay = steps.length > 0 ? steps[steps.length - 1].day : 0;
    setSteps([...steps, { day: lastDay + 1, action: "", channel: "whatsapp", description: "" }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, field: keyof Step, value: string | number) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !name) return;

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from('processes_routines').insert([{
        company_id: companyId,
        owner_id: userData.user.id,
        name,
        type,
        channels: channels as unknown as Json,
        steps: steps as unknown as Json,
        is_active: true
      }]);

      if (error) throw error;

      toast({ title: "Rotina criada com sucesso!" });
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao criar rotina", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setType("prospeccao");
    setChannels([]);
    setSteps([{ day: 1, action: "", channel: "whatsapp", description: "" }]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Rotina
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-purple-500" />
            Nova Cadência/Rotina
          </DialogTitle>
          <DialogDescription>
            Configure uma rotina de prospecção com etapas, canais e intervalos
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Rotina *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Cadência de Prospecção Ativa"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospeccao">Prospecção</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="reativacao">Reativação</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                  <SelectItem value="pos_venda">Pós-venda</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Canais Utilizados</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {channelOptions.map(channel => (
                <div key={channel.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={channel.id}
                    checked={channels.includes(channel.id)}
                    onCheckedChange={() => handleChannelToggle(channel.id)}
                  />
                  <Label htmlFor={channel.id} className="text-sm font-normal cursor-pointer">
                    {channel.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Etapas da Cadência</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Etapa
              </Button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {steps.map((step, index) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Etapa {index + 1}</span>
                    {steps.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeStep(index)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Dia</Label>
                      <Input
                        type="number"
                        min="1"
                        value={step.day}
                        onChange={(e) => updateStep(index, 'day', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Canal</Label>
                      <Select value={step.channel} onValueChange={(v) => updateStep(index, 'channel', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="telefone">Telefone</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Ação</Label>
                      <Input
                        value={step.action}
                        onChange={(e) => updateStep(index, 'action', e.target.value)}
                        placeholder="Ex: Enviar mensagem"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Textarea
                      value={step.description}
                      onChange={(e) => updateStep(index, 'description', e.target.value)}
                      placeholder="Descreva o que fazer nesta etapa..."
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name}>
              {loading ? "Salvando..." : "Criar Rotina"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
