import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  GitBranch,
  CheckCircle,
  XCircle,
  Edit2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAIWatcher, AIInsight } from "@/hooks/useAIWatcher";
import { Json } from "@/integrations/supabase/types";

interface UnifiedInsightsPanelProps {
  companyId: string | null;
}

interface Funil {
  id: string;
  nome: string;
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

interface Suggestion {
  id: string;
  title: string;
  suggestion_type: string;
  status: string;
  details: Json;
  created_at: string;
  approved: boolean;
}

const typeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  playbook: { label: "Playbook", icon: <Lightbulb className="h-4 w-4" />, color: "bg-blue-500" },
  rotina: { label: "Rotina", icon: <Lightbulb className="h-4 w-4" />, color: "bg-purple-500" },
  etapa: { label: "Etapa", icon: <Lightbulb className="h-4 w-4" />, color: "bg-green-500" },
  melhoria: { label: "Melhoria", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-orange-500" }
};

export function UnifiedInsightsPanel({ companyId }: UnifiedInsightsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [funis, setFunis] = useState<Funil[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState<string>("all");
  const [bottlenecks, setBottlenecks] = useState<Bottleneck[]>([]);
  const [stageMetrics, setStageMetrics] = useState<StageMetrics[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeTab, setActiveTab] = useState("insights");
  
  // Suggestions dialog state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  
  const { toast } = useToast();
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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500';
      default: return 'text-muted-foreground bg-muted/50';
    }
  };

  useEffect(() => {
    if (companyId) {
      loadFunis();
      loadSuggestions();
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
    
    if (data) setFunis(data);
  };

  const loadSuggestions = async () => {
    if (!companyId) return;
    
    const { data } = await supabase
      .from('ai_process_suggestions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    setSuggestions((data || []) as Suggestion[]);
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
        leads: { id: string; etapa_id: string | null; updated_at: string; created_at: string; status: string | null }[];
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

      setStageMetrics(metrics.filter(m => m.leadsCount > 0));
      setBottlenecks(bottlenecksFound);

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

      toast({ title: "Sugestões geradas com sucesso!" });
      loadSuggestions();
      analyzeProcesses();
    } catch (error: any) {
      toast({ title: "Erro ao gerar sugestões", description: error.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApproveSuggestion = async (id: string) => {
    setActionLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ai_process_suggestions')
        .update({ 
          status: 'approved', 
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: userData.user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Sugestão aprovada e aplicada!" });
      loadSuggestions();
    } catch (error: any) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSuggestion = async () => {
    if (!rejectingId) return;
    setActionLoading(true);
    
    try {
      const { error } = await supabase
        .from('ai_process_suggestions')
        .update({ 
          status: 'rejected',
          rejected_reason: rejectReason || null
        })
        .eq('id', rejectingId);

      if (error) throw error;

      toast({ title: "Sugestão rejeitada" });
      setRejectingId(null);
      setRejectReason("");
      loadSuggestions();
    } catch (error: any) {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const processedSuggestions = suggestions.filter(s => s.status !== 'pending');
  const highSeverityInsights = insights.filter(i => i.severity === 'high');

  return (
    <>
      <div className="space-y-6">
        {/* Header com ações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Monitoramento em Tempo Real</span>
            {(unseenCount > 0 || pendingSuggestions.length > 0) && (
              <Badge variant="destructive" className="gap-1">
                {unseenCount + pendingSuggestions.length} pendentes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              onClick={() => { refreshInsights(); loadSuggestions(); }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button 
              onClick={generateSuggestions} 
              disabled={analyzing || (bottlenecks.length === 0 && insights.length === 0)}
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

        {/* Tabs principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="insights" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Insights</span>
              {unseenCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">{unseenCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Sugestões IA</span>
              {pendingSuggestions.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">{pendingSuggestions.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Insights em tempo real */}
          <TabsContent value="insights" className="space-y-4 mt-4">
            {/* Sub-tabs por área */}
            <Tabs defaultValue="all">
              <TabsList className="grid grid-cols-5 w-full h-auto">
                <TabsTrigger value="all" className="gap-1 text-xs sm:text-sm py-2">
                  <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">Todos</span>
                  {insights.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-xs">{insights.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="conversation" className="gap-1 text-xs sm:text-sm py-2">
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Conversas</span>
                </TabsTrigger>
                <TabsTrigger value="agenda" className="gap-1 text-xs sm:text-sm py-2">
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Agenda</span>
                </TabsTrigger>
                <TabsTrigger value="task" className="gap-1 text-xs sm:text-sm py-2">
                  <CheckSquare className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Tarefas</span>
                </TabsTrigger>
                <TabsTrigger value="funnel" className="gap-1 text-xs sm:text-sm py-2">
                  <GitBranch className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden lg:inline">Funil</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <InsightsList 
                  insights={insights} 
                  getSeverityColor={getSeverityColor}
                  getInsightIcon={getInsightIcon}
                  getInsightTypeLabel={getInsightTypeLabel}
                  markAsSeen={markAsSeen}
                />
              </TabsContent>

              <TabsContent value="conversation" className="mt-4">
                <InsightsList 
                  insights={insights.filter(i => i.type === 'conversation')} 
                  getSeverityColor={getSeverityColor}
                  getInsightIcon={getInsightIcon}
                  getInsightTypeLabel={getInsightTypeLabel}
                  markAsSeen={markAsSeen}
                  emptyMessage="Nenhum alerta de conversas. O atendimento está fluindo bem!"
                />
              </TabsContent>

              <TabsContent value="agenda" className="mt-4">
                <InsightsList 
                  insights={insights.filter(i => i.type === 'agenda')} 
                  getSeverityColor={getSeverityColor}
                  getInsightIcon={getInsightIcon}
                  getInsightTypeLabel={getInsightTypeLabel}
                  markAsSeen={markAsSeen}
                  emptyMessage="Nenhum alerta de agenda. Compromissos em dia!"
                />
              </TabsContent>

              <TabsContent value="task" className="mt-4">
                <InsightsList 
                  insights={insights.filter(i => i.type === 'task')} 
                  getSeverityColor={getSeverityColor}
                  getInsightIcon={getInsightIcon}
                  getInsightTypeLabel={getInsightTypeLabel}
                  markAsSeen={markAsSeen}
                  emptyMessage="Nenhum alerta de tarefas. Time produtivo!"
                />
              </TabsContent>

              <TabsContent value="funnel" className="mt-4">
                <div className="space-y-4">
                  {/* Funnel filter */}
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Filtrar:</span>
                    <Select value={selectedFunilId} onValueChange={setSelectedFunilId}>
                      <SelectTrigger className="w-[200px] h-8">
                        <SelectValue placeholder="Todos os Funis" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Funis</SelectItem>
                        {funis.map((funil) => (
                          <SelectItem key={funil.id} value={funil.id}>
                            {funil.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <InsightsList 
                    insights={insights.filter(i => i.type === 'funnel')} 
                    getSeverityColor={getSeverityColor}
                    getInsightIcon={getInsightIcon}
                    getInsightTypeLabel={getInsightTypeLabel}
                    markAsSeen={markAsSeen}
                    emptyMessage="Nenhum gargalo no funil. Leads fluindo bem!"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Call to Action */}
            {highSeverityInsights.length > 0 && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">
                        {highSeverityInsights.length} problema(s) crítico(s) detectado(s)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Gere sugestões da IA para receber recomendações de correção
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Sugestões da IA */}
          <TabsContent value="suggestions" className="space-y-6 mt-4">
            {suggestions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma sugestão pendente</p>
                <p className="text-sm">A IA analisará seus processos e fará sugestões de melhoria</p>
              </div>
            ) : (
              <>
                {/* Pending Suggestions */}
                {pendingSuggestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="destructive">{pendingSuggestions.length}</Badge>
                      Sugestões Pendentes
                    </h3>
                    <div className="grid gap-4">
                      {pendingSuggestions.map((suggestion) => {
                        const typeInfo = typeLabels[suggestion.suggestion_type] || 
                          { label: suggestion.suggestion_type, icon: <Lightbulb className="h-4 w-4" />, color: "bg-gray-500" };
                        const details = suggestion.details as Record<string, any> || {};
                        
                        return (
                          <Card key={suggestion.id} className="border-border/50 border-l-4 border-l-cyan-500">
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-cyan-500/10">
                                    <Brain className="h-5 w-5 text-cyan-500" />
                                  </div>
                                  <div>
                                    <CardTitle className="text-base">{suggestion.title}</CardTitle>
                                    <Badge className={`${typeInfo.color} text-white text-xs mt-1`}>
                                      {typeInfo.label}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              {details.description && (
                                <p className="text-sm text-muted-foreground">{details.description}</p>
                              )}
                              {details.suggestedContent && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                  <p className="text-xs font-medium mb-1">Conteúdo sugerido:</p>
                                  <p className="text-sm">{details.suggestedContent}</p>
                                </div>
                              )}
                              <div className="flex gap-2 pt-2">
                                <Button 
                                  size="sm" 
                                  className="gap-1"
                                  onClick={() => handleApproveSuggestion(suggestion.id)}
                                  disabled={actionLoading}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Aprovar e Aplicar
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => setRejectingId(suggestion.id)}
                                  disabled={actionLoading}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Rejeitar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Processed Suggestions */}
                {processedSuggestions.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-muted-foreground">Histórico</h3>
                    <ScrollArea className="h-[300px]">
                      <div className="grid gap-3 pr-4">
                        {processedSuggestions.map((suggestion) => (
                          <Card key={suggestion.id} className="border-border/50 opacity-60">
                            <CardHeader className="py-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">{suggestion.title}</CardTitle>
                                <Badge variant={suggestion.status === 'approved' ? 'default' : 'secondary'}>
                                  {suggestion.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                                </Badge>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Tab: Métricas do Funil */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            {/* Funnel filter */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Filtrar:</span>
              <Select value={selectedFunilId} onValueChange={setSelectedFunilId}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Todos os Funis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Funis</SelectItem>
                  {funis.map((funil) => (
                    <SelectItem key={funil.id} value={funil.id}>
                      {funil.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stage Metrics */}
            {stageMetrics.length > 0 ? (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Métricas por Etapa
                  </CardTitle>
                  <CardDescription>
                    Análise detalhada de cada etapa do funil
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {stageMetrics.map((metric) => (
                        <div key={metric.etapaId} className="p-3 border border-border/50 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: metric.color }}
                              />
                              <span className="font-medium text-sm">{metric.etapaNome}</span>
                              <Badge variant="outline" className="text-xs">
                                {metric.funilNome}
                              </Badge>
                            </div>
                            <span className="text-sm font-medium">{metric.leadsCount} leads</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3 text-xs">
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

                          <Progress value={metric.conversionRate} className="h-1.5" />
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma métrica disponível</p>
                <p className="text-sm">Adicione leads ao funil para visualizar métricas</p>
              </div>
            )}

            {/* Bottlenecks Summary */}
            {bottlenecks.length > 0 && (
              <Card className="border-orange-500/20 bg-orange-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    Gargalos Detectados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bottlenecks.slice(0, 5).map((bottleneck, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-background">
                        <div className="flex items-center gap-2">
                          {bottleneck.type === 'time' && <Clock className="h-4 w-4 text-yellow-500" />}
                          {bottleneck.type === 'loss' && <TrendingDown className="h-4 w-4 text-red-500" />}
                          {bottleneck.type === 'stuck' && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                          <span className="text-sm">{bottleneck.etapaNome}</span>
                        </div>
                        <Badge className={getSeverityColor(bottleneck.severity)}>
                          {bottleneck.type === 'time' ? `${bottleneck.avgDaysInStage}d` : 
                           bottleneck.type === 'loss' ? `${bottleneck.lossRate.toFixed(0)}%` :
                           `${bottleneck.leadsCount} leads`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Sugestão</DialogTitle>
            <DialogDescription>
              Opcionalmente, informe o motivo da rejeição para ajudar a IA a melhorar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição (opcional)"
              className="min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectingId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleRejectSuggestion} disabled={actionLoading}>
                {actionLoading ? "Rejeitando..." : "Confirmar Rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Subcomponent for insights list
interface InsightsListProps {
  insights: AIInsight[];
  getSeverityColor: (severity: string) => string;
  getInsightIcon: (type: string) => React.ReactNode;
  getInsightTypeLabel: (type: string) => string;
  markAsSeen: (id: string) => void;
  emptyMessage?: string;
}

function InsightsList({ 
  insights, 
  getSeverityColor, 
  getInsightIcon,
  getInsightTypeLabel,
  markAsSeen,
  emptyMessage = "Nenhum alerta encontrado. Tudo funcionando bem!"
}: InsightsListProps) {
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
        <CheckCircle2 className="h-5 w-5 text-green-500" />
        <div>
          <p className="font-medium text-green-700 dark:text-green-400">Tudo em ordem!</p>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="grid gap-3 pr-4">
        {insights.map((insight) => (
          <div 
            key={insight.id}
            className={`flex items-start justify-between p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${getSeverityColor(insight.severity)} ${!insight.seen ? 'ring-2 ring-primary/20' : ''}`}
            onClick={() => markAsSeen(insight.id)}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-background flex-shrink-0">
                {getInsightIcon(insight.type)}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{insight.title}</p>
                  <Badge variant="outline" className="text-xs">
                    {getInsightTypeLabel(insight.type)}
                  </Badge>
                  {!insight.seen && (
                    <Badge variant="default" className="text-xs bg-primary">Novo</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{insight.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(insight.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={getSeverityColor(insight.severity)}>
              {insight.severity === 'high' ? 'Crítico' : insight.severity === 'medium' ? 'Médio' : 'Baixo'}
            </Badge>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
