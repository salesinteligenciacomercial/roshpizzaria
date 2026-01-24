import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  CalendarDays,
  Percent,
  BarChart3,
  RefreshCw
} from "lucide-react";
import LeadsDrilldownModal, { DrilldownFilterType } from "./LeadsDrilldownModal";

interface PipelineFinanceiroProps {
  userCompanyId: string | null;
  globalFilters?: {
    period: string;
    startDate?: string;
    endDate?: string;
  };
}

interface PipelineMetrics {
  valorPipeline: number;
  valorPonderado: number;
  vendasFechadas: number;
  vendasPerdidas: number;
  ticketMedio: number;
  cicloMedioVenda: number;
  leadsAtivos: number;
  leadsVencidos: number;
  taxaConversao: number;
  proximosAFechar: number;
  valorProximosAFechar: number;
}

export function PipelineFinanceiro({ userCompanyId, globalFilters }: PipelineFinanceiroProps) {
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    valorPipeline: 0,
    valorPonderado: 0,
    vendasFechadas: 0,
    vendasPerdidas: 0,
    ticketMedio: 0,
    cicloMedioVenda: 0,
    leadsAtivos: 0,
    leadsVencidos: 0,
    taxaConversao: 0,
    proximosAFechar: 0,
    valorProximosAFechar: 0
  });
  const [loading, setLoading] = useState(true);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownFilter, setDrilldownFilter] = useState<{
    type: DrilldownFilterType;
    title: string;
    description: string;
  } | null>(null);

  useEffect(() => {
    if (userCompanyId) {
      fetchMetrics();
    }
  }, [userCompanyId, globalFilters]);

  const fetchMetrics = async () => {
    if (!userCompanyId) return;
    setLoading(true);

    try {
      // Calcular datas baseado no período
      let startDate: Date | null = null;
      const now = new Date();
      
      if (globalFilters?.period && globalFilters.period !== 'all') {
        switch (globalFilters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        }
      }

      // Buscar todos os leads da empresa
      let query = supabase
        .from("leads")
        .select("id, value, status, probability, expected_close_date, created_at, won_at, lost_at, conversion_timestamp")
        .eq("company_id", userCompanyId);

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: leads, error } = await query;
      if (error) throw error;

      // Buscar vendas da tabela customer_sales para valores mais precisos
      let salesQuery = supabase
        .from("customer_sales")
        .select("lead_id, valor_final, status, finalized_at")
        .eq("company_id", userCompanyId);

      if (startDate) {
        salesQuery = salesQuery.gte('created_at', startDate.toISOString());
      }

      const { data: sales } = await salesQuery;
      const allSales = sales || [];

      const allLeads = leads || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Leads ativos (não ganhos e não perdidos)
      const leadsAtivos = allLeads.filter(l => l.status !== 'ganho' && l.status !== 'perdido');
      
      // Valor total no pipeline - usar vendas em negociação
      const vendasEmNegociacao = allSales.filter(s => s.status === 'em_negociacao' || !s.status);
      const valorPipelineFromSales = vendasEmNegociacao.reduce((sum, s) => sum + (Number(s.valor_final) || 0), 0);
      const valorPipelineFromLeads = leadsAtivos.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const valorPipeline = valorPipelineFromSales > 0 ? valorPipelineFromSales : valorPipelineFromLeads;
      
      // Valor ponderado (valor × probabilidade)
      const valorPonderado = leadsAtivos.reduce((sum, l) => {
        const value = Number(l.value) || 0;
        const prob = (l.probability || 50) / 100;
        return sum + (value * prob);
      }, 0);

      // Leads com data vencida
      const leadsVencidos = leadsAtivos.filter(l => {
        if (!l.expected_close_date) return false;
        const closeDate = new Date(l.expected_close_date);
        return closeDate < today;
      }).length;

      // Próximos a fechar (leads com data de fechamento nos próximos 7 dias)
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const leadsProximosAFechar = leadsAtivos.filter(l => {
        if (!l.expected_close_date) return false;
        const closeDate = new Date(l.expected_close_date);
        return closeDate >= today && closeDate <= nextWeek;
      });
      const proximosAFechar = leadsProximosAFechar.length;
      const valorProximosAFechar = leadsProximosAFechar.reduce((sum, l) => sum + (Number(l.value) || 0), 0);

      // Vendas fechadas - combinar leads.value (atualizado) + customer_sales ganhas
      const leadsGanhos = allLeads.filter(l => l.status === 'ganho');
      const vendasGanhasFromSales = allSales.filter(s => s.status === 'ganho');
      const valorVendasGanhas = vendasGanhasFromSales.reduce((sum, s) => sum + (Number(s.valor_final) || 0), 0);
      const valorLeadsGanhos = leadsGanhos.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      // Usar o maior valor entre as duas fontes (leads.value já deve estar sincronizado)
      const vendasFechadas = Math.max(valorVendasGanhas, valorLeadsGanhos);

      // Vendas perdidas - combinar ambas as fontes
      const leadsPerdidos = allLeads.filter(l => l.status === 'perdido');
      const vendasPerdidasFromSales = allSales.filter(s => s.status === 'perdido');
      const valorVendasPerdidas = vendasPerdidasFromSales.reduce((sum, s) => sum + (Number(s.valor_final) || 0), 0);
      const valorLeadsPerdidos = leadsPerdidos.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
      const vendasPerdidas = Math.max(valorVendasPerdidas, valorLeadsPerdidos);

      // Ticket médio - baseado em vendas individuais quando disponível
      const countVendasGanhas = vendasGanhasFromSales.length > 0 ? vendasGanhasFromSales.length : leadsGanhos.length;
      const ticketMedio = countVendasGanhas > 0 ? vendasFechadas / countVendasGanhas : 0;

      // Taxa de conversão - CORRIGIDO: calcula sobre TODOS os leads, não só finalizados
      // Ganhos dividido pelo total de leads = taxa real de conversão
      const taxaConversao = allLeads.length > 0 
        ? (leadsGanhos.length / allLeads.length) * 100 
        : 0;

      // Ciclo médio de venda (dias entre criação e ganho)
      let cicloTotal = 0;
      let cicloCount = 0;
      leadsGanhos.forEach(l => {
        const createdAt = new Date(l.created_at);
        const wonAt = l.won_at ? new Date(l.won_at) : (l.conversion_timestamp ? new Date(l.conversion_timestamp) : null);
        if (wonAt) {
          const dias = Math.floor((wonAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          cicloTotal += dias;
          cicloCount++;
        }
      });
      const cicloMedioVenda = cicloCount > 0 ? Math.round(cicloTotal / cicloCount) : 0;

      setMetrics({
        valorPipeline,
        valorPonderado,
        vendasFechadas,
        vendasPerdidas,
        ticketMedio,
        cicloMedioVenda,
        leadsAtivos: leadsAtivos.length,
        leadsVencidos,
        taxaConversao,
        proximosAFechar,
        valorProximosAFechar
      });

    } catch (error) {
      console.error("Erro ao carregar métricas financeiras:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const openDrilldown = (type: DrilldownFilterType, title: string, description: string) => {
    setDrilldownFilter({ type, title, description });
    setDrilldownOpen(true);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="h-32 bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Pipeline Financeiro
          </h3>
          <Button variant="ghost" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Valor em Pipeline */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openDrilldown('pipeline', 'Leads em Pipeline', 'Todos os leads ativos com valor associado')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor em Pipeline</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.valorPipeline)}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.leadsAtivos} leads ativos
              </p>
            </CardContent>
          </Card>

          {/* Previsão Ponderada */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Previsão Ponderada</CardTitle>
              <Target className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.valorPonderado)}</div>
              <p className="text-xs text-muted-foreground">
                Valor × Probabilidade
              </p>
            </CardContent>
          </Card>

          {/* Vendas Fechadas */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openDrilldown('won', 'Vendas Fechadas', 'Leads convertidos com sucesso')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Fechadas</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(metrics.vendasFechadas)}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {metrics.taxaConversao.toFixed(1)}% conversão
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Vendas Perdidas */}
          <Card 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => openDrilldown('lost', 'Vendas Perdidas', 'Leads que não converteram')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Perdidas</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(metrics.vendasPerdidas)}</div>
              <p className="text-xs text-muted-foreground">
                Valor total perdido
              </p>
            </CardContent>
          </Card>

          {/* Ticket Médio */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.ticketMedio)}</div>
              <p className="text-xs text-muted-foreground">
                Valor médio por venda
              </p>
            </CardContent>
          </Card>

          {/* Próximos a Fechar */}
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Próximos a Fechar</CardTitle>
              <CalendarDays className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{metrics.proximosAFechar}</div>
              <p className="text-xs text-muted-foreground">
                {formatCurrency(metrics.valorProximosAFechar)} nos próximos 7 dias
              </p>
            </CardContent>
          </Card>

          {/* Taxa de Conversão */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <Percent className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-600">{metrics.taxaConversao.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Leads ganhos / Total de leads
              </p>
            </CardContent>
          </Card>

          {/* Ciclo Médio de Venda */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ciclo Médio</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.cicloMedioVenda} dias</div>
              <p className="text-xs text-muted-foreground">
                Tempo médio até fechamento
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas */}
        {metrics.leadsVencidos > 0 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">
                  {metrics.leadsVencidos} leads com data de fechamento vencida
                </p>
                <p className="text-sm text-orange-600 dark:text-orange-500">
                  Revise esses leads e atualize as datas previstas
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="ml-auto border-orange-300 text-orange-700"
                onClick={() => openDrilldown('pipeline', 'Leads Vencidos', 'Leads com data de fechamento vencida')}
              >
                Ver leads
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Drilldown Modal */}
      {drilldownFilter && (
        <LeadsDrilldownModal
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          title={drilldownFilter.title}
          description={drilldownFilter.description}
          filterType={drilldownFilter.type}
          userCompanyId={userCompanyId}
          globalFilters={globalFilters || { period: 'all' }}
        />
      )}
    </>
  );
}
