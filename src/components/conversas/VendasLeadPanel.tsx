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
  Trash2,
  CheckCircle,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  status: string | null;
  motivo_perda: string | null;
  finalized_at: string | null;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  em_negociacao: { label: "Em Negociação", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  ganho: { label: "Ganho", color: "bg-green-100 text-green-700 border-green-200", icon: Trophy },
  perdido: { label: "Perdido", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

const MOTIVOS_PERDA = [
  { value: "preco", label: "Preço muito alto" },
  { value: "concorrencia", label: "Escolheu concorrente" },
  { value: "timing", label: "Não é o momento" },
  { value: "orcamento", label: "Sem orçamento" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "nao_qualificado", label: "Não qualificado" },
  { value: "outro", label: "Outro motivo" },
];

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
  
  // Estado para finalizar venda
  const [finalizarVenda, setFinalizarVenda] = useState<{ venda: Venda; action: 'ganho' | 'perdido' } | null>(null);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [notasFinalizacao, setNotasFinalizacao] = useState("");
  const [finalizando, setFinalizando] = useState(false);

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

  // Função para calcular e atualizar o valor total do lead baseado nas vendas ganhas
  const atualizarValorLead = async () => {
    try {
      const { data: todasVendas, error } = await supabase
        .from("customer_sales")
        .select("valor_final, status")
        .eq("lead_id", leadId);

      if (error) throw error;

      const totalGanhoAtualizado = (todasVendas || [])
        .filter(v => v.status === "ganho")
        .reduce((sum, v) => sum + (v.valor_final || 0), 0);

      await supabase
        .from('leads')
        .update({ 
          value: totalGanhoAtualizado,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
    } catch (error) {
      console.error("Erro ao atualizar valor do lead:", error);
    }
  };

  const handleFinalizarVenda = async () => {
    if (!finalizarVenda) return;
    
    setFinalizando(true);
    try {
      const { venda, action } = finalizarVenda;
      
      const updateData: Record<string, any> = {
        status: action,
        finalized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      if (action === 'perdido') {
        updateData.motivo_perda = motivoPerda;
      }
      
      if (notasFinalizacao.trim()) {
        updateData.notas = notasFinalizacao.trim();
      }

      const { error } = await supabase
        .from("customer_sales")
        .update(updateData)
        .eq("id", venda.id);

      if (error) throw error;
      
      toast.success(action === 'ganho' ? "Venda registrada como ganha!" : "Negociação marcada como perdida");
      
      // Atualizar status do lead e valor total se for ganho
      if (action === 'ganho') {
        await supabase
          .from('leads')
          .update({ 
            status: 'ganho',
            won_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', leadId);
      }
      
      // Atualizar valor total do lead com base em todas as vendas ganhas
      await atualizarValorLead();
      
      await carregarVendas();
      onVendaUpdated?.();
      setFinalizarVenda(null);
      setMotivoPerda("");
      setNotasFinalizacao("");
    } catch (error) {
      console.error("Erro ao finalizar venda:", error);
      toast.error("Erro ao finalizar venda");
    } finally {
      setFinalizando(false);
    }
  };

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

  const handleMarcarTodasGanho = async () => {
    const vendasEmNegociacaoLocal = vendas.filter(v => v.status === 'em_negociacao' || !v.status);
    if (vendasEmNegociacaoLocal.length === 0) {
      toast.info("Não há negociações em andamento");
      return;
    }
    
    setFinalizando(true);
    try {
      const ids = vendasEmNegociacaoLocal.map(v => v.id);
      
      const { error } = await supabase
        .from("customer_sales")
        .update({
          status: 'ganho',
          finalized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) throw error;
      
      // Atualizar lead para ganho
      await supabase
        .from('leads')
        .update({ 
          status: 'ganho',
          won_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);
      
      // Atualizar valor total do lead
      await atualizarValorLead();
      
      toast.success(`${vendasEmNegociacaoLocal.length} venda(s) marcada(s) como ganha(s)!`);
      await carregarVendas();
      onVendaUpdated?.();
    } catch (error) {
      console.error("Erro ao marcar vendas:", error);
      toast.error("Erro ao marcar vendas como ganhas");
    } finally {
      setFinalizando(false);
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
  const totalGanho = vendas
    .filter(v => v.status === "ganho")
    .reduce((sum, v) => sum + (v.valor_final || 0), 0);
  const totalRecorrente = vendas
    .filter(v => v.tipo === "recorrente" && v.status === "ganho")
    .reduce((sum, v) => sum + (v.valor_final || 0), 0);
  const vendasEmNegociacao = vendas.filter(v => v.status === 'em_negociacao' || !v.status);

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
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {vendas.map((venda) => {
                    const TipoIcon = TIPO_ICONS[venda.tipo || "avulsa"] || ShoppingCart;
                    const status = venda.status || "em_negociacao";
                    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.em_negociacao;
                    const StatusIcon = statusConfig.icon;
                    const isEmNegociacao = status === 'em_negociacao';
                    
                    return (
                      <div
                        key={venda.id}
                        className={`p-2 border rounded-lg space-y-1 group relative ${
                          status === 'ganho' ? 'bg-green-50/50 border-green-200' :
                          status === 'perdido' ? 'bg-red-50/30 border-red-200 opacity-70' :
                          'bg-muted/30'
                        }`}
                      >
                        {/* Cabeçalho com status */}
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
                            {isEmNegociacao && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                onClick={() => setDeleteVendaId(venda.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Tipo e Data */}
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

                        {/* Status Badge */}
                        <div className="flex items-center justify-between pt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 ${statusConfig.color}`}
                          >
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusConfig.label}
                          </Badge>
                          
                          {/* Ações rápidas para vendas em negociação */}
                          {isEmNegociacao && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-green-600 hover:bg-green-100 hover:text-green-700"
                                onClick={() => setFinalizarVenda({ venda, action: 'ganho' })}
                                title="Marcar como Ganho"
                              >
                                <Trophy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600 hover:bg-red-100 hover:text-red-700"
                                onClick={() => setFinalizarVenda({ venda, action: 'perdido' })}
                                title="Marcar como Perdido"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Motivo de perda */}
                        {status === 'perdido' && venda.motivo_perda && (
                          <p className="text-[10px] text-red-600 italic pl-4">
                            Motivo: {MOTIVOS_PERDA.find(m => m.value === venda.motivo_perda)?.label || venda.motivo_perda}
                          </p>
                        )}

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
                {totalGanho > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-green-600" />
                      Ganho:
                    </span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(totalGanho)}
                    </span>
                  </div>
                )}
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

            {/* Botões de ação rápida para todas as negociações */}
            {vendasEmNegociacao.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-[10px] text-muted-foreground mb-2">
                  {vendasEmNegociacao.length} negociação(ões) em andamento
                </p>
                <Button
                  variant="default"
                  size="sm"
                  className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  onClick={handleMarcarTodasGanho}
                  disabled={finalizando}
                >
                  {finalizando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Marcar todas como Ganho
                </Button>
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

      {/* Dialog de finalizar venda (ganho/perdido) */}
      <Dialog open={!!finalizarVenda} onOpenChange={(open) => !open && setFinalizarVenda(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {finalizarVenda?.action === 'ganho' ? (
                <>
                  <Trophy className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">Confirmar Venda</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">Marcar como Perdido</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {finalizarVenda?.action === 'ganho' 
                ? `Confirmar venda de "${finalizarVenda?.venda.produto_nome}" por ${formatCurrency(finalizarVenda?.venda.valor_final || 0)}?`
                : `Marcar negociação de "${finalizarVenda?.venda.produto_nome}" como perdida?`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            {finalizarVenda?.action === 'perdido' && (
              <div>
                <Label htmlFor="motivoPerda">Motivo da perda</Label>
                <Select value={motivoPerda} onValueChange={setMotivoPerda}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_PERDA.map((motivo) => (
                      <SelectItem key={motivo.value} value={motivo.value}>
                        {motivo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <Label htmlFor="notasFinalizacao">Observações (opcional)</Label>
              <Textarea
                id="notasFinalizacao"
                placeholder="Adicione notas sobre esta venda..."
                value={notasFinalizacao}
                onChange={(e) => setNotasFinalizacao(e.target.value)}
                className="h-20"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setFinalizarVenda(null)}
                disabled={finalizando}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleFinalizarVenda}
                disabled={finalizando || (finalizarVenda?.action === 'perdido' && !motivoPerda)}
                className={finalizarVenda?.action === 'ganho' 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
                }
              >
                {finalizando ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : finalizarVenda?.action === 'ganho' ? (
                  <Trophy className="h-4 w-4 mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
