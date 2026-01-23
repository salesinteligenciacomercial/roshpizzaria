import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DuplicarLeadDialogProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    company?: string;
    value?: number;
    source?: string;
    tags?: string[];
    funil_id?: string;
    etapa_id?: string;
    notes?: string | null;
    responsavel_id?: string | null;
    probability?: number;
    expected_close_date?: string | null;
    produto_id?: string | null;
  };
  onLeadDuplicated: () => void;
  trigger?: React.ReactNode;
}

interface Funil {
  id: string;
  nome: string;
}

interface Etapa {
  id: string;
  nome: string;
  funil_id: string;
  cor: string;
}

export function DuplicarLeadDialog({ 
  lead, 
  onLeadDuplicated,
  trigger
}: DuplicarLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string>("");
  const [selectedEtapa, setSelectedEtapa] = useState<string>("");
  const [novoNome, setNovoNome] = useState("");
  const [novoValor, setNovoValor] = useState<string>("");
  const [manterResponsavel, setManterResponsavel] = useState(true);
  const [manterTags, setManterTags] = useState(true);
  const [manterNotas, setManterNotas] = useState(false);

  useEffect(() => {
    if (open) {
      carregarFunis();
      // Inicializar valores
      setNovoNome(`${lead.nome} (Cópia)`);
      setNovoValor(lead.value?.toString() || "");
      setSelectedFunil(lead.funil_id || "");
    }
  }, [open, lead]);

  useEffect(() => {
    if (selectedFunil) {
      carregarEtapas(selectedFunil);
    } else {
      setEtapas([]);
      setSelectedEtapa("");
    }
  }, [selectedFunil]);

  const carregarFunis = async () => {
    try {
      const { data, error } = await supabase
        .from("funis")
        .select("id, nome")
        .order("criado_em");

      if (error) throw error;
      setFunis(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar funis:", error);
      toast.error("Erro ao carregar funis");
    }
  };

  const carregarEtapas = async (funilId: string) => {
    try {
      const { data, error } = await supabase
        .from("etapas")
        .select("id, nome, funil_id, cor")
        .eq("funil_id", funilId)
        .order("posicao");

      if (error) throw error;
      setEtapas(data || []);

      // Seleciona a primeira etapa por padrão ou a etapa atual se for o mesmo funil
      if (funilId === lead.funil_id && lead.etapa_id) {
        setSelectedEtapa(lead.etapa_id);
      } else if (data && data.length > 0) {
        setSelectedEtapa(data[0].id);
      }
    } catch (error: any) {
      console.error("Erro ao carregar etapas:", error);
      toast.error("Erro ao carregar etapas");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!novoNome.trim()) {
      toast.error("Digite um nome para o lead");
      return;
    }

    if (!selectedFunil) {
      toast.error("Selecione um funil");
      return;
    }

    if (!selectedEtapa) {
      toast.error("Selecione uma etapa");
      return;
    }

    setLoading(true);

    try {
      // Buscar dados completos do lead original para copiar
      const { data: leadOriginal, error: leadError } = await supabase
        .from("leads")
        .select("*")
        .eq("id", lead.id)
        .single();

      if (leadError) throw leadError;

      // Buscar sessão do usuário
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Preparar dados do novo lead
      const valorNumerico = novoValor ? parseFloat(novoValor.replace(/[^\d.,]/g, '').replace(',', '.')) : null;

      const novoLead = {
        name: novoNome.trim(),
        telefone: leadOriginal.telefone,
        phone: leadOriginal.phone,
        email: leadOriginal.email,
        company: leadOriginal.company,
        cpf: leadOriginal.cpf,
        source: leadOriginal.source,
        value: valorNumerico,
        funil_id: selectedFunil,
        etapa_id: selectedEtapa,
        company_id: leadOriginal.company_id,
        owner_id: session.user.id,
        responsavel_id: manterResponsavel ? leadOriginal.responsavel_id : null,
        responsaveis: manterResponsavel ? leadOriginal.responsaveis : null,
        tags: manterTags ? leadOriginal.tags : null,
        notes: manterNotas ? leadOriginal.notes : null,
        probability: lead.probability,
        expected_close_date: lead.expected_close_date,
        produto_id: lead.produto_id,
        status: 'ativo',
        // Campos de endereço (usando any para evitar erros de tipo)
        endereco: (leadOriginal as any).endereco,
        bairro: (leadOriginal as any).bairro,
        cidade: (leadOriginal as any).cidade,
        estado: (leadOriginal as any).estado,
        cep: (leadOriginal as any).cep,
        // Campos extras
        govbr_login: (leadOriginal as any).govbr_login,
        govbr_senha: (leadOriginal as any).govbr_senha,
        data_nascimento: leadOriginal.data_nascimento,
      };

      const { data: leadCriado, error } = await supabase
        .from("leads")
        .insert(novoLead)
        .select()
        .single();

      if (error) throw error;

      const funilNome = funis.find(f => f.id === selectedFunil)?.nome;
      const etapaNome = etapas.find(e => e.id === selectedEtapa)?.nome;

      toast.success(`Lead duplicado com sucesso!`, {
        description: `"${novoNome}" criado em ${funilNome} - ${etapaNome}`
      });
      
      setOpen(false);
      onLeadDuplicated();
    } catch (error: any) {
      console.error("Erro ao duplicar lead:", error);
      toast.error(error.message || "Erro ao duplicar lead");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-start"
          >
            <Copy className="h-3 w-3 mr-2" />
            Duplicar Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar Lead
          </DialogTitle>
          <DialogDescription>
            Criar uma cópia de <strong>{lead.nome}</strong> em outro funil ou etapa
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome do novo lead *</Label>
            <Input
              id="nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Nome do lead"
              disabled={loading}
            />
          </div>

          <div>
            <Label htmlFor="valor">Valor da negociação</Label>
            <Input
              id="valor"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              placeholder="R$ 0,00"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Útil para registrar diferentes produtos/serviços
            </p>
          </div>

          <div>
            <Label htmlFor="funil">Selecionar Funil *</Label>
            <Select
              value={selectedFunil}
              onValueChange={setSelectedFunil}
              disabled={loading}
            >
              <SelectTrigger id="funil">
                <SelectValue placeholder="Escolha um funil" />
              </SelectTrigger>
              <SelectContent>
                {funis.map((funil) => (
                  <SelectItem key={funil.id} value={funil.id}>
                    {funil.nome}
                    {funil.id === lead.funil_id && " (Atual)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="etapa">Selecionar Etapa *</Label>
            <Select
              value={selectedEtapa}
              onValueChange={setSelectedEtapa}
              disabled={loading || !selectedFunil}
            >
              <SelectTrigger id="etapa">
                <SelectValue placeholder="Escolha uma etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapas.map((etapa) => (
                  <SelectItem key={etapa.id} value={etapa.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: etapa.cor }}
                      />
                      {etapa.nome}
                      {etapa.id === lead.etapa_id && " (Atual)"}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-medium">Opções de cópia</Label>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="manterResponsavel"
                checked={manterResponsavel}
                onCheckedChange={(checked) => setManterResponsavel(checked as boolean)}
              />
              <Label htmlFor="manterResponsavel" className="text-sm font-normal cursor-pointer">
                Manter responsáveis
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="manterTags"
                checked={manterTags}
                onCheckedChange={(checked) => setManterTags(checked as boolean)}
              />
              <Label htmlFor="manterTags" className="text-sm font-normal cursor-pointer">
                Manter tags
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="manterNotas"
                checked={manterNotas}
                onCheckedChange={(checked) => setManterNotas(checked as boolean)}
              />
              <Label htmlFor="manterNotas" className="text-sm font-normal cursor-pointer">
                Manter notas/observações
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Duplicando...
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar Lead
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
