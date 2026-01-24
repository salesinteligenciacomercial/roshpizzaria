import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShoppingCart,
  Plus,
  ChevronDown,
  ChevronUp,
  Package,
  Trophy,
  XCircle,
  Clock,
  Loader2,
  DollarSign,
  Repeat,
  ArrowUpRight,
  Shuffle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdicionarVendaDialog } from "@/components/leads/AdicionarVendaDialog";

interface Venda {
  id: string;
  produto_id: string | null;
  produto_nome: string;
  valor_unitario: number;
  quantidade: number;
  desconto: number;
  valor_final: number;
  tipo: string | null;
  recorrencia: string | null;
  status?: string;
  created_at: string;
  categoria?: string | null;
  subcategoria?: string | null;
}

interface VendasLeadPanelProps {
  leadId: string;
  leadName: string;
  companyId: string;
  onVendaUpdated?: () => void;
}

const TIPO_ICONS: Record<string, any> = {
  avulsa: ShoppingCart,
  recorrente: Repeat,
  upsell: ArrowUpRight,
  cross_sell: Shuffle,
};

const TIPO_LABELS: Record<string, string> = {
  avulsa: "Avulsa",
  recorrente: "Recorrente",
  upsell: "Upsell",
  cross_sell: "Cross-sell",
};

export function VendasLeadPanel({
  leadId,
  leadName,
  companyId,
  onVendaUpdated,
}: VendasLeadPanelProps) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [novaVendaOpen, setNovaVendaOpen] = useState(false);
  const [deleteVendaId, setDeleteVendaId] = useState<string | null>(null);
  const [deletingVenda, setDeletingVenda] = useState(false);

  const carregarVendas = async () => {
    if (!leadId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_sales")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVendas(data || []);
    } catch (error) {
      console.error("Erro ao carregar vendas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarVendas();
  }, [leadId]);

  const handleDeleteVenda = async () => {
    if (!deleteVendaId) return;
    
    setDeletingVenda(true);
    try {
      const { error } = await supabase
        .from("customer_sales")
        .delete()
        .eq("id", deleteVendaId);

      if (error) throw error;
      
      toast.success("Venda removida");
      setVendas(vendas.filter(v => v.id !== deleteVendaId));
      onVendaUpdated?.();
    } catch (error) {
      console.error("Erro ao remover venda:", error);
      toast.error("Erro ao remover venda");
    } finally {
      setDeletingVenda(false);
      setDeleteVendaId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  const totalVendas = vendas.reduce((sum, v) => sum + (v.valor_final || 0), 0);
  const totalRecorrente = vendas
    .filter(v => v.tipo === "recorrente")
    .reduce((sum, v) => sum + (v.valor_final || 0), 0);

  return (
    <div className="border rounded-lg bg-card">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Vendas/Negociações</span>
              {vendas.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {vendas.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalVendas > 0 && (
                <span className="text-xs font-medium text-primary">
                  {formatCurrency(totalVendas)}
                </span>
              )}
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-3">
            {/* Botão adicionar nova venda */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed border-primary text-primary hover:bg-primary/10"
              onClick={() => setNovaVendaOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar nova venda
            </Button>

            {/* Lista de vendas */}
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : vendas.length === 0 ? (
              <div className="text-center py-4">
                <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma venda registrada
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[250px]">
                <div className="space-y-2">
                  {vendas.map((venda) => {
                    const TipoIcon = TIPO_ICONS[venda.tipo || "avulsa"] || ShoppingCart;
                    
                    return (
                      <div
                        key={venda.id}
                        className="p-2 border rounded-lg bg-muted/30 space-y-1 group relative"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Package className="h-3 w-3 text-primary flex-shrink-0" />
                              <span className="text-xs font-medium truncate">
                                {venda.produto_nome}
                              </span>
                            </div>
                            {(venda.categoria || venda.subcategoria) && (
                              <p className="text-[10px] text-muted-foreground truncate pl-4">
                                {[venda.categoria, venda.subcategoria].filter(Boolean).join(" → ")}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-primary">
                              {formatCurrency(venda.valor_final)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={() => setDeleteVendaId(venda.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <TipoIcon className="h-3 w-3" />
                            <span>{TIPO_LABELS[venda.tipo || "avulsa"]}</span>
                          </div>
                          
                          {venda.recorrencia && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {venda.recorrencia}
                            </Badge>
                          )}
                          
                          <span className="ml-auto">
                            {formatDate(venda.created_at)}
                          </span>
                        </div>

                        {venda.quantidade > 1 && (
                          <p className="text-[10px] text-muted-foreground">
                            {venda.quantidade}x {formatCurrency(venda.valor_unitario)}
                            {venda.desconto > 0 && ` (-${formatCurrency(venda.desconto)})`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Resumo */}
            {vendas.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Total vendas:</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(totalVendas)}
                  </span>
                </div>
                {totalRecorrente > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Repeat className="h-3 w-3" />
                      Recorrente:
                    </span>
                    <span className="font-medium text-primary">
                      {formatCurrency(totalRecorrente)}/período
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Dialog de nova venda */}
      <AdicionarVendaDialog
        lead={{ id: leadId, name: leadName }}
        companyId={companyId}
        open={novaVendaOpen}
        onOpenChange={setNovaVendaOpen}
        onVendaRegistrada={() => {
          carregarVendas();
          onVendaUpdated?.();
        }}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteVendaId} onOpenChange={(open) => !open && setDeleteVendaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A venda será removida do histórico do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingVenda}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVenda}
              disabled={deletingVenda}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingVenda ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
