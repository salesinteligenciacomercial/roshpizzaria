import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, GitBranch, Trash2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NovaEtapaDialogProps {
  companyId: string | null;
  stagesCount: number;
  onSuccess: () => void;
}

export function NovaEtapaDialog({ companyId, stagesCount, onSuccess }: NovaEtapaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stageName, setStageName] = useState("");
  const [objectives, setObjectives] = useState("");
  const [maxTimeHours, setMaxTimeHours] = useState<number | "">("");
  const [checklist, setChecklist] = useState<string[]>([""]);
  const [dos, setDos] = useState<string[]>([""]);
  const [donts, setDonts] = useState<string[]>([""]);
  const { toast } = useToast();

  const handleAddItem = (setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => [...prev, ""]);
  };

  const handleRemoveItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setter(prev => {
      const newArr = [...prev];
      newArr[index] = value;
      return newArr;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !stageName) return;

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from('processes_stages').insert({
        company_id: companyId,
        owner_id: userData.user.id,
        stage_name: stageName,
        stage_order: stagesCount + 1,
        objectives,
        max_time_hours: maxTimeHours || null,
        checklist: checklist.filter(c => c.trim()),
        dos_and_donts: {
          dos: dos.filter(d => d.trim()),
          donts: donts.filter(d => d.trim())
        }
      });

      if (error) throw error;

      toast({ title: "Etapa criada com sucesso!" });
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao criar etapa", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStageName("");
    setObjectives("");
    setMaxTimeHours("");
    setChecklist([""]);
    setDos([""]);
    setDonts([""]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Etapa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-green-500" />
            Nova Etapa do Processo
          </DialogTitle>
          <DialogDescription>
            Configure uma etapa do seu fluxo comercial com checklists e objetivos
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stageName">Nome da Etapa *</Label>
              <Input
                id="stageName"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Ex: Qualificação"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTime">Tempo Máximo (horas)</Label>
              <Input
                id="maxTime"
                type="number"
                min="1"
                value={maxTimeHours}
                onChange={(e) => setMaxTimeHours(e.target.value ? parseInt(e.target.value) : "")}
                placeholder="Ex: 24"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="objectives">Objetivos da Etapa</Label>
            <Textarea
              id="objectives"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              placeholder="Descreva os objetivos desta etapa..."
              className="min-h-[80px]"
            />
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Checklist
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem(setChecklist)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {checklist.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => handleUpdateItem(setChecklist, index, e.target.value)}
                    placeholder={`Item ${index + 1} do checklist`}
                  />
                  {checklist.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(setChecklist, index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Do's */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-green-600">✓ O que fazer (Do's)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem(setDos)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {dos.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => handleUpdateItem(setDos, index, e.target.value)}
                    placeholder="Ex: Personalizar a abordagem"
                    className="border-green-200 focus:border-green-400"
                  />
                  {dos.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(setDos, index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Don'ts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-red-600">✗ O que não fazer (Don'ts)</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => handleAddItem(setDonts)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {donts.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => handleUpdateItem(setDonts, index, e.target.value)}
                    placeholder="Ex: Pressionar demais o cliente"
                    className="border-red-200 focus:border-red-400"
                  />
                  {donts.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveItem(setDonts, index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !stageName}>
              {loading ? "Salvando..." : "Criar Etapa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
