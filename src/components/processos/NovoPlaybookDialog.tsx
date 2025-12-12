import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NovoPlaybookDialogProps {
  companyId: string | null;
  onSuccess: () => void;
}

export function NovoPlaybookDialog({ companyId, onSuccess }: NovoPlaybookDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("atendimento");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !title) return;

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from('processes_playbooks').insert({
        company_id: companyId,
        owner_id: userData.user.id,
        title,
        type,
        category,
        content,
        is_active: true
      });

      if (error) throw error;

      toast({ title: "Playbook criado com sucesso!" });
      setOpen(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao criar playbook", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setType("atendimento");
    setCategory("");
    setContent("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Playbook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Novo Playbook Comercial
          </DialogTitle>
          <DialogDescription>
            Crie um script de atendimento, prospecção, follow-up ou fechamento
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título do Playbook *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Script de Primeiro Contato"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="prospeccao">Prospecção</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="fechamento">Fechamento</SelectItem>
                  <SelectItem value="objecoes">Objeções</SelectItem>
                  <SelectItem value="pos_venda">Pós-venda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: WhatsApp, Telefone, E-mail"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Conteúdo do Script</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Digite o script completo aqui..."
              className="min-h-[200px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !title}>
              {loading ? "Salvando..." : "Criar Playbook"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
