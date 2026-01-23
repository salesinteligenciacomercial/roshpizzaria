import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { CompanySubscription, BillingTransaction } from '@/hooks/useFinanceiro';
import { useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MRRChartProps {
  subscriptions: CompanySubscription[];
  transactions: BillingTransaction[];
  loading?: boolean;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

export function MRRChart({ subscriptions, transactions, loading }: MRRChartProps) {
  // Generate MRR data for last 6 months
  const mrrData = useMemo(() => {
    const data = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      // Sum of monthly values for active subscriptions that existed in that month
      const mrr = subscriptions
        .filter(s => {
          const startDate = new Date(s.start_date);
          return startDate <= monthEnd && s.status === 'active';
        })
        .reduce((sum, s) => sum + Number(s.monthly_value || 0), 0);

      // Sum of confirmed payments in that month
      const revenue = transactions
        .filter(t => {
          const paymentDate = new Date(t.payment_date);
          return t.status === 'confirmed' && 
                 (t.type === 'payment' || t.type === 'setup_fee') &&
                 isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        })
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      data.push({
        month: format(monthDate, 'MMM', { locale: ptBR }),
        mrr,
        revenue
      });
    }

    return data;
  }, [subscriptions, transactions]);

  // Revenue by plan
  const revenueByPlan = useMemo(() => {
    const planRevenue: Record<string, number> = {};

    subscriptions
      .filter(s => s.status === 'active')
      .forEach(s => {
        const planName = s.billing_plan?.name || 'Personalizado';
        planRevenue[planName] = (planRevenue[planName] || 0) + Number(s.monthly_value || 0);
      });

    return Object.entries(planRevenue).map(([name, value]) => ({
      name,
      value
    }));
  }, [subscriptions]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statusCount: Record<string, number> = {
      active: 0,
      trial: 0,
      suspended: 0,
      cancelled: 0,
      pending: 0
    };

    subscriptions.forEach(s => {
      statusCount[s.status] = (statusCount[s.status] || 0) + 1;
    });

    const labels: Record<string, string> = {
      active: 'Ativos',
      trial: 'Trial',
      suspended: 'Suspensos',
      cancelled: 'Cancelados',
      pending: 'Pendentes'
    };

    return Object.entries(statusCount)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: labels[status],
        value: count
      }));
  }, [subscriptions]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-32 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-[250px] bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* MRR Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução MRR & Receita</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={mrrData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="mrr" name="MRR" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenue" name="Receita" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receita por Plano</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByPlan.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Nenhuma assinatura ativa
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={revenueByPlan}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                  labelLine={false}
                >
                  {revenueByPlan.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusDistribution.length === 0 ? (
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Nenhuma assinatura
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tendência Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mrrData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="month" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="mrr" 
                name="MRR" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981' }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                name="Receita" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
