import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  AlertTriangle, 
  Filter, 
  BarChart3, 
  TrendingDown, 
  Clock, 
  Target,
  Brain,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  Lightbulb,
  MessageSquare,
  Calendar,
  CheckSquare,
  GitBranch
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { useAIWatcher, AIInsight } from "@/hooks/useAIWatcher";

interface ProcessInsightsReportProps {
  companyId: string | null;
  onSuggestionsGenerated?: () => void;
}

interface Funil {
  id: string;
  nome: string;
}

interface Etapa {
  id: string;
  nome: string;
  cor: string | null;
  posicao: number | null;
  funil_id: string;
}

interface Lead {
  id: string;
  etapa_id: string | null;
  funil_id: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
}

interface Bottleneck {
  etapaId: string;
  etapaNome: string;
  funilNome: string;
  leadsCount: number;
  avgDaysInStage: number;
  lossRate: number;
  severity: 'high' | 'medium' | 'low';
  type: 'time' | 'loss' | 'stuck';
}

interface StageMetrics {
  etapaId: string;
  etapaNome: string;
  funilNome: string;
  leadsCount: number;
  avgDaysInStage: number;
  lossRate: number;
  conversionRate: number;
  color: string;
}

export function ProcessInsightsReport({ companyId, onSuggestionsGenerated }: ProcessInsightsReportProps) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState<string>("all");
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [stageMetrics, setStageMetrics] = useState<StageMetrics[]>([]);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const [activeTab, setActiveTab] = useState("funnel");
  const { toast } = useToast();
  
  // Real-time AI monitoring
  const { insights, unseenCount, refresh: refreshInsights, markAsSeen } = useAIWatcher();
  
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'conversation': return <MessageSquare className="h-4 w-4" />;
      case 'agenda': return <Calendar className="h-4 w-4" />;
      case 'task': return <CheckSquare className="h-4 w-4" />;
      case 'funnel': return <GitBranch className="h-4 w-4" />;
      default: return <Brain className="h-4 w-4" />;
    }
  };
  
  const getInsightTypeLabel = (type: string) => {
    switch (type) {
      case 'conversation': return 'Conversas';
      case 'agenda': return 'Agenda';
      case 'task': return 'Tarefas';
      case 'funnel': return 'Funil';
      default: return 'Geral';
    }
  };

  useEffect(() => {
    if (companyId) {
      loadFunis();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) {
      analyzeProcesses();
    }
  }, [selectedFunilId, companyId]);

  const loadFunis = async () => {
    if (!companyId) return;
    
    const { data } = await supabase
      .from('funis')
      .select('id, nome')
      .eq('company_id', companyId)
      .order('nome');
    
    if (data) {
      setFunis(data);
    }
  };

  const analyzeProcesses = async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const isAllFunis = selectedFunilId === "all";

      // Buscar etapas
      let etapasQuery = supabase
        .from('etapas')
        .select('id, nome, cor, posicao, funil_id')
        .eq('company_id', companyId)
        .order('posicao');

      if (!isAllFunis) {
        etapasQuery = etapasQuery.eq('funil_id', selectedFunilId);
      }

      const { data: etapasData } = await etapasQuery;

      // Buscar leads
      let leadsQuery = supabase
        .from('leads')
        .select('id, etapa_id, funil_id, created_at, updated_at, status')
        .eq('company_id', companyId);

      if (!isAllFunis) {
        leadsQuery = leadsQuery.eq('funil_id', selectedFunilId);
      }

      const { data: leadsData } = await leadsQuery;

      // Buscar nomes dos funis
      const funisMap: Record<string, string> = {};
      funis.forEach(f => funisMap[f.id] = f.nome);

      // Calcular métricas por etapa
      const now = new Date();
      const metricsMap: Record<string, {
        leads: Lead[];
        lostLeads: number;
      }> = {};

      etapasData?.forEach(etapa => {
        metricsMap[etapa.id] = { leads: [], lostLeads: 0 };
      });

      leadsData?.forEach(lead => {
        if (lead.etapa_id && metricsMap[lead.etapa_id]) {
          metricsMap[lead.etapa_id].leads.push(lead);
          if (lead.status === 'lost' || lead.status === 'perdido') {
            metricsMap[lead.etapa_id].lostLeads++;
          }
        }
      });

      const stageColors = [
        '#3b82f6', '#22c55e', '#eab308', '#a855f7', 
        '#f97316', '#06b6d4', '#ec4899', '#6366f1'
      ];

      // Calcular métricas detalhadas
      const metrics: StageMetrics[] = [];
      const bottlenecksFound: Bottleneck[] = [];

      etapasData?.forEach((etapa, index) => {
        const stageData = metricsMap[etapa.id];
        const leadsCount = stageData.leads.length;
        const totalLeads = leadsData?.length || 1;

        // Calcular tempo médio na etapa
        let totalDays = 0;
        stageData.leads.forEach(lead => {
          const createdAt = new Date(lead.updated_at || lead.created_at);
          const daysDiff = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
          totalDays += daysDiff;
        });
        const avgDaysInStage = leadsCount > 0 ? Math.round(totalDays / leadsCount) : 0;

        // Taxa de perda
        const lossRate = leadsCount > 0 ? (stageData.lostLeads / leadsCount) * 100 : 0;

        // Taxa de conversão (leads que passaram para próxima etapa)
        const conversionRate = totalLeads > 0 ? (leadsCount / totalLeads) * 100 : 0;

        const funilNome = funisMap[etapa.funil_id] || 'Funil';

        metrics.push({
          etapaId: etapa.id,
          etapaNome: etapa.nome,
          funilNome,
          leadsCount,
          avgDaysInStage,
          lossRate,
          conversionRate,
          color: etapa.cor || stageColors[index % stageColors.length]
        });

        // Identificar gargalos
        if (avgDaysInStage > 7 && leadsCount > 3) {
          bottlenecksFound.push({
            etapaId: etapa.id,
            etapaNome: etapa.nome,
            funilNome,
            leadsCount,
            avgDaysInStage,
            lossRate,
            severity: avgDaysInStage > 14 ? 'high' : avgDaysInStage > 7 ? 'medium' : 'low',
            type: 'time'
          });
        }

        if (lossRate > 30 && leadsCount > 2) {
          bottlenecksFound.push({
            etapaId: etapa.id,
            etapaNome: etapa.nome,
            funilNome,
            leadsCount,
            avgDaysInStage,
            lossRate,
            severity: lossRate > 50 ? 'high' : lossRate > 30 ? 'medium' : 'low',
            type: 'loss'
          });
        }

        // Leads parados (muitos leads acumulados)
        if (leadsCount > 10 && conversionRate > 40) {
          bottlenecksFound.push({
            etapaId: etapa.id,
            etapaNome: etapa.nome,
            funilNome,
            leadsCount,
            avgDaysInStage,
            lossRate,
            severity: leadsCount > 20 ? 'high' : 'medium',
            type: 'stuck'
          });
        }
      });

      // Buscar sugestões pendentes
      const { count } = await supabase
        .from('ai_process_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('status', 'pending');

      setStageMetrics(metrics.filter(m => m.leadsCount > 0));
      setBottlenecks(bottlenecksFound);
      setPendingSuggestions(count || 0);

    } catch (error) {
      console.error('Erro ao analisar processos:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSuggestions = async () => {
    if (!companyId) return;
    setAnalyzing(true);

    try {
      // Gerar sugestões baseadas nos gargalos encontrados
      for (const bottleneck of bottlenecks) {
        let title = '';
        let description = '';
        let suggestionType = 'melhoria';

        if (bottleneck.type === 'time') {
          title = `Otimizar tempo na etapa "${bottleneck.etapaNome}"`;
          description = `Leads estão ficando em média ${bottleneck.avgDaysInStage} dias nesta etapa. Considere criar uma rotina de follow-up mais frequente ou revisar os critérios de passagem para a próxima etapa.`;
        } else if (bottleneck.type === 'loss') {
          title = `Reduzir perda de leads na etapa "${bottleneck.etapaNome}"`;
          description = `Taxa de perda de ${bottleneck.lossRate.toFixed(1)}% nesta etapa. Revise o processo de qualificação e considere criar um playbook específico para recuperação de leads.`;
          suggestionType = 'playbook';
        } else if (bottleneck.type === 'stuck') {
          title = `Descongestionar etapa "${bottleneck.etapaNome}"`;
          description = `${bottleneck.leadsCount} leads acumulados nesta etapa. Considere adicionar mais recursos ou criar uma rotina de priorização.`;
          suggestionType = 'rotina';
        }

        // Verificar se sugestão similar já existe
        const { data: existing } = await supabase
          .from('ai_process_suggestions')
          .select('id')
          .eq('company_id', companyId)
          .eq('title', title)
          .eq('status', 'pending')
          .single();

        if (!existing) {
          await supabase.from('ai_process_suggestions').insert({
            company_id: companyId,
            title,
            suggestion_type: suggestionType,
            status: 'pending',
            details: {
              description,
              bottleneck: {
                etapaId: bottleneck.etapaId,
                etapaNome: bottleneck.etapaNome,
                funilNome: bottleneck.funilNome,
                severity: bottleneck.severity,
                metrics: {
                  leadsCount: bottleneck.leadsCount,
                  avgDaysInStage: bottleneck.avgDaysInStage,
                  lossRate: bottleneck.lossRate
                }
              },
              generatedBy: 'process_insights'
            }
          });
        }
      }

      toast({ title: "Sugestões geradas com sucesso!", description: "Acesse a aba 'Sugestões da IA' para revisar" });
      onSuggestionsGenerated?.();
      analyzeProcesses();
    } catch (error: any) {
      toast({ title: "Erro ao gerar sugestões", description: error.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  const getBottleneckIcon = (type: string) => {
    switch (type) {
      case 'time': return <Clock className="h-4 w-4" />;
      case 'loss': return <TrendingDown className="h-4 w-4" />;
      case 'stuck': return <AlertTriangle className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getBottleneckLabel = (type: string) => {
    switch (type) {
      case 'time': return 'Tempo Elevado';
      case 'loss': return 'Alta Perda';
      case 'stuck': return 'Congestionado';
      default: return 'Alerta';
    }
  };

  if (funis.length === 0 && !loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum funil encontrado</p>
        <p className="text-sm">Crie um funil para visualizar insights de processos</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com filtro e ações */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">Filtrar por Funil:</span>
          <Select value={selectedFunilId} onValueChange={setSelectedFunilId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todos os Funis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Todos os Funis
                </div>
              </SelectItem>
              {funis.map((funil) => (
                <SelectItem key={funil.id} value={funil.id}>
                  {funil.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {pendingSuggestions > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Brain className="h-3 w-3" />
              {pendingSuggestions} sugestões pendentes
            </Badge>
          )}
          <Button 
            onClick={generateSuggestions} 
            disabled={analyzing || bottlenecks.length === 0}
            size="sm"
            className="gap-2"
          >
            {analyzing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                Gerar Sugestões IA
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p>Analisando processos...</p>
        </div>
      ) : (
        <>
          {/* Gargalos Identificados */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Gargalos Identificados
              </CardTitle>
              <CardDescription>
                Pontos críticos que precisam de atenção no seu processo comercial
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bottlenecks.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-400">Nenhum gargalo crítico encontrado</p>
                    <p className="text-sm text-muted-foreground">Seus processos estão funcionando bem!</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  {bottlenecks.map((bottleneck, index) => (
                    <div 
                      key={`${bottleneck.etapaId}-${bottleneck.type}-${index}`}
                      className={`flex items-center justify-between p-4 rounded-lg border ${getSeverityColor(bottleneck.severity)}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-background">
                          {getBottleneckIcon(bottleneck.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{bottleneck.etapaNome}</p>
                            <Badge variant="outline" className="text-xs">
                              {bottleneck.funilNome}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {bottleneck.type === 'time' && `${bottleneck.avgDaysInStage} dias em média`}
                            {bottleneck.type === 'loss' && `${bottleneck.lossRate.toFixed(1)}% de perda`}
                            {bottleneck.type === 'stuck' && `${bottleneck.leadsCount} leads acumulados`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={getSeverityColor(bottleneck.severity)}>
                        {getBottleneckLabel(bottleneck.type)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Métricas por Etapa */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                Análise por Etapa
              </CardTitle>
              <CardDescription>
                Métricas detalhadas de cada etapa do funil
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stageMetrics.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhuma etapa com leads encontrada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stageMetrics.map((metric) => (
                    <div key={metric.etapaId} className="p-4 border border-border/50 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: metric.color }}
                          />
                          <span className="font-medium">{metric.etapaNome}</span>
                          <Badge variant="outline" className="text-xs">
                            {metric.funilNome}
                          </Badge>
                        </div>
                        <span className="text-sm font-medium">{metric.leadsCount} leads</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Tempo Médio</p>
                          <p className="font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {metric.avgDaysInStage} dias
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Taxa de Perda</p>
                          <p className={`font-medium flex items-center gap-1 ${metric.lossRate > 30 ? 'text-red-500' : ''}`}>
                            <TrendingDown className="h-3 w-3" />
                            {metric.lossRate.toFixed(1)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Distribuição</p>
                          <p className="font-medium">
                            {metric.conversionRate.toFixed(1)}%
                          </p>
                        </div>
                      </div>

                      <Progress 
                        value={metric.conversionRate} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call to Action para aba IA */}
          {bottlenecks.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Lightbulb className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Melhore seus processos com IA</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Gerar Sugestões IA" para criar recomendações automáticas baseadas nos gargalos encontrados
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
