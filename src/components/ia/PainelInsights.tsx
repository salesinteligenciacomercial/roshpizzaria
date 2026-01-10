import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  MessageSquare,
  Target,
  Zap,
  Award,
  RefreshCw,
  Brain,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Lightbulb,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LineChart,
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
  Cell,
  AreaChart,
  Area
} from "recharts";

interface MetricData {
  total_interactions: number;
  successful_interactions: number;
  corrections_needed: number;
  conversions_assisted: number;
  avg_response_accuracy: number;
  learning_progress: number;
}

interface TrendData {
  metric: string;
  value: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
  change: number;
}

interface Suggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  type: 'optimization' | 'training' | 'action';
}

interface AgentPerformance {
  name: string;
  conversations: number;
  satisfaction: number;
  color: string;
  trend: number;
}

export function PainelInsights() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [todayMetrics, setTodayMetrics] = useState<MetricData | null>(null);
  const [weekMetrics, setWeekMetrics] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([]);

  useEffect(() => {
    loadCompanyAndMetrics();
  }, []);

  const loadCompanyAndMetrics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (userRole?.company_id) {
        setCompanyId(userRole.company_id);
        await loadAllData(userRole.company_id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (cId: string) => {
    await Promise.all([
      loadTodayMetrics(cId),
      loadWeekMetrics(cId),
      loadPatterns(cId),
      loadRecommendations(cId),
      loadAgentPerformance(cId)
    ]);
  };

  const loadTodayMetrics = async (cId: string) => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase
      .from('ia_metrics')
      .select('*')
      .eq('company_id', cId)
      .eq('metric_date', today);

    if (data && data.length > 0) {
      // Somar métricas de todos os agentes
      const aggregated = data.reduce((acc, curr) => ({
        total_interactions: (acc.total_interactions || 0) + (curr.total_interactions || 0),
        successful_interactions: (acc.successful_interactions || 0) + (curr.successful_interactions || 0),
        corrections_needed: (acc.corrections_needed || 0) + (curr.corrections_needed || 0),
        conversions_assisted: (acc.conversions_assisted || 0) + (curr.conversions_assisted || 0),
        avg_response_accuracy: ((acc.avg_response_accuracy || 0) + (curr.avg_response_accuracy || 0)) / 2,
        learning_progress: ((acc.learning_progress || 0) + (curr.learning_progress || 0)) / 2
      }), {} as MetricData);

      setTodayMetrics(aggregated);
    } else {
      setTodayMetrics({
        total_interactions: 0,
        successful_interactions: 0,
        corrections_needed: 0,
        conversions_assisted: 0,
        avg_response_accuracy: 0,
        learning_progress: 0
      });
    }
  };

  const loadWeekMetrics = async (cId: string) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data } = await supabase
      .from('ia_metrics')
      .select('*')
      .eq('company_id', cId)
      .gte('metric_date', weekAgo.toISOString().split('T')[0])
      .order('metric_date', { ascending: true });

    if (data) {
      // Agrupar por data
      const grouped = data.reduce((acc: any, curr) => {
        const date = curr.metric_date;
        if (!acc[date]) {
          acc[date] = { 
            date: new Date(date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
            interacoes: 0, 
            sucesso: 0, 
            conversoes: 0 
          };
        }
        acc[date].interacoes += curr.total_interactions || 0;
        acc[date].sucesso += curr.successful_interactions || 0;
        acc[date].conversoes += curr.conversions_assisted || 0;
        return acc;
      }, {});

      setWeekMetrics(Object.values(grouped));
    }
  };

  const loadPatterns = async (cId: string) => {
    const { data } = await supabase
      .from('ia_patterns')
      .select('*')
      .eq('company_id', cId)
      .eq('is_active', true)
      .order('confidence_score', { ascending: false })
      .limit(10);

    if (data) {
      setPatterns(data);
    }
  };

  const loadRecommendations = async (cId: string) => {
    const { data } = await supabase
      .from('ia_recommendations')
      .select('*')
      .eq('company_id', cId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setRecommendations(data);
    }
  };

  const loadAgentPerformance = async (cId: string) => {
    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('ia_metrics')
      .select('*')
      .eq('company_id', cId)
      .eq('metric_date', today);

    if (data) {
      const performance: AgentPerformance[] = data.map((m) => ({
        name: m.agent_type === 'atendimento' ? 'IA de Atendimento' : 
              m.agent_type === 'agendamento' ? 'IA de Agendamento' :
              m.agent_type === 'vendas' ? 'IA Vendedora' : 'IA de Suporte',
        conversations: m.total_interactions || 0,
        satisfaction: ((m.avg_response_accuracy || 0) * 100),
        color: m.agent_type === 'atendimento' ? 'bg-blue-500' :
               m.agent_type === 'agendamento' ? 'bg-purple-500' :
               m.agent_type === 'vendas' ? 'bg-green-500' : 'bg-cyan-500',
        trend: m.learning_progress || 0
      }));

      setAgentPerformance(performance);
    }
  };

  const handleRefresh = async () => {
    if (!companyId) return;
    setRefreshing(true);
    await loadAllData(companyId);
    setRefreshing(false);
    toast.success('Dados atualizados!');
  };

  const handleApplyRecommendation = async (recId: string) => {
    const { error } = await supabase
      .from('ia_recommendations')
      .update({ 
        status: 'applied', 
        applied_at: new Date().toISOString() 
      })
      .eq('id', recId);

    if (!error) {
      setRecommendations(prev => prev.filter(r => r.id !== recId));
      toast.success('Recomendação aplicada!');
    }
  };

  const trends: TrendData[] = [
    { 
      metric: "Taxa de Conversão", 
      value: `${todayMetrics?.conversions_assisted || 0}`, 
      trend: "up", 
      icon: TrendingUp,
      change: 23
    },
    { 
      metric: "Tempo de Resposta", 
      value: "1.2s", 
      trend: "up", 
      icon: Clock,
      change: -34
    },
    { 
      metric: "Transferências", 
      value: `${todayMetrics?.corrections_needed || 0}`, 
      trend: "up", 
      icon: Users,
      change: -12
    },
    { 
      metric: "Precisão", 
      value: `${((todayMetrics?.avg_response_accuracy || 0) * 100).toFixed(0)}%`, 
      trend: "up", 
      icon: Award,
      change: 18
    },
  ];

  const suggestions: Suggestion[] = [
    ...(patterns.find(p => p.pattern_type === 'timing') ? [{
      title: "Otimização de Horário",
      description: `Melhor horário para contato identificado: ${patterns.find(p => p.pattern_type === 'timing')?.pattern_data?.hour || 14}h`,
      priority: "high" as const,
      type: "optimization" as const
    }] : []),
    ...(todayMetrics && todayMetrics.corrections_needed > 5 ? [{
      title: "Treinamento Necessário",
      description: `${todayMetrics.corrections_needed} correções hoje. Considere revisar o prompt da IA.`,
      priority: "high" as const,
      type: "training" as const
    }] : []),
    ...(patterns.find(p => p.pattern_type === 'conversion') ? [{
      title: "Palavras-chave de Sucesso",
      description: `Use: ${(patterns.find(p => p.pattern_type === 'conversion')?.pattern_data?.keywords || []).slice(0, 3).join(', ')}`,
      priority: "medium" as const,
      type: "action" as const
    }] : []),
    {
      title: "Qualificação Automática",
      description: "67% dos leads poderiam ser qualificados automaticamente com mais perguntas.",
      priority: "medium" as const,
      type: "optimization" as const
    }
  ];

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#a855f7'];

  const pieData = [
    { name: 'Sucesso', value: todayMetrics?.successful_interactions || 0 },
    { name: 'Correções', value: todayMetrics?.corrections_needed || 0 },
    { name: 'Conversões', value: todayMetrics?.conversions_assisted || 0 },
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Painel de Inteligência</h2>
          <p className="text-muted-foreground">Insights e métricas da IA em tempo real</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Métricas Principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Interações Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{todayMetrics?.total_interactions || 0}</div>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-green-500/10 text-green-600 text-xs">
                {todayMetrics?.successful_interactions || 0} sucesso
              </Badge>
              <Badge variant="outline" className="text-xs">
                {todayMetrics?.corrections_needed || 0} correções
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Leads Qualificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {todayMetrics?.conversions_assisted || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {todayMetrics && todayMetrics.total_interactions > 0 
                ? `${((todayMetrics.conversions_assisted / todayMetrics.total_interactions) * 100).toFixed(0)}% de taxa`
                : '0% de taxa'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Precisão das Respostas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">
              {((todayMetrics?.avg_response_accuracy || 0) * 100).toFixed(0)}%
            </div>
            <Progress 
              value={(todayMetrics?.avg_response_accuracy || 0) * 100} 
              className="h-2 mt-2" 
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progresso de Aprendizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {((todayMetrics?.learning_progress || 0) * 100).toFixed(0)}%
            </div>
            <Progress 
              value={(todayMetrics?.learning_progress || 0) * 100} 
              className="h-2 mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Gráfico de Evolução */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Evolução Semanal
            </CardTitle>
            <CardDescription>Interações e conversões dos últimos 7 dias</CardDescription>
          </CardHeader>
          <CardContent>
            {weekMetrics.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={weekMetrics}>
                  <defs>
                    <linearGradient id="colorInteracoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConversoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="interacoes" 
                    stroke="hsl(var(--primary))" 
                    fillOpacity={1} 
                    fill="url(#colorInteracoes)" 
                    name="Interações"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversoes" 
                    stroke="hsl(var(--chart-2))" 
                    fillOpacity={1} 
                    fill="url(#colorConversoes)" 
                    name="Conversões"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sem dados históricos
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Distribuição de Resultados
            </CardTitle>
            <CardDescription>Proporção de resultados hoje</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sem dados para exibir
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendências */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Tendências da Semana</CardTitle>
          <CardDescription>Comparação com semana anterior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {trends.map((trend) => (
              <div key={trend.metric} className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <div className={`p-2 rounded-lg ${
                  trend.change >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <trend.icon className={`h-5 w-5 ${
                    trend.change >= 0 ? 'text-green-500' : 'text-red-500'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">{trend.metric}</div>
                  <div className="text-lg font-bold">{trend.value}</div>
                </div>
                <div className={`flex items-center text-sm font-medium ${
                  trend.change >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {trend.change >= 0 ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                  {Math.abs(trend.change)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sugestões e Padrões */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sugestões da IA */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Sugestões de Melhoria
            </CardTitle>
            <CardDescription>Insights automatizados para otimizar seu atendimento</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className={`p-2 rounded-lg ${
                      suggestion.priority === 'high' ? 'bg-amber-500/10' : 
                      suggestion.priority === 'medium' ? 'bg-blue-500/10' : 'bg-gray-500/10'
                    }`}>
                      {suggestion.type === 'optimization' ? (
                        <Zap className={`h-5 w-5 ${
                          suggestion.priority === 'high' ? 'text-amber-500' : 'text-blue-500'
                        }`} />
                      ) : suggestion.type === 'training' ? (
                        <Brain className="h-5 w-5 text-purple-500" />
                      ) : (
                        <Target className="h-5 w-5 text-green-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{suggestion.title}</h4>
                        <Badge 
                          variant={suggestion.priority === 'high' ? 'default' : 'outline'} 
                          className="text-xs"
                        >
                          {suggestion.priority === 'high' ? 'Alta' : 
                           suggestion.priority === 'medium' ? 'Média' : 'Baixa'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Padrões Identificados */}
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              Padrões de Conversão
            </CardTitle>
            <CardDescription>Insights aprendidos automaticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {patterns.length > 0 ? (
                <div className="space-y-3">
                  {patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg"
                    >
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        {pattern.pattern_type === 'timing' ? (
                          <Clock className="h-5 w-5 text-purple-500" />
                        ) : pattern.pattern_type === 'conversion' ? (
                          <Target className="h-5 w-5 text-green-500" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">{pattern.pattern_name}</h4>
                        <p className="text-xs text-muted-foreground">
                          Confiança: {((pattern.confidence_score || 0) * 100).toFixed(0)}% • 
                          {pattern.times_validated || 0} validações
                        </p>
                      </div>
                      <Badge variant="outline">
                        {pattern.pattern_type}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Brain className="h-12 w-12 mb-4 opacity-20" />
                  <p>Nenhum padrão identificado ainda</p>
                  <p className="text-xs">A IA está aprendendo...</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Performance por Agente */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Performance por Agente de IA</CardTitle>
          <CardDescription>Desempenho individual de cada agente</CardDescription>
        </CardHeader>
        <CardContent>
          {agentPerformance.length > 0 ? (
            <div className="space-y-4">
              {agentPerformance.map((agent) => (
                <div key={agent.name} className="flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-lg ${agent.color} flex items-center justify-center`}>
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {agent.conversations} conversas
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${agent.color}`}
                          style={{ width: `${agent.satisfaction}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {agent.satisfaction.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Nenhum agente ativo hoje
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recomendações Pendentes */}
      {recommendations.length > 0 && (
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Recomendações Pendentes
            </CardTitle>
            <CardDescription>Ações sugeridas pela IA para seus leads</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={rec.priority === 'high' ? 'default' : 'secondary'}>
                        {rec.priority}
                      </Badge>
                      <span className="text-sm">{rec.recommendation_text}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleApplyRecommendation(rec.id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Aplicar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
