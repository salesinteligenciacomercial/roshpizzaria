import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Pencil,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import { PropostaBancariaDialog } from "./PropostaBancariaDialog";

interface Proposta {
  id: string;
  banco: string;
  tipo: string;
  valor_liberado: number;
  status: string;
  motivo_cancelamento?: string | null;
  notas?: string | null;
  created_at: string;
  updated_at: string;
}

interface PropostasBancariasPanelProps {
  leadId: string;
  companyId: string;
  onPropostaUpdated?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  em_andamento: { label: "Em andamento", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  aguardando_cip: { label: "Aguardando CIP", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: FileText },
  aguardando_averbacao: { label: "Aguardando Averbação", color: "bg-orange-100 text-orange-700 border-orange-200", icon: RefreshCw },
  aguardando_pagamento: { label: "Aguardando Pagamento", color: "bg-purple-100 text-purple-700 border-purple-200", icon: DollarSign },
  pendente: { label: "Pendente", color: "bg-gray-100 text-gray-700 border-gray-200", icon: AlertCircle },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  pago: { label: "Pago", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
};

const TIPO_LABELS: Record<string, string> = {
  novo: "Novo",
  refinanciamento: "Refinanciamento",
  portabilidade_pura: "Portabilidade Pura",
  portabilidade_refin: "Port. + Refin",
};

const STATUS_OPTIONS = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_cip", label: "Aguardando CIP" },
  { value: "aguardando_averbacao", label: "Aguardando Averbação" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "pago", label: "Pago" },
];

export function PropostasBancariasPanel({
  leadId,
  companyId,
  onPropostaUpdated,
}: PropostasBancariasPanelProps) {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [novaPropostaOpen, setNovaPropostaOpen] = useState(false);
  const [editProposta, setEditProposta] = useState<Proposta | null>(null);
  const [deletePropostaId, setDeletePropostaId] = useState<string | null>(null);
  const [deletingProposta, setDeletingProposta] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const carregarPropostas = async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("propostas_bancarias")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPropostas(data || []);
    } catch (error) {
      console.error("Erro ao carregar propostas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarPropostas();
  }, [leadId]);

  const handleDeleteProposta = async () => {
    if (!deletePropostaId) return;
    setDeletingProposta(true);
    try {
      const { error } = await supabase
        .from("propostas_bancarias")
        .delete()
        .eq("id", deletePropostaId);

      if (error) throw error;
      toast.success("Proposta removida");
      setPropostas(propostas.filter((p) => p.id !== deletePropostaId));
      onPropostaUpdated?.();
    } catch (error) {
      console.error("Erro ao remover proposta:", error);
      toast.error("Erro ao remover proposta");
    } finally {
      setDeletingProposta(false);
      setDeletePropostaId(null);
    }
  };

  const handleStatusChange = async (propostaId: string, novoStatus: string) => {
    setUpdatingStatus(propostaId);
    try {
      const { error } = await supabase
        .from("propostas_bancarias")
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq("id", propostaId);

      if (error) throw error;
      toast.success("Status atualizado");
      setPropostas((prev) =>
        prev.map((p) =>
          p.id === propostaId ? { ...p, status: novoStatus } : p
        )
      );
      onPropostaUpdated?.();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setUpdatingStatus(null);
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

  const totalLiberado = propostas
    .filter((p) => p.status === "pago")
    .reduce((sum, p) => sum + (p.valor_liberado || 0), 0);

  const totalEmAndamento = propostas
    .filter((p) => !["pago", "cancelado"].includes(p.status))
    .reduce((sum, p) => sum + (p.valor_liberado || 0), 0);

  return (
    <div className="border rounded-lg bg-card">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-3 py-2 h-auto hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-sm">Propostas Bancárias</span>
              {propostas.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {propostas.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {totalLiberado > 0 && (
                <span className="text-xs font-medium text-emerald-600">
                  {formatCurrency(totalLiberado)}
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
            {/* Botão adicionar nova proposta */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed border-emerald-600 text-emerald-600 hover:bg-emerald-50"
              onClick={() => setNovaPropostaOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Adicionar Proposta
            </Button>

            {/* Lista de propostas */}
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : propostas.length === 0 ? (
              <div className="text-center py-4">
                <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma proposta cadastrada
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[350px]">
                <div className="space-y-2">
                  {propostas.map((proposta) => {
                    const statusConfig = STATUS_CONFIG[proposta.status] || STATUS_CONFIG.em_andamento;
                    const StatusIcon = statusConfig.icon;
                    const isPago = proposta.status === "pago";
                    const isCancelado = proposta.status === "cancelado";

                    return (
                      <div
                        key={proposta.id}
                        className={`p-2 border rounded-lg space-y-1.5 group relative ${
                          isPago
                            ? "bg-green-50/50 border-green-200"
                            : isCancelado
                            ? "bg-red-50/30 border-red-200 opacity-70"
                            : "bg-muted/30"
                        }`}
                      >
                        {/* Cabeçalho */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                              <span className="text-xs font-medium truncate">
                                {proposta.banco}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0"
                              >
                                {TIPO_LABELS[proposta.tipo] || proposta.tipo}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-emerald-600">
                              {formatCurrency(proposta.valor_liberado)}
                            </span>
                            {!isPago && !isCancelado && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => setEditProposta(proposta)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                                  onClick={() => setDeletePropostaId(proposta.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status e alteração rápida */}
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0.5 flex items-center gap-1 ${statusConfig.color}`}
                          >
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusConfig.label}
                          </Badge>

                          {!isPago && !isCancelado && (
                            <Select
                              value={proposta.status}
                              onValueChange={(value) =>
                                handleStatusChange(proposta.id, value)
                              }
                              disabled={updatingStatus === proposta.id}
                            >
                              <SelectTrigger className="h-6 text-[10px] w-auto min-w-[120px] border-dashed">
                                {updatingStatus === proposta.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <SelectValue placeholder="Alterar Status" />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem
                                    key={s.value}
                                    value={s.value}
                                    className="text-xs"
                                  >
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>

                        {/* Data */}
                        <div className="text-[10px] text-muted-foreground">
                          Criado em {formatDate(proposta.created_at)}
                        </div>

                        {/* Motivo cancelamento */}
                        {isCancelado && proposta.motivo_cancelamento && (
                          <p className="text-[10px] text-red-600 italic">
                            Motivo: {proposta.motivo_cancelamento}
                          </p>
                        )}

                        {/* Notas */}
                        {proposta.notas && (
                          <p className="text-[10px] text-muted-foreground italic truncate">
                            {proposta.notas}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}

            {/* Resumo */}
            {propostas.length > 0 && (
              <div className="pt-2 border-t space-y-1">
                {totalLiberado > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Pago:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(totalLiberado)}
                    </span>
                  </div>
                )}
                {totalEmAndamento > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Em Andamento:</span>
                    <span className="font-medium text-blue-600">
                      {formatCurrency(totalEmAndamento)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Dialog para nova proposta */}
      <PropostaBancariaDialog
        open={novaPropostaOpen}
        onOpenChange={setNovaPropostaOpen}
        leadId={leadId}
        companyId={companyId}
        onPropostaAdded={() => {
          carregarPropostas();
          onPropostaUpdated?.();
        }}
      />

      {/* Dialog para editar proposta */}
      <PropostaBancariaDialog
        open={!!editProposta}
        onOpenChange={(open) => !open && setEditProposta(null)}
        leadId={leadId}
        companyId={companyId}
        editProposta={editProposta}
        onPropostaAdded={() => {
          carregarPropostas();
          onPropostaUpdated?.();
          setEditProposta(null);
        }}
      />

      {/* Dialog de confirmação para excluir */}
      <AlertDialog
        open={!!deletePropostaId}
        onOpenChange={(open) => !open && setDeletePropostaId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta proposta bancária? Esta ação
              não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingProposta}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProposta}
              disabled={deletingProposta}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProposta ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
