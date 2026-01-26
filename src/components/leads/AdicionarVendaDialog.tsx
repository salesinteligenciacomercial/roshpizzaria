import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  Trash2,
  DollarSign,
  Loader2,
  Package,
  Repeat,
  ArrowUpRight,
  Shuffle,
} from "lucide-react";

interface Produto {
  id: string;
  nome: string;
  preco_sugerido: number | null;
  categoria: string | null;
  subcategoria: string | null;
}

interface ItemVenda {
  id: string;
  produto_id?: string;
  produto_nome: string;
  valor_unitario: number;
  quantidade: number;
  desconto: number;
  valor_final: number;
  categoria?: string | null;
  subcategoria?: string | null;
}

interface AdicionarVendaDialogProps {
  lead: {
    id: string;
    name?: string;
    nome?: string;
  };
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendaRegistrada?: () => void;
}

const TIPOS_VENDA = [
  { value: "avulsa", label: "Avulsa", icon: ShoppingCart },
  { value: "recorrente", label: "Recorrente", icon: Repeat },
  { value: "upsell", label: "Upsell", icon: ArrowUpRight },
  { value: "cross_sell", label: "Cross-sell", icon: Shuffle },
];

const RECORRENCIAS = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export function AdicionarVendaDialog({
  lead,
  companyId,
  open,
  onOpenChange,
  onVendaRegistrada,
}: AdicionarVendaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [tipoVenda, setTipoVenda] = useState<string>("avulsa");
  const [recorrencia, setRecorrencia] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [itensVenda, setItensVenda] = useState<ItemVenda[]>([]);

  const leadName = lead.name || lead.nome || "Cliente";

  // Carregar produtos
  const carregarProdutos = useCallback(async () => {
    if (!companyId) return;
    setLoadingProdutos(true);
    try {
      const { data, error } = await supabase
        .from("produtos_servicos")
        .select("id, nome, preco_sugerido, categoria, subcategoria")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("categoria")
        .order("nome");

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
    } finally {
      setLoadingProdutos(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) {
      carregarProdutos();
      // Reset form
      setItensVenda([]);
      setTipoVenda("avulsa");
      setRecorrencia("");
      setNotas("");
    }
  }, [open, carregarProdutos]);

  const adicionarItem = () => {
    setItensVenda([
      ...itensVenda,
      {
        id: crypto.randomUUID(),
        produto_nome: "",
        valor_unitario: 0,
        quantidade: 1,
        desconto: 0,
        valor_final: 0,
      },
    ]);
  };

  const removerItem = (id: string) => {
    setItensVenda(itensVenda.filter((item) => item.id !== id));
  };

  const atualizarItem = (id: string, updates: Partial<ItemVenda>) => {
    setItensVenda(
      itensVenda.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, ...updates };

        // Recalcular valor final
        const subtotal = updated.valor_unitario * updated.quantidade;
        updated.valor_final = subtotal - (updated.desconto || 0);

        return updated;
      })
    );
  };

  const selecionarProduto = (itemId: string, produtoId: string) => {
    const produto = produtos.find((p) => p.id === produtoId);
    if (produto) {
      atualizarItem(itemId, {
        produto_id: produto.id,
        produto_nome: produto.nome,
        valor_unitario: produto.preco_sugerido || 0,
        categoria: produto.categoria,
        subcategoria: produto.subcategoria,
      });
    }
  };

  const totalVenda = itensVenda.reduce(
    (sum, item) => sum + item.valor_final,
    0
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleSubmit = async () => {
    // Validações
    if (itensVenda.length === 0) {
      toast.error("Adicione pelo menos um produto à venda");
      return;
    }

    const itensInvalidos = itensVenda.filter(
      (item) => !item.produto_nome.trim() || item.valor_final <= 0
    );
    if (itensInvalidos.length > 0) {
      toast.error("Preencha todos os campos dos produtos");
      return;
    }

    if (tipoVenda === "recorrente" && !recorrencia) {
      toast.error("Selecione a recorrência da venda");
      return;
    }

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();

      // Inserir cada item como uma venda separada
      const vendasParaInserir = itensVenda.map((item) => ({
        company_id: companyId,
        lead_id: lead.id,
        produto_id: item.produto_id || null,
        produto_nome: item.produto_nome,
        valor_unitario: item.valor_unitario,
        quantidade: item.quantidade,
        desconto: item.desconto || 0,
        valor_final: item.valor_final,
        tipo: tipoVenda,
        recorrencia: tipoVenda === "recorrente" ? recorrencia : null,
        responsavel_id: auth?.user?.id || null,
        notas: notas || null,
        categoria: item.categoria || null,
        subcategoria: item.subcategoria || null,
      }));

      const { error } = await supabase
        .from("customer_sales")
        .insert(vendasParaInserir);

      if (error) throw error;

      // Atualizar status do lead para "ganho" se ainda não estiver
      await supabase
        .from("leads")
        .update({
          status: "ganho",
          value: totalVenda,
          won_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id)
        .neq("status", "ganho"); // Só atualiza se não for ganho

      toast.success(
        `🎉 ${itensVenda.length} produto(s) vendido(s) - ${formatCurrency(totalVenda)}`
      );
      onOpenChange(false);
      onVendaRegistrada?.();
    } catch (error) {
      console.error("Erro ao registrar venda:", error);
      toast.error("Erro ao registrar venda");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Nova Venda
          </DialogTitle>
          <DialogDescription>
            Registrar venda para <strong>{leadName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Tipo de venda */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Venda</Label>
              <Select value={tipoVenda} onValueChange={setTipoVenda}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_VENDA.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <div className="flex items-center gap-2">
                        <tipo.icon className="h-4 w-4" />
                        {tipo.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipoVenda === "recorrente" && (
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={recorrencia} onValueChange={setRecorrencia}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORRENCIAS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Itens da venda */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Produtos/Serviços</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={adicionarItem}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Item
              </Button>
            </div>

            <ScrollArea className="h-[250px] border rounded-lg p-3">
              {itensVenda.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Package className="h-10 w-10 mb-2 opacity-50" />
                  <p className="text-sm">Nenhum item adicionado</p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={adicionarItem}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar primeiro item
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {itensVenda.map((item, index) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-lg bg-muted/30 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">Item {index + 1}</Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => removerItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* Produto */}
                        <div className="col-span-2">
                          {loadingProdutos ? (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Carregando...
                            </div>
                          ) : produtos.length > 0 ? (
                            <Select
                              value={item.produto_id || ""}
                              onValueChange={(v) =>
                                v === "custom"
                                  ? atualizarItem(item.id, {
                                      produto_id: undefined,
                                    })
                                  : selecionarProduto(item.id, v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o produto" />
                              </SelectTrigger>
                              <SelectContent>
                                {produtos.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-medium">{p.nome}</span>
                                        {p.preco_sugerido && p.preco_sugerido > 0 && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs"
                                          >
                                            {formatCurrency(p.preco_sugerido)}
                                          </Badge>
                                        )}
                                      </div>
                                      {(p.categoria || p.subcategoria) && (
                                        <span className="text-[10px] text-muted-foreground">
                                          {[p.categoria, p.subcategoria].filter(Boolean).join(" → ")}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                                <SelectItem value="custom">
                                  <span className="text-muted-foreground">
                                    Digitar outro...
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              placeholder="Nome do produto/serviço"
                              value={item.produto_nome}
                              onChange={(e) =>
                                atualizarItem(item.id, {
                                  produto_nome: e.target.value,
                                })
                              }
                            />
                          )}

                          {item.produto_id === undefined &&
                            produtos.length > 0 && (
                              <Input
                                className="mt-2"
                                placeholder="Nome do produto/serviço"
                                value={item.produto_nome}
                                onChange={(e) =>
                                  atualizarItem(item.id, {
                                    produto_nome: e.target.value,
                                  })
                                }
                              />
                            )}
                        </div>

                        {/* Valor */}
                        <div>
                          <Label className="text-xs">Valor Unit.</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              className="pl-7 h-8"
                              value={item.valor_unitario || ""}
                              onChange={(e) =>
                                atualizarItem(item.id, {
                                  valor_unitario:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                            />
                          </div>
                        </div>

                        {/* Quantidade */}
                        <div>
                          <Label className="text-xs">Qtd.</Label>
                          <Input
                            type="number"
                            min="1"
                            className="h-8"
                            value={item.quantidade}
                            onChange={(e) =>
                              atualizarItem(item.id, {
                                quantidade: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </div>

                        {/* Desconto */}
                        <div>
                          <Label className="text-xs">Desconto</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8"
                            value={item.desconto || ""}
                            onChange={(e) =>
                              atualizarItem(item.id, {
                                desconto: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>

                        {/* Subtotal */}
                        <div>
                          <Label className="text-xs">Subtotal</Label>
                          <div className="h-8 flex items-center font-medium text-primary">
                            {formatCurrency(item.valor_final)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea
              placeholder="Notas sobre esta venda..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
            />
          </div>

          {/* Total */}
          {itensVenda.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
              <span className="font-medium">Total da Venda:</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(totalVenda)}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || itensVenda.length === 0}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4 mr-2" />
            )}
            Registrar Venda
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
