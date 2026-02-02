import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, MousePointerClick, TrendingUp, DollarSign, Eye, Target, Users, Building2, RefreshCw, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CampaignEmptyState from "./CampaignEmptyState";
import LeadsBySourceSection from "./LeadsBySourceSection";

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  cpc: number;
  ctr: number;
  leads: number;
  messages: number;
}

interface MetaAdset {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
}

interface MetaAd {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
}

interface MetaInsightsResponse {
  account_info: {
    id: string;
    name: string;
    currency: string;
    status: number;
    business_name: string;
    business_id: string | null;
  };
  campaigns: MetaCampaign[];
  adsets: MetaAdset[];
  ads: MetaAd[];
  summary: {
    total_spend: number;
    total_impressions: number;
    total_clicks: number;
    total_reach: number;
    total_leads: number;
    total_messages: number;
    active_campaigns: number;
    paused_campaigns: number;
    cpl: number;
    ctr: number;
  };
  date_preset: string;
  fetched_at: string;
}

interface CampaignAnalyticsProps {
  userCompanyId: string | null;
  globalFilters: {
    period: string;
  };
}

const DATE_PRESETS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_14d', label: 'Últimos 14 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'last_90d', label: 'Últimos 90 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'this_year', label: 'Este ano' },
  { value: 'lifetime', label: 'Todo o histórico' },
];
export default function CampaignAnalytics({ userCompanyId }: CampaignAnalyticsProps) {
  const [metaData, setMetaData] = useState<MetaInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState('last_30d');
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());

  const fetchMetaInsights = useCallback(async () => {
    if (!userCompanyId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessão não encontrada');
        return;
      }

      // Call edge function with query params
      const funcUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-marketing-insights?company_id=${userCompanyId}&date_preset=${datePreset}`;
      
      const fetchResponse = await fetch(funcUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await fetchResponse.json();

      if (!fetchResponse.ok) {
        setError(data.details || data.error || 'Erro ao buscar dados do Meta');
        return;
      }

      setMetaData(data);
      console.log('[CampaignAnalytics] Meta data fetched:', data);
    } catch (err) {
      console.error('[CampaignAnalytics] Error:', err);
      setError('Erro ao conectar com a API do Meta');
    } finally {
      setLoading(false);
    }
  }, [userCompanyId, datePreset]);

  useEffect(() => {
    fetchMetaInsights();
  }, [fetchMetaInsights]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'ACTIVE': { label: 'Ativo', variant: 'default' },
      'PAUSED': { label: 'Pausado', variant: 'secondary' },
      'DELETED': { label: 'Deletado', variant: 'destructive' },
      'ARCHIVED': { label: 'Arquivado', variant: 'outline' }
    };
    const config = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getObjectiveLabel = (objective: string) => {
    const objectiveMap: Record<string, string> = {
      'OUTCOME_LEADS': 'Geração de Leads',
      'OUTCOME_ENGAGEMENT': 'Engajamento',
      'OUTCOME_AWARENESS': 'Reconhecimento',
      'OUTCOME_TRAFFIC': 'Tráfego',
      'OUTCOME_SALES': 'Vendas',
      'LEAD_GENERATION': 'Lead Ads',
      'MESSAGES': 'Mensagens',
      'CONVERSIONS': 'Conversões',
      'LINK_CLICKS': 'Cliques no Link'
    };
    return objectiveMap[objective] || objective;
  };

  const toggleCampaignExpand = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    const isTokenError = error.includes('OAuth') || error.includes('access token') || error.includes('190');
    
    return (
      <div className="space-y-6">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-destructive/70 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {isTokenError ? 'Token de Acesso Inválido' : 'Não foi possível carregar dados do Meta Ads'}
              </h3>
              <p className="text-muted-foreground mb-4 max-w-lg">
                {isTokenError 
                  ? 'O Access Token do Meta Ads configurado expirou ou está incorreto. É necessário gerar um novo token com as permissões corretas.'
                  : error
                }
              </p>
              
              {isTokenError && (
                <div className="bg-muted/50 rounded-lg p-4 mb-4 text-left max-w-lg">
                  <p className="font-medium mb-2">Como obter um token válido:</p>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Acesse o <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Graph API Explorer</a></li>
                    <li>Selecione seu App e obtenha um token de usuário</li>
                    <li>Adicione as permissões: <code className="bg-background px-1 rounded">ads_read</code>, <code className="bg-background px-1 rounded">ads_management</code></li>
                    <li>Copie o token gerado (começa com "EA...")</li>
                    <li>Vá em <strong>Integrações → Marketing</strong> e atualize o token</li>
                  </ol>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button onClick={fetchMetaInsights} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                {isTokenError && (
                  <Button variant="default" onClick={() => window.location.href = '/integracoes'}>
                    Configurar Token
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!metaData) {
    return null;
  }

  const { account_info, campaigns, adsets, ads, summary } = metaData;

  return (
    <div className="space-y-6">
      {/* Header com Info da Conta e Filtros */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{account_info.name}</h3>
            <p className="text-sm text-muted-foreground">
              {account_info.business_name} • {account_info.currency}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map(preset => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchMetaInsights}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gasto Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.total_spend)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.active_campaigns} campanhas ativas
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Impressões
            </CardTitle>
            <Eye className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.total_impressions)}</div>
            <p className="text-xs text-muted-foreground">
              Alcance: {formatNumber(summary.total_reach)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cliques
            </CardTitle>
            <MousePointerClick className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(summary.total_clicks)}</div>
            <p className="text-xs text-muted-foreground">
              CTR: {summary.ctr.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              CPL (Custo/Lead)
            </CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.cpl)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.total_leads + summary.total_messages} leads gerados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Campanhas */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4 text-primary" />
            Campanhas ({campaigns.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <div className="space-y-2">
              {campaigns.map((campaign) => {
                const campaignAdsets = adsets.filter(a => a.campaign_id === campaign.id);
                const isExpanded = expandedCampaigns.has(campaign.id);

                return (
                  <Collapsible key={campaign.id} open={isExpanded} onOpenChange={() => toggleCampaignExpand(campaign.id)}>
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                          <div className="flex items-center gap-3">
                            {campaignAdsets.length > 0 ? (
                              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                            ) : (
                              <div className="w-4" />
                            )}
                            <div>
                              <p className="font-medium">{campaign.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(campaign.status)}
                                <span className="text-xs text-muted-foreground">
                                  {getObjectiveLabel(campaign.objective)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-right">
                              <p className="font-semibold">{formatCurrency(campaign.spend)}</p>
                              <p className="text-xs text-muted-foreground">Gasto</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatNumber(campaign.impressions)}</p>
                              <p className="text-xs text-muted-foreground">Impressões</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{formatNumber(campaign.clicks)}</p>
                              <p className="text-xs text-muted-foreground">Cliques</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{campaign.ctr.toFixed(2)}%</p>
                              <p className="text-xs text-muted-foreground">CTR</p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold">{campaign.leads + campaign.messages}</p>
                              <p className="text-xs text-muted-foreground">Leads</p>
                            </div>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        {campaignAdsets.length > 0 && (
                          <div className="border-t bg-muted/30">
                            {campaignAdsets.map((adset) => {
                              const adsetAds = ads.filter(a => a.adset_id === adset.id);
                              
                              return (
                                <div key={adset.id} className="border-b last:border-b-0">
                                  <div className="flex items-center justify-between p-3 pl-12">
                                    <div className="flex items-center gap-2">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <p className="font-medium text-sm">{adset.name}</p>
                                        {getStatusBadge(adset.status)}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                      <div className="text-right">
                                        <p className="font-medium">{formatCurrency(adset.spend)}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">{formatNumber(adset.impressions)}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">{formatNumber(adset.clicks)}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">{adset.ctr.toFixed(2)}%</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-medium">{adset.leads}</p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Anúncios */}
                                  {adsetAds.length > 0 && (
                                    <div className="bg-background/50">
                                      {adsetAds.map((ad) => (
                                        <div key={ad.id} className="flex items-center justify-between p-2 pl-20 text-sm border-t border-dashed">
                                          <div className="flex items-center gap-2">
                                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-muted-foreground">{ad.name}</span>
                                            {getStatusBadge(ad.status)}
                                          </div>
                                          <div className="flex items-center gap-6">
                                            <span>{formatCurrency(ad.spend)}</span>
                                            <span>{formatNumber(ad.impressions)}</span>
                                            <span>{formatNumber(ad.clicks)}</span>
                                            <span>{ad.ctr.toFixed(2)}%</span>
                                            <span>{ad.leads}</span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          ) : (
            <CampaignEmptyState accountName={account_info.name} />
          )}
        </CardContent>
      </Card>

      {/* Seção de Leads por Origem - sempre visível */}
      <LeadsBySourceSection companyId={userCompanyId} />

      {/* Última atualização */}
      <p className="text-xs text-muted-foreground text-center">
        Última atualização: {new Date(metaData.fetched_at).toLocaleString('pt-BR')}
      </p>
    </div>
  );
}
