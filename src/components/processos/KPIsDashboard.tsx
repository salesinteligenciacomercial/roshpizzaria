import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, Target, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KPIsDashboardProps {
  companyId: string | null;
}

interface KPIs {
  totalLeads: number;
  leadsThisMonth: number;
  conversionRate: number;
  avgTimeInFunnel: number;
  leadsByStage: { stage: string; count: number }[];
}

export function KPIsDashboard({ companyId }: KPIsDashboardProps) {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) loadKPIs();
  }, [companyId]);

  const loadKPIs = async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      // Total leads
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      // Leads this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: leadsThisMonth } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .gte('created_at', startOfMonth.toISOString());

      // Leads by stage
      const { data: stageData } = await supabase
        .from('leads')
        .select('stage')
        .eq('company_id', companyId);

      const stageCounts: Record<string, number> = {};
      stageData?.forEach(lead => {
        const stage = lead.stage || 'Sem etapa';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });

      const leadsByStage = Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        count
      }));

      // Conversion rate (leads that reached 'fechamento' stage)
      const { count: convertedLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('stage', 'fechamento');

      const conversionRate = totalLeads ? ((convertedLeads || 0) / totalLeads) * 100 : 0;

      setKpis({
        totalLeads: totalLeads || 0,
        leadsThisMonth: leadsThisMonth || 0,
        conversionRate,
        avgTimeInFunnel: 0, // Would need more complex calculation
        leadsByStage
      });
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p>Carregando KPIs...</p>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Sem dados suficientes</p>
        <p className="text-sm">Adicione leads para visualizar os KPIs</p>
      </div>
    );
  }

  const stageColors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 
    'bg-orange-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500'
  ];

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total de Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.totalLeads}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              Leads este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-500">{kpis.leadsThisMonth}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.conversionRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo Médio no Funil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">Em desenvolvimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Leads by Stage */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Leads por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          {kpis.leadsByStage.length > 0 ? (
            <div className="space-y-3">
              {kpis.leadsByStage.map((item, index) => {
                const percentage = kpis.totalLeads ? (item.count / kpis.totalLeads) * 100 : 0;
                return (
                  <div key={item.stage} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{item.stage}</span>
                      <span className="text-muted-foreground">{item.count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${stageColors[index % stageColors.length]} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">Nenhum lead encontrado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
