import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Sparkles, TrendingUp, TrendingDown, Users, Send, 
  Clock, Target, AlertCircle, Zap
} from "lucide-react";
import { toast } from "sonner";

interface ProductStats {
  id: string;
  nome: string;
  vendasCount: number;
  receitaTotal: number;
}

interface Opportunity {
  id: string;
  type: "growth" | "decline" | "dormant" | "high_value";
  icon: React.ReactNode;
  title: string;
  description: string;
  actionText: string;
  priority: "high" | "medium" | "low";
  data?: any;
}

interface MarketingOpportunitiesProps {
  currentStats: ProductStats[];
  previousStats: ProductStats[];
  dormantCustomersCount: number;
  onViewCustomers: (productId: string, productName: string) => void;
}

export default function MarketingOpportunities({
  currentStats,
  previousStats,
  dormantCustomersCount,
  onViewCustomers
}: MarketingOpportunitiesProps) {
  const opportunities = useMemo(() => {
    const opps: Opportunity[] = [];
    
    // Create previous stats map
    const previousMap = new Map<string, number>();
    previousStats.forEach(stat => {
      previousMap.set(stat.id, stat.receitaTotal);
    });

    // Find products in growth (>20%)
    const growthProducts = currentStats.filter(stat => {
      const prev = previousMap.get(stat.id) || 0;
      if (prev === 0) return stat.receitaTotal > 0;
      return ((stat.receitaTotal - prev) / prev) * 100 > 20;
    });

    // Find products in decline (>20%)
    const decliningProducts = currentStats.filter(stat => {
      const prev = previousMap.get(stat.id) || 0;
      if (prev === 0) return false;
      return ((stat.receitaTotal - prev) / prev) * 100 < -20;
    });

    // Top seller opportunity
    if (growthProducts.length > 0) {
      const topGrowth = growthProducts.sort((a, b) => b.receitaTotal - a.receitaTotal)[0];
      opps.push({
        id: `growth-${topGrowth.id}`,
        type: "growth",
        icon: <TrendingUp className="h-5 w-5 text-green-600" />,
        title: `${topGrowth.nome} em alta!`,
        description: `Este produto está crescendo. Ideal para intensificar campanhas e aproveitar o momento.`,
        actionText: "Ver clientes",
        priority: "high",
        data: topGrowth
      });
    }

    // Declining product opportunity
    if (decliningProducts.length > 0) {
      const topDecline = decliningProducts[0];
      opps.push({
        id: `decline-${topDecline.id}`,
        type: "decline",
        icon: <TrendingDown className="h-5 w-5 text-amber-600" />,
        title: `${topDecline.nome} precisa de atenção`,
        description: `Vendas em queda. Considere criar uma promoção ou campanha de remarketing.`,
        actionText: "Criar campanha",
        priority: "medium",
        data: topDecline
      });
    }

    // Dormant customers opportunity
    if (dormantCustomersCount > 0) {
      opps.push({
        id: "dormant-customers",
        type: "dormant",
        icon: <Clock className="h-5 w-5 text-blue-600" />,
        title: `${dormantCustomersCount} clientes inativos`,
        description: `Clientes que não compram há mais de 60 dias. Ótima oportunidade para reativação.`,
        actionText: "Ver clientes",
        priority: "medium"
      });
    }

    // High value product opportunity
    const highValueProducts = currentStats
      .filter(s => s.vendasCount > 0)
      .sort((a, b) => (b.receitaTotal / b.vendasCount) - (a.receitaTotal / a.vendasCount));
    
    if (highValueProducts.length > 0) {
      const topValue = highValueProducts[0];
      const ticketMedio = topValue.receitaTotal / topValue.vendasCount;
      opps.push({
        id: `highvalue-${topValue.id}`,
        type: "high_value",
        icon: <Target className="h-5 w-5 text-purple-600" />,
        title: `${topValue.nome} - Maior ticket`,
        description: `Ticket médio de R$ ${ticketMedio.toLocaleString("pt-BR")}. Foque em clientes de alto valor.`,
        actionText: "Ver clientes",
        priority: "low",
        data: topValue
      });
    }

    return opps;
  }, [currentStats, previousStats, dormantCustomersCount]);

  const handleAction = (opp: Opportunity) => {
    if (opp.data && (opp.type === "growth" || opp.type === "decline" || opp.type === "high_value")) {
      onViewCustomers(opp.data.id, opp.data.nome);
    } else if (opp.type === "dormant") {
      toast.info("Funcionalidade de reativação em desenvolvimento");
    }
  };

  const priorityColors = {
    high: "border-l-red-500 bg-red-50 dark:bg-red-950/20",
    medium: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
    low: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/20"
  };

  const priorityLabels = {
    high: { text: "Alta", color: "bg-red-100 text-red-700" },
    medium: { text: "Média", color: "bg-amber-100 text-amber-700" },
    low: { text: "Baixa", color: "bg-blue-100 text-blue-700" }
  };

  if (opportunities.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Oportunidades de Marketing
          <Badge variant="secondary" className="ml-2">
            {opportunities.length} sugestões
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className={`rounded-lg border-l-4 p-4 ${priorityColors[opp.priority]}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{opp.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{opp.title}</h4>
                      <Badge variant="secondary" className={`text-xs ${priorityLabels[opp.priority].color}`}>
                        {priorityLabels[opp.priority].text}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{opp.description}</p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction(opp)}
                  className="text-xs"
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {opp.actionText}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
