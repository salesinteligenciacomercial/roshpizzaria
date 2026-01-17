import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";
import { TrendingUp, TrendingDown, Calendar, Sparkles } from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface SaleData {
  wonAt: string;
  value: number;
  productId: string;
}

interface ProductSeasonalityChartProps {
  salesData: SaleData[];
  period: string;
}

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export default function ProductSeasonalityChart({ salesData, period }: ProductSeasonalityChartProps) {
  const { chartData, insights } = useMemo(() => {
    // Group sales by month
    const monthlyData: Record<string, { count: number; revenue: number }> = {};
    
    // Initialize all months
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Get last 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { count: 0, revenue: 0 };
    }

    // Populate with actual data
    salesData.forEach(sale => {
      if (!sale.wonAt) return;
      const date = new Date(sale.wonAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[key]) {
        monthlyData[key].count++;
        monthlyData[key].revenue += sale.value;
      }
    });

    // Convert to arrays
    const sortedKeys = Object.keys(monthlyData).sort();
    const labels = sortedKeys.map(key => {
      const [year, month] = key.split("-");
      return `${MONTH_NAMES[parseInt(month) - 1]}/${year.slice(2)}`;
    });
    const revenueData = sortedKeys.map(key => monthlyData[key].revenue);
    const countData = sortedKeys.map(key => monthlyData[key].count);

    // Calculate insights
    const totalRevenue = revenueData.reduce((a, b) => a + b, 0);
    const avgRevenue = totalRevenue / revenueData.length;
    
    // Best and worst months
    let bestMonthIndex = 0;
    let worstMonthIndex = 0;
    let bestValue = revenueData[0] || 0;
    let worstValue = revenueData[0] || Infinity;

    revenueData.forEach((value, index) => {
      if (value > bestValue) {
        bestValue = value;
        bestMonthIndex = index;
      }
      if (value < worstValue && value > 0) {
        worstValue = value;
        worstMonthIndex = index;
      }
    });

    // Current vs previous month trend
    const currentMonthRevenue = revenueData[revenueData.length - 1] || 0;
    const previousMonthRevenue = revenueData[revenueData.length - 2] || 0;
    const monthlyGrowth = previousMonthRevenue > 0 
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0;

    return {
      chartData: {
        labels,
        datasets: [
          {
            label: "Receita",
            data: revenueData,
            borderColor: "rgba(59, 130, 246, 1)",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "rgba(59, 130, 246, 1)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "Vendas",
            data: countData,
            borderColor: "rgba(16, 185, 129, 1)",
            backgroundColor: "transparent",
            borderDash: [5, 5],
            tension: 0.4,
            pointBackgroundColor: "rgba(16, 185, 129, 1)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            yAxisID: "y1"
          }
        ]
      },
      insights: {
        bestMonth: labels[bestMonthIndex] || "N/A",
        bestMonthValue: bestValue,
        worstMonth: worstValue !== Infinity ? labels[worstMonthIndex] : "N/A",
        worstMonthValue: worstValue !== Infinity ? worstValue : 0,
        monthlyGrowth,
        avgRevenue,
        totalSales: countData.reduce((a, b) => a + b, 0)
      }
    };
  }, [salesData]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          usePointStyle: true,
          padding: 15
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            if (context.dataset.label === "Receita") {
              return `Receita: ${new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL"
              }).format(context.raw)}`;
            }
            return `Vendas: ${context.raw}`;
          }
        }
      }
    },
    scales: {
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        beginAtZero: true,
        title: {
          display: true,
          text: "Receita (R$)"
        },
        ticks: {
          callback: (value: any) => {
            if (value >= 1000) {
              return `R$ ${(value / 1000).toFixed(0)}k`;
            }
            return `R$ ${value}`;
          }
        }
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        beginAtZero: true,
        title: {
          display: true,
          text: "Nº de Vendas"
        },
        grid: {
          drawOnChartArea: false
        }
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Evolução de Vendas (12 meses)
          </div>
          <div className="flex gap-2">
            {insights.monthlyGrowth !== 0 && (
              <Badge 
                variant="secondary" 
                className={insights.monthlyGrowth > 0 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
                }
              >
                {insights.monthlyGrowth > 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {insights.monthlyGrowth > 0 ? "+" : ""}{insights.monthlyGrowth.toFixed(1)}% vs mês anterior
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <Line data={chartData} options={chartOptions} />
        </div>

        {/* Insights Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
          <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-green-600 text-xs font-medium mb-1">
              <TrendingUp className="h-3 w-3" />
              Melhor Mês
            </div>
            <p className="font-bold text-sm">{insights.bestMonth}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(insights.bestMonthValue)}</p>
          </div>
          
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-amber-600 text-xs font-medium mb-1">
              <TrendingDown className="h-3 w-3" />
              Mês Mais Fraco
            </div>
            <p className="font-bold text-sm">{insights.worstMonth}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(insights.worstMonthValue)}</p>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-blue-600 text-xs font-medium mb-1">
              <Sparkles className="h-3 w-3" />
              Média Mensal
            </div>
            <p className="font-bold text-sm">{formatCurrency(insights.avgRevenue)}</p>
            <p className="text-xs text-muted-foreground">{(insights.totalSales / 12).toFixed(1)} vendas/mês</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3">
            <div className="flex items-center gap-1 text-purple-600 text-xs font-medium mb-1">
              <Calendar className="h-3 w-3" />
              Total Período
            </div>
            <p className="font-bold text-sm">{insights.totalSales} vendas</p>
            <p className="text-xs text-muted-foreground">últimos 12 meses</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
