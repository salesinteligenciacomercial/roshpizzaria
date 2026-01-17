import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, TrendingDown, Minus, BarChart3, 
  ArrowUpRight, ArrowDownRight, Eye, Users
} from "lucide-react";

interface ProductStats {
  id: string;
  nome: string;
  categoria: string | null;
  vendasCount: number;
  receitaTotal: number;
  ticketMedio: number;
}

interface ProductWithTrend extends ProductStats {
  previousVendasCount: number;
  previousReceitaTotal: number;
  vendasGrowth: number;
  receitaGrowth: number;
  rankChange: number;
  previousRank: number;
  currentRank: number;
}

interface ProductComparisonTableProps {
  currentStats: ProductStats[];
  previousStats: ProductStats[];
  onViewHistory: (productId: string, productName: string) => void;
  onViewCustomers: (productId: string, productName: string) => void;
}

export default function ProductComparisonTable({
  currentStats,
  previousStats,
  onViewHistory,
  onViewCustomers
}: ProductComparisonTableProps) {
  const comparisonData = useMemo(() => {
    // Create a map of previous stats
    const previousMap = new Map<string, { vendasCount: number; receitaTotal: number; rank: number }>();
    previousStats.forEach((stat, index) => {
      previousMap.set(stat.id, {
        vendasCount: stat.vendasCount,
        receitaTotal: stat.receitaTotal,
        rank: index + 1
      });
    });

    // Calculate comparisons
    const comparison: ProductWithTrend[] = currentStats.map((stat, index) => {
      const prev = previousMap.get(stat.id) || { vendasCount: 0, receitaTotal: 0, rank: 0 };
      
      const vendasGrowth = prev.vendasCount > 0 
        ? ((stat.vendasCount - prev.vendasCount) / prev.vendasCount) * 100 
        : stat.vendasCount > 0 ? 100 : 0;
      
      const receitaGrowth = prev.receitaTotal > 0 
        ? ((stat.receitaTotal - prev.receitaTotal) / prev.receitaTotal) * 100 
        : stat.receitaTotal > 0 ? 100 : 0;

      return {
        ...stat,
        previousVendasCount: prev.vendasCount,
        previousReceitaTotal: prev.receitaTotal,
        vendasGrowth,
        receitaGrowth,
        previousRank: prev.rank,
        currentRank: index + 1,
        rankChange: prev.rank > 0 ? prev.rank - (index + 1) : 0
      };
    });

    return comparison;
  }, [currentStats, previousStats]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(value);
  };

  const formatGrowth = (value: number) => {
    if (value === 0) return null;
    const formatted = Math.abs(value).toFixed(1);
    return value > 0 ? `+${formatted}%` : `-${formatted}%`;
  };

  const TrendIndicator = ({ value, showText = true }: { value: number; showText?: boolean }) => {
    if (value === 0) {
      return (
        <div className="flex items-center text-muted-foreground">
          <Minus className="h-4 w-4" />
          {showText && <span className="ml-1 text-xs">0%</span>}
        </div>
      );
    }
    
    if (value > 0) {
      return (
        <div className="flex items-center text-green-600">
          <ArrowUpRight className="h-4 w-4" />
          {showText && <span className="ml-1 text-xs font-medium">{formatGrowth(value)}</span>}
        </div>
      );
    }
    
    return (
      <div className="flex items-center text-red-600">
        <ArrowDownRight className="h-4 w-4" />
        {showText && <span className="ml-1 text-xs font-medium">{formatGrowth(value)}</span>}
      </div>
    );
  };

  const RankBadge = ({ current, change }: { current: number; change: number }) => {
    let bgColor = "bg-muted";
    let textColor = "text-muted-foreground";
    
    if (current <= 3) {
      bgColor = current === 1 ? "bg-yellow-100" : current === 2 ? "bg-gray-100" : "bg-amber-100";
      textColor = current === 1 ? "text-yellow-700" : current === 2 ? "text-gray-700" : "text-amber-700";
    }

    return (
      <div className="flex items-center gap-1">
        <Badge variant="secondary" className={`${bgColor} ${textColor} font-bold`}>
          #{current}
        </Badge>
        {change !== 0 && (
          <span className={`text-xs ${change > 0 ? "text-green-600" : "text-red-600"}`}>
            {change > 0 ? `↑${change}` : `↓${Math.abs(change)}`}
          </span>
        )}
      </div>
    );
  };

  // Identify products in growth and decline
  const productsInGrowth = comparisonData.filter(p => p.receitaGrowth > 10).length;
  const productsInDecline = comparisonData.filter(p => p.receitaGrowth < -10).length;

  return (
    <Card className="border-0 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Comparativo de Produtos
          </div>
          <div className="flex gap-2">
            {productsInGrowth > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-700">
                <TrendingUp className="h-3 w-3 mr-1" />
                {productsInGrowth} em alta
              </Badge>
            )}
            {productsInDecline > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700">
                <TrendingDown className="h-3 w-3 mr-1" />
                {productsInDecline} em queda
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Rank</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-center">Tendência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum produto com vendas no período
                  </TableCell>
                </TableRow>
              ) : (
                comparisonData.map((product) => (
                  <TableRow key={product.id} className="hover:bg-muted/50">
                    <TableCell>
                      <RankBadge current={product.currentRank} change={product.rankChange} />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{product.nome}</p>
                        {product.categoria && (
                          <p className="text-xs text-muted-foreground">{product.categoria}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium">{product.vendasCount}</span>
                        <TrendIndicator value={product.vendasGrowth} showText={false} />
                      </div>
                      {product.previousVendasCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          antes: {product.previousVendasCount}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-green-600">
                          {formatCurrency(product.receitaTotal)}
                        </span>
                      </div>
                      <TrendIndicator value={product.receitaGrowth} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{formatCurrency(product.ticketMedio)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.receitaGrowth > 10 ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Em alta
                        </Badge>
                      ) : product.receitaGrowth < -10 ? (
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          <TrendingDown className="h-3 w-3 mr-1" />
                          Em queda
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground">
                          <Minus className="h-3 w-3 mr-1" />
                          Estável
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewHistory(product.id, product.nome)}
                          title="Ver histórico"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewCustomers(product.id, product.nome)}
                          title="Ver clientes"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
