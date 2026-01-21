import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Tag, X, Plus, TrendingUp, MapPin, Key, Shield } from "lucide-react";
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
    segmentacao: "",
    // Endereço
    endereco_cep: "",
    endereco_logradouro: "",
    endereco_numero: "",
    endereco_complemento: "",
    endereco_bairro: "",
    endereco_cidade: "",
    endereco_estado: "",
    // Gov.br
    govbr_login: "",
    govbr_senha: ""
  });
  const [newTag, setNewTag] = useState("");

  // Garantir que o dialog está fechado ao carregar nova conversa
  useEffect(() => {
    setOpen(false);
  }, [leadId, telefone]);

  // Carregar dados quando o dialog abre OU quando leadId muda (para garantir dados atualizados)
  useEffect(() => {
    if (open) {
      console.log('🔄 Dialog aberto - carregando dados do lead...');
      carregarDados();
    }
  }, [open, leadId]);

  useEffect(() => {
    if (formData.funil_id) {
      const filtered = etapas.filter(e => e.funil_id === formData.funil_id);
      setEtapasFiltradas(filtered);
    }
  }, [formData.funil_id, etapas]);

  const carregarDados = async () => {
    try {
      console.log('🔄 Carregando funis e etapas do banco de dados...');
      
      // Buscar company_id do usuário
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }

      // Carregar funis da empresa
      const { data: funisData, error: funisError } = await supabase
        .from("funis")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("criado_em");

      if (funisError) {
        console.error('❌ Erro ao carregar funis:', funisError);
        toast.error("Erro ao carregar funis");
        return;
      }

      console.log('📊 Funis carregados:', funisData?.length || 0, funisData);
      setFunis(funisData || []);

      // Carregar todas as etapas da empresa
      const { data: etapasData, error: etapasError } = await supabase
        .from("etapas")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("posicao");

      if (etapasError) {
        console.error('❌ Erro ao carregar etapas:', etapasError);
        toast.error("Erro ao carregar etapas");
        return;
      }

      console.log('📍 Etapas carregadas:', etapasData?.length || 0, etapasData);
      setEtapas(etapasData || []);

      // Se existe leadId, carregar os dados completos do lead
      if (leadId) {
        console.log('📋 Carregando dados do lead:', leadId);
        const { data: leadData, error: leadError } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .maybeSingle();

        if (leadError) {
          console.error('❌ Erro ao carregar lead:', leadError);
        }

        if (leadData) {
          console.log('✅ Dados do lead carregados:', {
            nome: leadData.name,
            funil: leadData.funil_id,
            etapa: leadData.etapa_id,
            tags: leadData.tags,
            totalTags: leadData.tags?.length || 0,
            endereco_cep: (leadData as any).endereco_cep,
            endereco_logradouro: (leadData as any).endereco_logradouro,
            endereco_cidade: (leadData as any).endereco_cidade,
            govbr_login: (leadData as any).govbr_login
          });
          
          // Usar os dados diretamente do banco
          const newFormData = {
            nome: leadData.name || nomeContato,
            telefone: leadData.telefone || leadData.phone || telefone,
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
            segmentacao: leadData.segmentacao || "",
            // Endereço - forçar leitura dos campos
            endereco_cep: (leadData as any).endereco_cep || "",
            endereco_logradouro: (leadData as any).endereco_logradouro || "",
            endereco_numero: (leadData as any).endereco_numero || "",
            endereco_complemento: (leadData as any).endereco_complemento || "",
            endereco_bairro: (leadData as any).endereco_bairro || "",
            endereco_cidade: (leadData as any).endereco_cidade || "",
            endereco_estado: (leadData as any).endereco_estado || "",
            // Gov.br - forçar leitura dos campos
            govbr_login: (leadData as any).govbr_login || "",
            govbr_senha: (leadData as any).govbr_senha || ""
          };
          
          console.log('📝 Dados do formulário setados:', {
            endereco_cep: newFormData.endereco_cep,
            endereco_cidade: newFormData.endereco_cidade,
            govbr_login: newFormData.govbr_login
          });
          
          setFormData(newFormData);
        }
      } else {
        console.log('ℹ️ Nenhum lead vinculado, iniciando com dados básicos');
        // Resetar para dados básicos da conversa
        setFormData(prev => ({
          ...prev,
          nome: nomeContato,
          telefone: telefone,
          funil_id: funisData && funisData.length > 0 ? funisData[0].id : "",
          etapa_id: "",
          tags: []
        }));
      }

      // Se não há funis, avisar o usuário
      if (!funisData || funisData.length === 0) {
        toast.error("Nenhum funil encontrado. Crie um funil no menu Kanban primeiro.");
      }
    } catch (error) {
      console.error("❌ Erro ao carregar dados:", error);
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
        // Endereço
        endereco_cep: formData.endereco_cep || null,
        endereco_logradouro: formData.endereco_logradouro || null,
        endereco_numero: formData.endereco_numero || null,
        endereco_complemento: formData.endereco_complemento || null,
        endereco_bairro: formData.endereco_bairro || null,
        endereco_cidade: formData.endereco_cidade || null,
        endereco_estado: formData.endereco_estado || null,
        // Gov.br
        govbr_login: formData.govbr_login || null,
        govbr_senha: formData.govbr_senha || null,
        company_id: userRole.company_id,
        owner_id: session.user.id,
        status: "novo",
        stage: "prospeccao"
      };

      if (leadId) {
        // Atualizar lead existente
        // ⚠️ IMPORTANTE: Não sobrescrever company_id, owner_id, status e stage de leads existentes
        const { company_id, owner_id, status, stage, ...updateData } = leadDataToSave;
        
        console.log('🔄 Atualizando lead:', leadId, {
          tags: updateData.tags,
          totalTags: updateData.tags?.length || 0
        });
        
        const { error } = await supabase
          .from("leads")
          .update(updateData)
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
          <p className="text-sm text-muted-foreground mt-1">
            {leadId ? 'Edite as informações e mova o lead entre etapas' : 'Adicione o lead ao funil de vendas'}
          </p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Funil de Vendas
            </h3>
            
            <div>
              <Label htmlFor="funil">Selecione o Funil *</Label>
              <Select 
                value={formData.funil_id} 
                onValueChange={(value) => {
                  console.log('📊 Funil selecionado:', value);
                  const funilSelecionado = funis.find(f => f.id === value);
                  console.log('📊 Funil encontrado:', funilSelecionado?.nome);
                  setFormData({ ...formData, funil_id: value, etapa_id: "" });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    funis.length === 0 
                      ? "Nenhum funil disponível" 
                      : "Escolha um funil de vendas"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {funis.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      <p>Nenhum funil criado</p>
                      <p className="text-xs mt-1">Crie um funil no menu Kanban</p>
                    </div>
                  ) : (
                    funis.map((funil) => (
                      <SelectItem key={funil.id} value={funil.id}>
                        📊 {funil.nome}
                        {funil.descricao && (
                          <span className="text-xs text-muted-foreground ml-2">
                            - {funil.descricao}
                          </span>
                        )}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {funis.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  ⚠️ Crie um funil no menu Kanban para continuar
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="etapa">
                Selecione a Etapa {leadId ? '(mover lead)' : '(adicionar lead)'} *
              </Label>
              <Select 
                value={formData.etapa_id} 
                onValueChange={(value) => {
                  console.log('📍 Etapa selecionada:', value);
                  setFormData({ ...formData, etapa_id: value });
                }}
                disabled={!formData.funil_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    !formData.funil_id 
                      ? "Selecione um funil primeiro" 
                      : "Escolha a etapa do funil"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {etapasFiltradas.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      Nenhuma etapa disponível neste funil
                    </div>
                  ) : (
                    etapasFiltradas.map((etapa) => (
                      <SelectItem key={etapa.id} value={etapa.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: etapa.cor || '#3b82f6' }}
                          />
                          {etapa.nome}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!formData.funil_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Selecione um funil para ver as etapas disponíveis
                </p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
              placeholder="000.000.000-00"
            />
          </div>

          <div>
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
              placeholder="Nome da empresa"
            />
          </div>

          <div>
            <Label htmlFor="servico">Serviço de Interesse</Label>
            <Input
              id="servico"
              value={formData.servico}
              onChange={(e) => setFormData(prev => ({ ...prev, servico: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div>
            <Label htmlFor="segmentacao">Segmentação</Label>
            <Input
              id="segmentacao"
              value={formData.segmentacao}
              onChange={(e) => setFormData(prev => ({ ...prev, segmentacao: e.target.value }))}
              placeholder="Ex: Empresarial, Residencial"
            />
          </div>

          <div>
            <Label htmlFor="source">Origem</Label>
            <Input
              id="source"
              value={formData.source}
              onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
              placeholder="Ex: WhatsApp, Instagram, Indicação"
            />
          </div>

          {/* Seção de Endereço */}
          <div className="bg-muted/30 border border-border/50 rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço
            </h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="endereco_cep" className="text-xs">CEP</Label>
                <Input
                  id="endereco_cep"
                  value={formData.endereco_cep}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_cep: e.target.value }))}
                  placeholder="00000-000"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="endereco_estado" className="text-xs">Estado (UF)</Label>
                <Input
                  id="endereco_estado"
                  value={formData.endereco_estado}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_estado: e.target.value }))}
                  placeholder="PE"
                  maxLength={2}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="endereco_logradouro" className="text-xs">Logradouro (Rua/Av.)</Label>
              <Input
                id="endereco_logradouro"
                value={formData.endereco_logradouro}
                onChange={(e) => setFormData(prev => ({ ...prev, endereco_logradouro: e.target.value }))}
                placeholder="Rua Exemplo"
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="endereco_numero" className="text-xs">Número</Label>
                <Input
                  id="endereco_numero"
                  value={formData.endereco_numero}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_numero: e.target.value }))}
                  placeholder="123"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="endereco_complemento" className="text-xs">Complemento</Label>
                <Input
                  id="endereco_complemento"
                  value={formData.endereco_complemento}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_complemento: e.target.value }))}
                  placeholder="Apto 101"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="endereco_bairro" className="text-xs">Bairro</Label>
                <Input
                  id="endereco_bairro"
                  value={formData.endereco_bairro}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_bairro: e.target.value }))}
                  placeholder="Centro"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label htmlFor="endereco_cidade" className="text-xs">Cidade</Label>
                <Input
                  id="endereco_cidade"
                  value={formData.endereco_cidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, endereco_cidade: e.target.value }))}
                  placeholder="Recife"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Seção Gov.br */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Acesso Gov.br
            </h3>
            
            <div>
              <Label htmlFor="govbr_login" className="text-xs">Login (CPF ou Email)</Label>
              <Input
                id="govbr_login"
                value={formData.govbr_login}
                onChange={(e) => setFormData(prev => ({ ...prev, govbr_login: e.target.value }))}
                placeholder="000.000.000-00 ou email@exemplo.com"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="govbr_senha" className="text-xs">Senha</Label>
              <Input
                id="govbr_senha"
                type="text"
                value={formData.govbr_senha}
                onChange={(e) => setFormData(prev => ({ ...prev, govbr_senha: e.target.value }))}
                placeholder="Senha de acesso"
                className="h-8 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
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
                      setFormData(prev => ({ ...prev, tags: [...prev.tags, tagTrimmed] }));
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
                    setFormData(prev => ({ ...prev, tags: [...prev.tags, tagTrimmed] }));
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
                        setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
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
