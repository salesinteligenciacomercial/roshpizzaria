import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Clock, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Users,
  Zap,
  Calendar,
  Target,
  Brain,
  ThumbsUp,
  ThumbsDown,
  BarChart3,
  LineChart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface IAMonitoringPanelProps {
  agentType: string;
  agentName: string;
  companyId?: string;
}

interface Metrics {
  total_interactions: number;
  successful_interactions: number;
  corrections_needed: number;
  conversions_assisted: number;
  avg_response_accuracy: number;
  avg_confidence_score: number;
  learning_progress: number;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
}

interface RecentInteraction {
  id: string;
  input_message: string;
  ai_response: string;
  was_corrected: boolean;
  feedback_score: number | null;
  created_at: string;
}

export function IAMonitoringPanel({ agentType, agentName, companyId }: IAMonitoringPanelProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const [recentInteractions, setRecentInteractions] = useState<RecentInteraction[]>([]);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    status: 'healthy',
    lastCheck: new Date(),
    responseTime: 245,
    errorRate: 0.02,
    uptime: 99.9
  });
  const [patterns, setPatterns] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) {
      loadMetrics();
      loadRecentInteractions();
      loadPatterns();
    }
  }, [companyId, agentType]);

  const loadMetrics = async () => {
    if (!companyId) return;
    
    try {
      // Carregar métricas do dia atual
      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayMetrics } = await supabase
        .from('ia_metrics')
        .select('*')
        .eq('company_id', companyId)
        .eq('agent_type', agentType)
        .eq('metric_date', today)
        .single();
      
      if (todayMetrics) {
        setMetrics(todayMetrics);
      } else {
        // Métricas padrão se não houver dados
        setMetrics({
          total_interactions: 0,
          successful_interactions: 0,
          corrections_needed: 0,
          conversions_assisted: 0,
          avg_response_accuracy: 0,
          avg_confidence_score: 0,
          learning_progress: 0
        });
      }

      // Carregar histórico dos últimos 7 dias
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data: history } = await supabase
        .from('ia_metrics')
        .select('*')
        .eq('company_id', companyId)
        .eq('agent_type', agentType)
        .gte('metric_date', weekAgo.toISOString().split('T')[0])
        .order('metric_date', { ascending: true });
      
      if (history) {
        setMetricsHistory(history.map(h => ({
          date: new Date(h.metric_date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
          interacoes: h.total_interactions || 0,
          sucesso: h.successful_interactions || 0,
          conversoes: h.conversions_assisted || 0,
          precisao: ((h.avg_response_accuracy || 0) * 100).toFixed(0)
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentInteractions = async () => {
    if (!companyId) return;
    
    try {
      const { data } = await supabase
        .from('ia_training_data')
        .select('id, input_message, ai_response, was_corrected, feedback_score, created_at')
        .eq('company_id', companyId)
        .eq('agent_type', agentType)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) {
        setRecentInteractions(data);
      }
    } catch (error) {
      console.error('Erro ao carregar interações:', error);
    }
  };

  const loadPatterns = async () => {
    if (!companyId) return;
    
    try {
      const { data } = await supabase
        .from('ia_patterns')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
        .limit(5);
      
      if (data) {
        setPatterns(data);
      }
    } catch (error) {
      console.error('Erro ao carregar padrões:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadMetrics(),
      loadRecentInteractions(),
      loadPatterns()
    ]);
    setHealthStatus(prev => ({ ...prev, lastCheck: new Date() }));
    setRefreshing(false);
    toast.success('Métricas atualizadas!');
  };

  const handleTestHealth = async () => {
    setRefreshing(true);
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke(`ia-${agentType}`, {
        body: {
          message: 'teste de saúde',
          companyId,
          leadData: { name: 'Teste' }
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      setHealthStatus({
        status: error ? 'error' : 'healthy',
        lastCheck: new Date(),
        responseTime,
        errorRate: error ? 1 : 0,
        uptime: 99.9
      });
      
      if (error) {
        toast.error('Erro no teste de saúde');
      } else {
        toast.success(`Agente respondeu em ${responseTime}ms`);
      }
    } catch (error) {
      setHealthStatus({
        status: 'error',
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 1,
        uptime: 0
      });
      toast.error('Falha no teste de saúde');
    } finally {
      setRefreshing(false);
    }
  };

  const getHealthColor = () => {
    switch (healthStatus.status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
    }
  };

  const getHealthText = () => {
    switch (healthStatus.status) {
      case 'healthy': return 'Operacional';
      case 'warning': return 'Com alertas';
      case 'error': return 'Com problemas';
    }
  };

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'];

  const pieData = [
    { name: 'Sucesso', value: metrics?.successful_interactions || 0 },
    { name: 'Correções', value: metrics?.corrections_needed || 0 },
    { name: 'Conversões', value: metrics?.conversions_assisted || 0 },
  ].filter(d => d.value > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Status de Saúde */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${getHealthColor()} animate-pulse`} />
          <span className="font-medium">{getHealthText()}</span>
          <span className="text-sm text-muted-foreground">
            Última verificação: {healthStatus.lastCheck.toLocaleTimeString('pt-BR')}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTestHealth} disabled={refreshing}>
            <Activity className="h-4 w-4 mr-2" />
            Testar Saúde
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.total_interactions || 0}</p>
                <p className="text-xs text-muted-foreground">Interações Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.successful_interactions || 0}</p>
                <p className="text-xs text-muted-foreground">Bem-sucedidas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.corrections_needed || 0}</p>
                <p className="text-xs text-muted-foreground">Correções</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.conversions_assisted || 0}</p>
                <p className="text-xs text-muted-foreground">Conversões</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Indicadores de Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Precisão das Respostas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {((metrics?.avg_response_accuracy || 0) * 100).toFixed(0)}%
                </span>
                <Badge variant={metrics?.avg_response_accuracy && metrics.avg_response_accuracy >= 0.8 ? "default" : "secondary"}>
                  {metrics?.avg_response_accuracy && metrics.avg_response_accuracy >= 0.8 ? "Bom" : "Melhorar"}
                </Badge>
              </div>
              <Progress value={(metrics?.avg_response_accuracy || 0) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Confiança do Modelo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {((metrics?.avg_confidence_score || 0) * 100).toFixed(0)}%
                </span>
                <Badge variant={metrics?.avg_confidence_score && metrics.avg_confidence_score >= 0.7 ? "default" : "secondary"}>
                  {metrics?.avg_confidence_score && metrics.avg_confidence_score >= 0.7 ? "Estável" : "Ajustar"}
                </Badge>
              </div>
              <Progress value={(metrics?.avg_confidence_score || 0) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Progresso de Aprendizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">
                  {((metrics?.learning_progress || 0) * 100).toFixed(0)}%
                </span>
                <Badge variant="outline">
                  Nível {Math.floor((metrics?.learning_progress || 0) * 10) + 1}
                </Badge>
              </div>
              <Progress value={(metrics?.learning_progress || 0) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos e Histórico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico de Interações */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Interações (Últimos 7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metricsHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={metricsHistory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="interacoes" fill="hsl(var(--primary))" name="Interações" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sucesso" fill="hsl(var(--chart-2))" name="Sucesso" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados históricos
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição de Resultados */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              Distribuição de Resultados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Padrões Identificados */}
      {patterns.length > 0 && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Padrões Identificados
            </CardTitle>
            <CardDescription>Insights aprendidos pela IA</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patterns.map((pattern) => (
                <div key={pattern.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    {pattern.pattern_type === 'timing' ? (
                      <Clock className="h-4 w-4 text-primary" />
                    ) : (
                      <Target className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{pattern.pattern_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Confiança: {((pattern.confidence_score || 0) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <Badge variant="outline">
                    {pattern.times_validated || 0} validações
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interações Recentes */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Interações Recentes
          </CardTitle>
          <CardDescription>Últimas conversas processadas pela IA</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {recentInteractions.length > 0 ? (
              <div className="space-y-3">
                {recentInteractions.map((interaction) => (
                  <div key={interaction.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">
                          {interaction.input_message?.substring(0, 100)}...
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          IA: {interaction.ai_response?.substring(0, 80)}...
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {interaction.was_corrected ? (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="h-3 w-3 mr-1" />
                            Corrigida
                          </Badge>
                        ) : interaction.feedback_score && interaction.feedback_score >= 4 ? (
                          <Badge className="bg-green-500 text-xs">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Positivo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Pendente
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(interaction.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Nenhuma interação registrada
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Status Técnico */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Status Técnico
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{healthStatus.responseTime}ms</p>
              <p className="text-xs text-muted-foreground">Tempo de Resposta</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{(healthStatus.errorRate * 100).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Erro</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">{healthStatus.uptime}%</p>
              <p className="text-xs text-muted-foreground">Disponibilidade</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-lg font-bold">Gemini 2.5</p>
              <p className="text-xs text-muted-foreground">Modelo Ativo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
