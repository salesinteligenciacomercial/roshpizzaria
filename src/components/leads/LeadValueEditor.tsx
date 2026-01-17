import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, DollarSign, Percent, TrendingUp, TrendingDown, History, Package, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadValueHistory } from "./LeadValueHistory";

interface Product {
  id: string;
  nome: string;
  preco_sugerido: number | null;
}

interface LeadValueEditorProps {
  lead: {
    id: string;
    name: string;
    value?: number;
    status?: string;
    probability?: number;
    expected_close_date?: string;
    loss_reason?: string;
    produto_id?: string;
    company_id?: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const LOSS_REASONS = [
  { value: 'preco', label: 'Preço muito alto' },
  { value: 'concorrencia', label: 'Escolheu concorrente' },
  { value: 'timing', label: 'Momento inadequado' },
  { value: 'sem_resposta', label: 'Sem resposta/Sumiu' },
  { value: 'nao_qualificado', label: 'Lead não qualificado' },
  { value: 'orcamento', label: 'Sem orçamento' },
  { value: 'funcionalidade', label: 'Falta funcionalidade' },
  { value: 'outro', label: 'Outro (especificar)' }
];

export function LeadValueEditor({ lead, open, onOpenChange, onUpdated }: LeadValueEditorProps) {
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [formData, setFormData] = useState({
    value: lead.value?.toString() || "0",
    probability: lead.probability ?? 0,
    expected_close_date: lead.expected_close_date ? new Date(lead.expected_close_date) : undefined as Date | undefined,
    loss_reason: lead.loss_reason || "",
    custom_loss_reason: "",
    produto_id: lead.produto_id || ""
  });

  // Reset form when lead.id changes (not when other properties update)
  useEffect(() => {
    setFormData({
      value: lead.value?.toString() || "0",
      probability: lead.probability ?? 0,
      expected_close_date: lead.expected_close_date ? new Date(lead.expected_close_date) : undefined,
      loss_reason: lead.loss_reason || "",
      custom_loss_reason: "",
      produto_id: lead.produto_id || ""
    });
  }, [lead.id, open]); // Only reset when lead changes OR dialog opens

  // Fetch products when dialog opens
  useEffect(() => {
    if (open && lead.company_id) {
      fetchProducts();
    }
  }, [open, lead.company_id]);

  const fetchProducts = async () => {
    if (!lead.company_id) return;
    
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("id, nome, preco_sugerido")
        .eq("company_id", lead.company_id)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleProductChange = (productId: string) => {
    if (productId === "__none__") {
      setFormData({ ...formData, produto_id: "" });
      return;
    }
    
    const product = products.find(p => p.id === productId);
    if (product) {
      // Se tiver preço sugerido e valor atual for 0, aplicar o preço sugerido
      const currentValue = parseFloat(formData.value) / 100;
      if (product.preco_sugerido && currentValue === 0) {
        const newValue = (product.preco_sugerido * 100).toString();
        setFormData({ ...formData, produto_id: productId, value: newValue });
      } else {
        setFormData({ ...formData, produto_id: productId });
      }
    }
  };

  const formatCurrency = (value: string) => {
    const numericValue = parseFloat(value.replace(/\D/g, "")) / 100;
    return numericValue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, "");
    setFormData({ ...formData, value: rawValue });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const numericValue = parseFloat(formData.value) / 100;
      const lossReason = formData.loss_reason === 'outro' 
        ? formData.custom_loss_reason 
        : formData.loss_reason;

      const updateData: any = {
        value: numericValue,
        probability: formData.probability,
        expected_close_date: formData.expected_close_date 
          ? format(formData.expected_close_date, "yyyy-MM-dd") 
          : null,
        updated_at: new Date().toISOString(),
        produto_id: formData.produto_id || null
      };

      // Se selecionou um produto, também salvar o nome no campo servico
      if (formData.produto_id) {
        const product = products.find(p => p.id === formData.produto_id);
        if (product) {
          updateData.servico = product.nome;
        }
      }

      // Adicionar motivo de perda se status for perdido
      if (lead.status === 'perdido') {
        updateData.loss_reason = lossReason || null;
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", lead.id);

      if (error) throw error;

      toast.success("Valores atualizados com sucesso!");
      onOpenChange(false);
      onUpdated();
    } catch (error) {
      console.error("Erro ao atualizar lead:", error);
      toast.error("Erro ao atualizar valores");
    } finally {
      setLoading(false);
    }
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return "text-green-500";
    if (probability >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getProbabilityLabel = (probability: number) => {
    if (probability >= 80) return "Muito Alta";
    if (probability >= 60) return "Alta";
    if (probability >= 40) return "Média";
    if (probability >= 20) return "Baixa";
    return "Muito Baixa";
  };

  const displayValue = formData.value 
    ? formatCurrency(formData.value) 
    : "R$ 0,00";

  const weightedValue = (parseFloat(formData.value) / 100) * (formData.probability / 100);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Editar Valor - {lead.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Produto/Serviço */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Produto/Serviço
              </Label>
              {loadingProducts ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando produtos...
                </div>
              ) : products.length > 0 ? (
                <Select
                  value={formData.produto_id || "__none__"}
                  onValueChange={handleProductChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto/serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">Sem produto vinculado</span>
                    </SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between gap-2">
                          <span>{product.nome}</span>
                          {product.preco_sugerido && product.preco_sugerido > 0 && (
                            <Badge variant="secondary" className="text-xs ml-2">
                              {product.preco_sugerido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum produto cadastrado. Cadastre em Analytics → Produtos.
                </p>
              )}
            </div>

            {/* Valor da Negociação */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor da Negociação
              </Label>
              <Input
                value={displayValue}
                onChange={handleValueChange}
                placeholder="R$ 0,00"
                className="text-lg font-semibold"
              />
            </div>

            {/* Probabilidade de Fechamento */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Probabilidade de Fechamento
                </Label>
                <Badge variant="outline" className={getProbabilityColor(formData.probability)}>
                  {formData.probability}% - {getProbabilityLabel(formData.probability)}
                </Badge>
              </div>
              <Slider
                value={[formData.probability]}
                onValueChange={(value) => setFormData({ ...formData, probability: value[0] })}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Valor Ponderado */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor Ponderado</span>
                <span className="text-lg font-bold text-primary">
                  {weightedValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                = Valor × Probabilidade ({formatCurrency(formData.value)} × {formData.probability}%)
              </p>
            </div>

            {/* Data Prevista de Fechamento */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Data Prevista de Fechamento
              </Label>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    type="button"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.expected_close_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expected_close_date 
                      ? format(formData.expected_close_date, "dd/MM/yyyy", { locale: ptBR })
                      : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999]" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.expected_close_date}
                    onSelect={(date) => {
                      setFormData({ ...formData, expected_close_date: date });
                      setDatePopoverOpen(false);
                    }}
                    locale={ptBR}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Motivo da Perda (apenas se status = perdido) */}
            {lead.status === 'perdido' && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-red-500">
                  <TrendingDown className="h-4 w-4" />
                  Motivo da Perda
                </Label>
                <Select
                  value={formData.loss_reason}
                  onValueChange={(value) => setFormData({ ...formData, loss_reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOSS_REASONS.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.loss_reason === 'outro' && (
                  <Textarea
                    value={formData.custom_loss_reason}
                    onChange={(e) => setFormData({ ...formData, custom_loss_reason: e.target.value })}
                    placeholder="Descreva o motivo..."
                    rows={2}
                  />
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowHistory(true)}
              >
                <History className="h-4 w-4 mr-2" />
                Histórico
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Histórico */}
      <LeadValueHistory
        leadId={lead.id}
        leadName={lead.name}
        open={showHistory}
        onOpenChange={setShowHistory}
      />
    </>
  );
}
