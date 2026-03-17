import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useScripts, ProspectingScript } from "@/hooks/useInteractions";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const CATEGORIES = [
  { value: "primeira_abordagem", label: "Primeira Abordagem" },
  { value: "followup", label: "Follow-Up" },
  { value: "fechamento", label: "Fechamento" },
  { value: "objecao", label: "Objeção" },
  { value: "geral", label: "Geral" },
];

export function ScriptLibrary({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { data: scripts, isLoading } = useScripts();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", category: "geral", content: "" });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.content) {
      toast({ title: "Preencha nome e conteúdo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      if (!companyId) throw new Error("Sem empresa");

      const { error } = await supabase.from("prospecting_scripts").insert({
        company_id: companyId,
        name: form.name,
        category: form.category,
        content: form.content,
      });
      if (error) throw error;

      toast({ title: "Script salvo!" });
      setForm({ name: "", category: "geral", content: "" });
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["prospecting_scripts"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("prospecting_scripts").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Script excluído" });
      queryClient.invalidateQueries({ queryKey: ["prospecting_scripts"] });
    }
  };

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Biblioteca de Scripts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button variant="outline" size="sm" onClick={() => setShowNew(!showNew)}>
            <Plus className="h-4 w-4 mr-1" /> Novo Script
          </Button>

          {showNew && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Abordagem LinkedIn" />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={v => set("category", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Conteúdo</Label>
                  <Textarea value={form.content} onChange={e => set("content", e.target.value)} placeholder="Texto do script..." rows={5} />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    {saving ? "Salvando..." : "Salvar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : !scripts || scripts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum script criado ainda.</p>
            ) : (
              scripts.map(s => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{s.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                            {CATEGORIES.find(c => c.value === s.category)?.label || s.category}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{s.content}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(s.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
