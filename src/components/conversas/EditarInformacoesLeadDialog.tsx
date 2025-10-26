import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Tag, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditarInformacoesLeadDialogProps {
  leadId: string | null;
  telefone: string;
  nomeContato: string;
  onLeadUpdated: () => void;
}

export function EditarInformacoesLeadDialog({ 
  leadId, 
  telefone,
  nomeContato,
  onLeadUpdated 
}: EditarInformacoesLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [funis, setFunis] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [etapasFiltradas, setEtapasFiltradas] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: nomeContato,
    telefone: telefone,
    email: "",
    cpf: "",
    valor: "",
    company: "",
    source: "",
    notes: "",
    funil_id: "",
    etapa_id: "",
    tags: [] as string[],
    servico: "",
    segmentacao: ""
  });
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    if (open) {
      carregarDados();
    }
  }, [open]);

  useEffect(() => {
    if (formData.funil_id) {
      const filtered = etapas.filter(e => e.funil_id === formData.funil_id);
      setEtapasFiltradas(filtered);
    }
  }, [formData.funil_id, etapas]);

  const carregarDados = async () => {
    try {
      // Carregar funis e etapas
      const { data: funisData } = await supabase.from("funis").select("*").order("criado_em");
      const { data: etapasData } = await supabase.from("etapas").select("*").order("posicao");
      
      setFunis(funisData || []);
      setEtapas(etapasData || []);

      // Se existe leadId, carregar os dados completos do lead
      if (leadId) {
        console.log('📋 Carregando dados do lead:', leadId);
        const { data: leadData, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .single();

        if (leadError) {
          console.error('❌ Erro ao carregar lead:', leadError);
        }

        if (leadData) {
          console.log('✅ Dados do lead carregados:', {
            nome: leadData.name,
            tags: leadData.tags,
            totalTags: leadData.tags?.length || 0
          });
          
          setFormData({
            nome: leadData.name || nomeContato,
            telefone: leadData.telefone || telefone,
            email: leadData.email || "",
            cpf: leadData.cpf || "",
            valor: leadData.value?.toString() || "",
            company: leadData.company || "",
            source: leadData.source || "",
            notes: leadData.notes || "",
            funil_id: leadData.funil_id || (funisData && funisData.length > 0 ? funisData[0].id : ""),
            etapa_id: leadData.etapa_id || "",
            tags: Array.isArray(leadData.tags) ? leadData.tags : [],
            servico: leadData.servico || "",
            segmentacao: leadData.segmentacao || ""
          });
        }
      } else {
        console.log('ℹ️ Nenhum lead vinculado, iniciando com dados básicos');
        // Resetar para dados básicos da conversa
        setFormData(prev => ({
          ...prev,
          nome: nomeContato,
          telefone: telefone,
          funil_id: funisData && funisData.length > 0 ? funisData[0].id : "",
          tags: []
        }));
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar informações do lead");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast.error("Digite o nome do lead");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .single();

      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        setLoading(false);
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

      const leadDataToSave = {
        name: formData.nome,
        telefone: telefoneFormatado || null,
        phone: telefoneFormatado || null,
        email: formData.email || null,
        cpf: formData.cpf || null,
        value: formData.valor ? parseFloat(formData.valor) : 0,
        company: formData.company || null,
        source: formData.source || null,
        notes: formData.notes || null,
        etapa_id: formData.etapa_id || null,
        funil_id: formData.funil_id || null,
        tags: formData.tags,
        servico: formData.servico || null,
        segmentacao: formData.segmentacao || null,
        company_id: userRole.company_id,
        owner_id: session.user.id,
        status: "novo",
        stage: "prospeccao"
      };

      if (leadId) {
        // Atualizar lead existente
        console.log('🔄 Atualizando lead:', leadId, {
          tags: leadDataToSave.tags,
          totalTags: leadDataToSave.tags?.length || 0
        });
        
        const { error } = await supabase
          .from("leads")
          .update(leadDataToSave)
          .eq("id", leadId);

        if (error) {
          console.error("❌ Erro ao atualizar lead:", error);
          throw error;
        }

        console.log('✅ Lead atualizado com sucesso');
        toast.success("Informações atualizadas com sucesso!");
      } else {
        // Criar novo lead
        console.log('➕ Criando novo lead com tags:', leadDataToSave.tags);
        
        const { error } = await supabase
          .from("leads")
          .insert([leadDataToSave]);

        if (error) {
          console.error("❌ Erro ao criar lead:", error);
          throw error;
        }

        console.log('✅ Lead criado com sucesso');
        toast.success("Lead criado com sucesso!");
      }

      setOpen(false);
      onLeadUpdated();
    } catch (error) {
      console.error("Erro ao salvar lead:", error);
      toast.error("Erro ao salvar informações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full mb-2">
          <FileText className="h-3 w-3 mr-2" /> Editar Informações
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Informações do Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="funil">Funil</Label>
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
            <Label htmlFor="etapa">Etapa</Label>
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
            <Label htmlFor="servico">Serviço de Interesse</Label>
            <Input
              id="servico"
              value={formData.servico}
              onChange={(e) => setFormData({ ...formData, servico: e.target.value })}
              placeholder="Ex: Consultoria, Produto X"
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
            <Label htmlFor="segmentacao">Segmentação</Label>
            <Input
              id="segmentacao"
              value={formData.segmentacao}
              onChange={(e) => setFormData({ ...formData, segmentacao: e.target.value })}
              placeholder="Ex: Empresarial, Residencial"
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
                      console.log('➕ Adicionando tag:', tagTrimmed);
                      setFormData({ ...formData, tags: [...formData.tags, tagTrimmed] });
                      setNewTag("");
                    } else if (formData.tags.includes(tagTrimmed)) {
                      toast.error("Esta tag já foi adicionada");
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
                    console.log('➕ Adicionando tag:', tagTrimmed);
                    setFormData({ ...formData, tags: [...formData.tags, tagTrimmed] });
                    setNewTag("");
                  } else if (tagTrimmed && formData.tags.includes(tagTrimmed)) {
                    toast.error("Esta tag já foi adicionada");
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
                formData.tags.map((tag, index) => (
                  <Badge key={`${tag}-${index}`} variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => {
                        console.log('🗑️ Removendo tag:', tag);
                        setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))
              )}
            </div>
            {leadId && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 As tags são sincronizadas com o funil de vendas e menu de leads
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Salvando..." : "Salvar Informações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
