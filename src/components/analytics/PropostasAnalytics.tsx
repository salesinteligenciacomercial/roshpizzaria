import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  RefreshCw,
  Loader2,
  Search,
  TrendingUp,
  BarChart3,
  Filter,
  Pencil,
} from "lucide-react";

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
  lead_id: string;
  lead_name?: string;
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
  { value: "all", label: "Todos os Status" },
  { value: "em_andamento", label: "Em andamento" },
  { value: "aguardando_cip", label: "Aguardando CIP" },
  { value: "aguardando_averbacao", label: "Aguardando Averbação" },
  { value: "aguardando_pagamento", label: "Aguardando Pagamento" },
  { value: "pendente", label: "Pendente" },
  { value: "cancelado", label: "Cancelado" },
  { value: "pago", label: "Pago" },
];

export default function PropostasAnalytics() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchPropostas = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      let query = supabase
        .from("propostas_bancarias")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch lead names
      const leadIds = [...new Set((data || []).map((p) => p.lead_id))];
      let leadsMap: Record<string, string> = {};

      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, name")
          .in("id", leadIds);

        (leads || []).forEach((l) => {
          leadsMap[l.id] = l.name || "Sem nome";
        });
      }

      setPropostas(
        (data || []).map((p) => ({
          ...p,
          lead_name: leadsMap[p.lead_id] || "Lead não encontrado",
        }))
      );
    } catch (error) {
      console.error("Erro ao carregar propostas:", error);
      toast.error("Erro ao carregar propostas");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPropostas();
  }, [fetchPropostas]);

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
        prev.map((p) => (p.id === propostaId ? { ...p, status: novoStatus } : p))
      );
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const filtered = propostas.filter((p) => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        p.banco.toLowerCase().includes(term) ||
        (p.lead_name || "").toLowerCase().includes(term) ||
        (p.notas || "").toLowerCase().includes(term)
      );
    }
    return true;
  });

  // KPIs
  const totalPropostas = propostas.length;
  const totalPago = propostas.filter((p) => p.status === "pago").reduce((s, p) => s + (p.valor_liberado || 0), 0);
  const totalEmAndamento = propostas.filter((p) => !["pago", "cancelado"].includes(p.status)).reduce((s, p) => s + (p.valor_liberado || 0), 0);
  const totalCancelado = propostas.filter((p) => p.status === "cancelado").length;
  const totalPagoCount = propostas.filter((p) => p.status === "pago").length;
  const taxaSucesso = totalPropostas > 0 ? ((totalPagoCount / totalPropostas) * 100).toFixed(1) : "0";

  // Status counts for badges
  const statusCounts: Record<string, number> = {};
  propostas.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Propostas</p>
                <p className="text-3xl font-bold">{totalPropostas}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Pago</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(totalPago)}</p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalPagoCount} propostas pagas</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Em Andamento</p>
                <p className="text-3xl font-bold text-blue-600">{formatCurrency(totalEmAndamento)}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-emerald-600">{taxaSucesso}%</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{totalCancelado} canceladas</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Overview */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Resumo por Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {STATUS_OPTIONS.filter((s) => s.value !== "all").map((s) => {
              const config = STATUS_CONFIG[s.value];
              const count = statusCounts[s.value] || 0;
              const Icon = config?.icon || AlertCircle;
              return (
                <Button
                  key={s.value}
                  variant={statusFilter === s.value ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setStatusFilter(statusFilter === s.value ? "all" : s.value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters & Table */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Propostas Bancárias
              {statusFilter !== "all" && (
                <Badge variant="outline" className="ml-2">
                  {STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar banco, lead..."
                  className="pl-9 w-[250px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm" onClick={fetchPropostas}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">Nenhuma proposta encontrada</p>
              <p className="text-sm">
                {statusFilter !== "all"
                  ? "Tente alterar o filtro de status"
                  : "Adicione propostas no menu Conversas"}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-3">
                {filtered.map((proposta) => {
                  const statusConfig = STATUS_CONFIG[proposta.status] || STATUS_CONFIG.em_andamento;
                  const StatusIcon = statusConfig.icon;
                  const isPago = proposta.status === "pago";
                  const isCancelado = proposta.status === "cancelado";

                  return (
                    <div
                      key={proposta.id}
                      className={`p-4 border rounded-lg flex items-center justify-between gap-4 transition-all hover:shadow-sm ${
                        isPago
                          ? "bg-green-50/50 border-green-200 dark:bg-green-900/10"
                          : isCancelado
                          ? "bg-red-50/30 border-red-200 opacity-70 dark:bg-red-900/10"
                          : "bg-card"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-medium">{proposta.banco}</span>
                          <Badge variant="outline" className="text-xs">
                            {TIPO_LABELS[proposta.tipo] || proposta.tipo}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs flex items-center gap-1 ${statusConfig.color}`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>Lead: <strong className="text-foreground">{proposta.lead_name}</strong></span>
                          <span>•</span>
                          <span>{formatDate(proposta.created_at)}</span>
                          {proposta.notas && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[200px] italic">{proposta.notas}</span>
                            </>
                          )}
                        </div>
                        {isCancelado && proposta.motivo_cancelamento && (
                          <p className="text-xs text-red-600 mt-1 italic">
                            Motivo: {proposta.motivo_cancelamento}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-lg font-bold text-emerald-600">
                          {formatCurrency(proposta.valor_liberado)}
                        </span>

                        {!isPago && !isCancelado && (
                          <Select
                            value={proposta.status}
                            onValueChange={(v) => handleStatusChange(proposta.id, v)}
                            disabled={updatingStatus === proposta.id}
                          >
                            <SelectTrigger className="h-8 text-xs w-[150px] border-dashed">
                              {updatingStatus === proposta.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <SelectValue placeholder="Alterar" />
                              )}
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.filter((s) => s.value !== "all").map((s) => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
