import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  Receipt,
  Percent,
  Target
} from 'lucide-react';
import { FinanceiroKPIs } from '@/hooks/useFinanceiro';

interface FinanceiroDashboardProps {
  kpis: FinanceiroKPIs;
  loading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function FinanceiroDashboard({ kpis, loading }: FinanceiroDashboardProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-4 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-muted rounded mb-1" />
              <div className="h-3 w-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'MRR Atual',
      value: formatCurrency(kpis.mrr),
      icon: DollarSign,
      description: 'Receita Recorrente Mensal',
      trend: kpis.mrrVariation,
      color: 'text-emerald-600'
    },
    {
      title: 'Variação MRR',
      value: formatPercent(kpis.mrrVariation),
      icon: kpis.mrrVariation >= 0 ? TrendingUp : TrendingDown,
      description: 'vs mês anterior',
      color: kpis.mrrVariation >= 0 ? 'text-emerald-600' : 'text-red-600'
    },
    {
      title: 'Clientes Ativos',
      value: kpis.activeClients.toString(),
      icon: Users,
      description: 'subcontas pagantes',
      color: 'text-blue-600'
    },
    {
      title: 'Pago no Mês',
      value: formatCurrency(kpis.paidThisMonth),
      icon: Receipt,
      description: 'recebido este mês',
      color: 'text-emerald-600'
    },
    {
      title: 'A Receber',
      value: formatCurrency(kpis.pendingAmount),
      icon: Clock,
      description: 'faturas pendentes',
      color: 'text-amber-600'
    },
    {
      title: 'Inadimplentes',
      value: formatCurrency(kpis.overdueAmount),
      icon: AlertTriangle,
      description: `${kpis.overdueCount} fatura(s) em atraso`,
      color: 'text-red-600'
    },
    {
      title: 'Taxa Setup (Ano)',
      value: formatCurrency(kpis.setupFeesYear),
      icon: Target,
      description: 'implantações este ano',
      color: 'text-purple-600'
    },
    {
      title: 'Churn Rate',
      value: formatPercent(kpis.churnRate),
      icon: Percent,
      description: 'taxa de cancelamento',
      color: kpis.churnRate < 5 ? 'text-emerald-600' : 'text-red-600'
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${card.color}`}>
              {card.value}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
