import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Megaphone, MousePointerClick, Users, TrendingUp, DollarSign, Target } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Doughnut, Bar } from "react-chartjs-2";

interface CampaignStats {
  totalLeadsPagos: number;
  leadsLeadAds: number;
  leadsCTWA: number;
  leadsOrganicos: number;
  taxaConversaoPago: number;
  valorGeradoPorAds: number;
  leadsPorCampanha: {
    campanha: string;
    origem: string;
    total: number;
    qualificados: number;
    convertidos: number;
    valor: number;
  }[];
  leadsPorOrigem: { origem: string; total: number }[];
}

interface CampaignAnalyticsProps {
  userCompanyId: string | null;
  globalFilters: {
    period: string;
  };
}

export default function CampaignAnalytics({ userCompanyId, globalFilters }: CampaignAnalyticsProps) {
  const [stats, setStats] = useState<CampaignStats>({
    totalLeadsPagos: 0,
    leadsLeadAds: 0,
    leadsCTWA: 0,
    leadsOrganicos: 0,
    taxaConversaoPago: 0,
    valorGeradoPorAds: 0,
    leadsPorCampanha: [],
    leadsPorOrigem: []
  });
  const [loading, setLoading] = useState(true);

  const fetchCampaignStats = useCallback(async () => {
    if (!userCompanyId) return;
    
    try {
      setLoading(true);
      
      let query = supabase
        .from('leads')
        .select('id, lead_source_type, utm_source, utm_campaign, utm_medium, ad_creative_name, status, value, tags, created_at')
        .eq('company_id', userCompanyId);

      // Aplicar filtros de período
      if (globalFilters.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        
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
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: leadsData, error } = await query;

      if (error) {
        console.error('[CampaignAnalytics] Erro ao buscar leads:', error);
        return;
      }

      const leads = leadsData || [];
      
      // Classificar leads
      const leadsPagos = leads.filter(l => l.lead_source_type);
      const leadsLeadAds = leads.filter(l => l.lead_source_type === 'leadgen');
      const leadsCTWA = leads.filter(l => l.lead_source_type === 'ctwa');
      const leadsOrganicos = leads.filter(l => !l.lead_source_type);

      // Calcular conversões
      const leadsPagosGanhos = leadsPagos.filter(l => l.status === 'ganho');
      const taxaConversaoPago = leadsPagos.length > 0 
        ? (leadsPagosGanhos.length / leadsPagos.length) * 100 
        : 0;
      
      const valorGeradoPorAds = leadsPagosGanhos.reduce((sum, l) => sum + (l.value || 0), 0);

      // Agrupar por campanha
      const campanhasMap = new Map<string, {
        origem: string;
        total: number;
        qualificados: number;
        convertidos: number;
        valor: number;
      }>();

      leadsPagos.forEach(lead => {
        const campanha = lead.utm_campaign || lead.ad_creative_name || 'Sem campanha';
        const origem = lead.lead_source_type === 'leadgen' ? 'Lead Ads' : 'Click-to-WhatsApp';
        
        if (!campanhasMap.has(campanha)) {
          campanhasMap.set(campanha, { origem, total: 0, qualificados: 0, convertidos: 0, valor: 0 });
        }
        
        const stats = campanhasMap.get(campanha)!;
        stats.total++;
        
        if (lead.tags?.includes('Qualificado')) {
          stats.qualificados++;
        }
        
        if (lead.status === 'ganho') {
          stats.convertidos++;
          stats.valor += lead.value || 0;
        }
      });

      const leadsPorCampanha = Array.from(campanhasMap.entries())
        .map(([campanha, data]) => ({ campanha, ...data }))
        .sort((a, b) => b.total - a.total);

      setStats({
        totalLeadsPagos: leadsPagos.length,
        leadsLeadAds: leadsLeadAds.length,
        leadsCTWA: leadsCTWA.length,
        leadsOrganicos: leadsOrganicos.length,
        taxaConversaoPago: Math.round(taxaConversaoPago * 10) / 10,
        valorGeradoPorAds,
        leadsPorCampanha,
        leadsPorOrigem: [
          { origem: 'Lead Ads', total: leadsLeadAds.length },
          { origem: 'Click-to-WhatsApp', total: leadsCTWA.length },
          { origem: 'Orgânico', total: leadsOrganicos.length }
        ]
      });
    } catch (error) {
      console.error('[CampaignAnalytics] Erro:', error);
    } finally {
      setLoading(false);
    }
  }, [userCompanyId, globalFilters]);

  useEffect(() => {
    fetchCampaignStats();
  }, [fetchCampaignStats]);

  // Dados para gráfico de pizza
  const doughnutData = {
    labels: ['Lead Ads', 'Click-to-WhatsApp', 'Orgânico'],
    datasets: [{
      data: [stats.leadsLeadAds, stats.leadsCTWA, stats.leadsOrganicos],
      backgroundColor: [
        'hsl(217, 91%, 60%)',
        'hsl(142, 71%, 45%)',
        'hsl(45, 93%, 47%)'
      ],
      borderWidth: 0
    }]
  };

  // Dados para gráfico de barras
  const barData = {
    labels: stats.leadsPorCampanha.slice(0, 8).map(c => 
      c.campanha.length > 15 ? c.campanha.substring(0, 15) + '...' : c.campanha
    ),
    datasets: [{
      label: 'Leads',
      data: stats.leadsPorCampanha.slice(0, 8).map(c => c.total),
      backgroundColor: 'hsl(217, 91%, 60%)',
      borderRadius: 6
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lead Ads
            </CardTitle>
            <Megaphone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leadsLeadAds}</div>
            <p className="text-xs text-muted-foreground">Formulários Meta</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Click-to-WhatsApp
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leadsCTWA}</div>
            <p className="text-xs text-muted-foreground">Anúncios CTWA</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa Conversão Pago
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.taxaConversaoPago}%</div>
            <p className="text-xs text-muted-foreground">Leads pagos convertidos</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor Gerado
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.valorGeradoPorAds)}</div>
            <p className="text-xs text-muted-foreground">De tráfego pago</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" />
              Distribuição por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              {stats.totalLeadsPagos > 0 || stats.leadsOrganicos > 0 ? (
                <Doughnut data={doughnutData} options={{
                  ...chartOptions,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'bottom' as const
                    }
                  }
                }} />
              ) : (
                <p className="text-muted-foreground">Nenhum dado disponível</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              Leads por Campanha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {stats.leadsPorCampanha.length > 0 ? (
                <Bar data={barData} options={chartOptions} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-muted-foreground">Nenhuma campanha registrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Campanhas */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            Detalhamento por Campanha
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.leadsPorCampanha.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead className="text-center">Qualificados</TableHead>
                  <TableHead className="text-center">Convertidos</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Taxa Conv.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.leadsPorCampanha.map((campanha, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {campanha.campanha}
                    </TableCell>
                    <TableCell>
                      <Badge variant={campanha.origem === 'Lead Ads' ? 'default' : 'secondary'}>
                        {campanha.origem}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{campanha.total}</TableCell>
                    <TableCell className="text-center">{campanha.qualificados}</TableCell>
                    <TableCell className="text-center">{campanha.convertidos}</TableCell>
                    <TableCell className="text-right">{formatCurrency(campanha.valor)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={campanha.convertidos > 0 ? 'default' : 'secondary'}>
                        {campanha.total > 0 
                          ? `${Math.round((campanha.convertidos / campanha.total) * 100)}%`
                          : '0%'
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum lead de campanha encontrado</p>
              <p className="text-sm mt-1">Os leads vindos de anúncios aparecerão aqui</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
