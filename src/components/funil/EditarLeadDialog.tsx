import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Tag, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditarLeadDialogProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    cpf?: string;
    value?: number;
    company?: string;
    source?: string;
    notes?: string;
    tags?: string[];
    funil_id?: string;
    etapa_id?: string;
  };
  onLeadUpdated: () => void;
}

export function EditarLeadDialog({ lead, onLeadUpdated }: EditarLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [funis, setFunis] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [etapasFiltradas, setEtapasFiltradas] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: lead.nome || "",
    telefone: lead.telefone || "",
    email: lead.email || "",
    cpf: lead.cpf || "",
    valor: lead.value?.toString() || "",
    company: lead.company || "",
    source: lead.source || "",
    notes: lead.notes || "",
    funil_id: lead.funil_id || "",
    etapa_id: lead.etapa_id || "",
    tags: lead.tags || []
  });
  const [newTag, setNewTag] = useState("");

  // Reset form data when lead changes
  useEffect(() => {
    setFormData({
      nome: lead.nome || "",
      telefone: lead.telefone || "",
      email: lead.email || "",
      cpf: lead.cpf || "",
      valor: lead.value?.toString() || "",
      company: lead.company || "",
      source: lead.source || "",
      notes: lead.notes || "",
      funil_id: lead.funil_id || "",
      etapa_id: lead.etapa_id || "",
      tags: lead.tags || []
    });
  }, [lead]);

  useEffect(() => {
    if (open) {
      carregarDados();
    }
  }, [open]);

  useEffect(() => {
    if (formData.funil_id) {
      const filtered = etapas.filter(e => e.funil_id === formData.funil_id);
      setEtapasFiltradas(filtered);
      if (filtered.length > 0 && !formData.etapa_id) {
        setFormData(prev => ({ ...prev, etapa_id: filtered[0].id }));
      }
    }
  }, [formData.funil_id, etapas]);

  const carregarDados = async () => {
    try {
      setInitialLoading(true);
      const { data: funisData, error: funisError } = await supabase.from("funis").select("*").order("criado_em");
      const { data: etapasData, error: etapasError } = await supabase.from("etapas").select("*").order("posicao");

      if (funisError) throw funisError;
      if (etapasError) throw etapasError;

      setFunis(funisData || []);
      setEtapas(etapasData || []);
    } catch (error) {
      console.error("Erro ao carregar dados do funil:", error);
      toast.error("Erro ao carregar dados do funil");
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error("Digite o nome do lead");
      return;
    }

    if (!formData.funil_id) {
      toast.error("Selecione um funil");
      return;
    }

    if (!formData.etapa_id) {
      toast.error("Selecione uma etapa");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Formatar telefone
      let telefoneFormatado = formData.telefone;
      if (telefoneFormatado) {
        telefoneFormatado = telefoneFormatado.replace(/\D/g, "");
        if (!telefoneFormatado.startsWith("55")) {
          telefoneFormatado = "55" + telefoneFormatado;
        }
      }

      const { error } = await supabase
        .from("leads")
        .update({
          name: formData.nome,
          telefone: telefoneFormatado || null,
          phone: telefoneFormatado || null,
          email: formData.email || null,
          cpf: formData.cpf || null,
          value: formData.valor ? parseFloat(formData.valor) : 0,
          company: formData.company || null,
          source: formData.source || null,
          notes: formData.notes || null,
          etapa_id: formData.etapa_id,
          funil_id: formData.funil_id,
          tags: formData.tags,
          updated_at: new Date().toISOString()
        })
        .eq("id", lead.id);

      if (error) {
        console.error("Erro ao atualizar lead:", error);
        throw error;
      }

      toast.success("Lead atualizado com sucesso!");
      setOpen(false);
      onLeadUpdated();
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar lead. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Lead</DialogTitle>
        </DialogHeader>
        {initialLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="funil">Funil *</Label>
            <Select 
              value={formData.funil_id} 
              onValueChange={(value) => setFormData({ ...formData, funil_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    {funil.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="etapa">Etapa *</Label>
            <Select 
              value={formData.etapa_id} 
              onValueChange={(value) => setFormData({ ...formData, etapa_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapasFiltradas.map((etapa) => (
                  <SelectItem key={etapa.id} value={etapa.id}>
                    {etapa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Nome do lead"
              required
            />
          </div>

          <div>
            <Label htmlFor="telefone">Telefone / WhatsApp</Label>
            <Input
              id="telefone"
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <Label htmlFor="valor">Valor (R$)</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="source">Origem</Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              placeholder="Ex: WhatsApp, Instagram, Indicação"
            />
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Informações adicionais sobre o lead"
            />
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                id="tags"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const tagTrimmed = newTag.trim();
                    if (tagTrimmed && !formData.tags.includes(tagTrimmed)) {
                      setFormData({ ...formData, tags: [...formData.tags, tagTrimmed] });
                      setNewTag("");
                    }
                  }
                }}
                placeholder="Digite uma tag e pressione Enter"
              />
              <Button
                type="button"
                size="icon"
                onClick={() => {
                  const tagTrimmed = newTag.trim();
                  if (tagTrimmed && !formData.tags.includes(tagTrimmed)) {
                    setFormData({ ...formData, tags: [...formData.tags, tagTrimmed] });
                    setNewTag("");
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 min-h-[60px] p-2 border rounded-md bg-muted/20">
              {formData.tags.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma tag adicionada</p>
              ) : (
                formData.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => {
                        setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}