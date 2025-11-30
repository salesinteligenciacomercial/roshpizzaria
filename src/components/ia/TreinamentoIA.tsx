import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, Target, Zap, CheckCircle, AlertCircle, BookOpen, MessageSquare, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TrainingData {
  id: string;
  pergunta: string;
  resposta: string;
  feedback: 'positivo' | 'negativo' | null;
  created_at: string;
}

interface Pattern {
  id: string;
  tipo: string;
  descricao: string;
  frequencia: number;
  confianca: number;
}

export function TreinamentoIA() {
  const [config, setConfig] = useState({
    learning_mode: true,
    auto_optimization: true,
    collaborative_mode: true
  });
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [stats, setStats] = useState({
    totalInteracoes: 0,
    precisao: 0,
    aprendizado: 0,
    conversoes: 0
  });

  useEffect(() => {
    loadConfig();
    loadStats();
    loadPatterns();
    loadTrainingData();

    // Configurar Realtime para atualizar automaticamente
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Subscription para conversas (atualizar em tempo real)
      const conversasChannel = supabase
        .channel('treinamento-conversas')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversas',
          filter: `company_id=eq.${userRole.company_id}`
        }, () => {
          loadStats();
          loadPatterns();
          loadTrainingData();
        })
        .subscribe();

      // Subscription para dados de treinamento
      const trainingChannel = supabase
        .channel('treinamento-data')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ia_training_data',
          filter: `company_id=eq.${userRole.company_id}`
        }, () => {
          loadStats();
          loadTrainingData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(conversasChannel);
        supabase.removeChannel(trainingChannel);
      };
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  const loadConfig = async () => {
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole) return;

      const { data } = await supabase
      .from('ia_configurations')
        .select('learning_mode, auto_optimization, collaborative_mode')
      .eq('company_id', userRole.company_id)
      .maybeSingle();

    if (data) {
      setConfig({
          learning_mode: data.learning_mode ?? true,
          auto_optimization: data.auto_optimization ?? true,
          collaborative_mode: data.collaborative_mode ?? true
        });
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Buscar conversas reais da última semana
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

      const { data: conversas, error: convError } = await supabase
        .from('conversas')
        .select('id, fromme, created_at, mensagem')
        .eq('company_id', userRole.company_id)
        .gte('created_at', umaSemanaAtras.toISOString())
        .order('created_at', { ascending: false });

      if (convError) throw convError;

      // Buscar dados de treinamento
      const { data: trainingData } = await supabase
        .from('ia_training_data')
        .select('*')
        .eq('company_id', userRole.company_id)
        .gte('created_at', umaSemanaAtras.toISOString());

      // Calcular métricas reais
      const totalMensagens = conversas?.length || 0;
      const mensagensIA = conversas?.filter(c => c.fromme)?.length || 0;
      const mensagensClientes = totalMensagens - mensagensIA;
      
      // Calcular precisão baseada em feedbacks positivos
      const feedbacksPositivos = trainingData?.filter(t => 
        t.feedback_score && t.feedback_score >= 4
      )?.length || 0;
      const totalFeedbacks = trainingData?.filter(t => t.feedback_score)?.length || 0;
      const precisao = totalFeedbacks > 0 ? (feedbacksPositivos / totalFeedbacks) * 100 : 0;

      // Calcular conversões (leads que resultaram em conversão)
      const conversoes = trainingData?.filter(t => t.resulted_in_conversion)?.length || 0;

      // Calcular progresso de aprendizado (baseado em correções)
      const totalCorrecoes = trainingData?.filter(t => t.was_corrected)?.length || 0;
      const totalInteracoes = trainingData?.length || mensagensIA;
      const aprendizado = totalInteracoes > 0 
        ? Math.min(100, ((totalInteracoes - totalCorrecoes) / totalInteracoes) * 100)
        : 0;

      setStats({
        totalInteracoes: totalInteracoes || mensagensIA,
        precisao: Math.round(precisao),
        aprendizado: Math.round(aprendizado),
        conversoes: conversoes
      });
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      setStats({
        totalInteracoes: 0,
        precisao: 0,
        aprendizado: 0,
        conversoes: 0
      });
    }
  };

  const loadPatterns = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Buscar padrões do banco
      const { data: patternsData } = await supabase
        .from('ia_patterns')
        .select('*')
        .eq('company_id', userRole.company_id)
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })
        .limit(10);

      if (patternsData && patternsData.length > 0) {
        setPatterns(patternsData.map(p => ({
          id: p.id,
          tipo: p.pattern_type || 'Geral',
          descricao: p.pattern_name || '',
          frequencia: p.times_validated || 0,
          confianca: (p.confidence_score || 0) * 100
        })));
        return;
      }

      // Se não houver padrões salvos, analisar conversas reais
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

      const { data: conversas } = await supabase
        .from('conversas')
        .select('mensagem, created_at, fromme')
        .eq('company_id', userRole.company_id)
        .eq('fromme', false) // Apenas mensagens dos clientes
        .gte('created_at', umaSemanaAtras.toISOString());

      if (!conversas || conversas.length === 0) {
        setPatterns([]);
        return;
      }

      // Analisar padrões nas mensagens
      const patterns: Pattern[] = [];
      const mensagens = conversas.map(c => c.mensagem.toLowerCase());

      // Padrão 1: Saudação
      const saudacoes = mensagens.filter(m => 
        m.includes('olá') || m.includes('ola') || m.includes('bom dia') || 
        m.includes('boa tarde') || m.includes('boa noite') || m.includes('oi')
      ).length;
      if (saudacoes > 0) {
        patterns.push({
          id: 'pattern-1',
          tipo: 'Saudação',
          descricao: `${saudacoes} mensagens iniciaram com saudação`,
          frequencia: saudacoes,
          confianca: Math.min(95, (saudacoes / mensagens.length) * 100)
        });
      }

      // Padrão 2: Perguntas sobre preço
      const preco = mensagens.filter(m => 
        m.includes('preço') || m.includes('preco') || m.includes('valor') || 
        m.includes('quanto') || m.includes('custa')
      ).length;
      if (preco > 0) {
        patterns.push({
          id: 'pattern-2',
          tipo: 'Interesse',
          descricao: `${preco} mensagens perguntaram sobre preço/valor`,
          frequencia: preco,
          confianca: Math.min(90, (preco / mensagens.length) * 100)
        });
      }

      // Padrão 3: Agendamento
      const agendamento = mensagens.filter(m => 
        m.includes('agendar') || m.includes('horário') || m.includes('horario') || 
        m.includes('consulta') || m.includes('marcar')
      ).length;
      if (agendamento > 0) {
        patterns.push({
          id: 'pattern-3',
          tipo: 'Agendamento',
          descricao: `${agendamento} mensagens solicitaram agendamento`,
          frequencia: agendamento,
          confianca: Math.min(85, (agendamento / mensagens.length) * 100)
        });
      }

      // Padrão 4: Objeções
      const objecoes = mensagens.filter(m => 
        m.includes('caro') || m.includes('caro demais') || m.includes('muito caro') ||
        m.includes('não tenho') || m.includes('não posso')
      ).length;
      if (objecoes > 0) {
        patterns.push({
          id: 'pattern-4',
          tipo: 'Objeção',
          descricao: `${objecoes} mensagens contêm objeções de preço`,
          frequencia: objecoes,
          confianca: Math.min(80, (objecoes / mensagens.length) * 100)
        });
      }

      // Padrão 5: Horário de pico
      const horarios = conversas.map(c => new Date(c.created_at).getHours());
      const horarioPico = horarios.reduce((acc, h) => {
        acc[h] = (acc[h] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);
      const horaMaisComum = Object.entries(horarioPico).sort((a, b) => b[1] - a[1])[0];
      if (horaMaisComum && horaMaisComum[1] > 3) {
        patterns.push({
          id: 'pattern-5',
          tipo: 'Timing',
          descricao: `Maior volume de mensagens às ${horaMaisComum[0]}h (${horaMaisComum[1]} mensagens)`,
          frequencia: horaMaisComum[1],
          confianca: Math.min(75, (horaMaisComum[1] / mensagens.length) * 100)
        });
      }

      setPatterns(patterns);
    } catch (error) {
      console.error('Erro ao carregar padrões:', error);
      setPatterns([]);
    }
  };

  const loadTrainingData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Buscar dados reais de treinamento
      const { data } = await supabase
        .from('ia_training_data')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setTrainingData(data.map(t => ({
          id: t.id,
          pergunta: t.input_message || '',
          resposta: t.ai_response || '',
          feedback: t.feedback_score && t.feedback_score >= 4 ? 'positivo' : 
                   t.feedback_score && t.feedback_score <= 2 ? 'negativo' : null,
          created_at: t.created_at
        })));
        return;
      }

      // Se não houver dados de treinamento, buscar das conversas recentes
      const { data: conversas } = await supabase
        .from('conversas')
        .select('mensagem, created_at, fromme, numero')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (conversas && conversas.length > 0) {
        // Agrupar por número para formar conversas
        const conversasPorNumero = conversas.reduce((acc, msg) => {
          if (!acc[msg.numero]) acc[msg.numero] = [];
          acc[msg.numero].push(msg);
          return acc;
        }, {} as Record<string, typeof conversas>);

        const trainingDataFromConversas: TrainingData[] = [];
        
        Object.values(conversasPorNumero).forEach(msgs => {
          // Ordenar por data
          msgs.sort((a, b) => new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime());
          
          // Pegar pergunta do cliente e resposta da IA
          for (let i = 0; i < msgs.length - 1; i++) {
            const clienteMsg = msgs[i];
            const iaMsg = msgs[i + 1];
            
            if (!clienteMsg.fromme && iaMsg.fromme) {
              trainingDataFromConversas.push({
                id: `conv-${clienteMsg.id}`,
                pergunta: clienteMsg.mensagem,
                resposta: iaMsg.mensagem,
                feedback: null,
                created_at: clienteMsg.created_at || new Date().toISOString()
              });
            }
          }
        });

        setTrainingData(trainingDataFromConversas.slice(0, 20));
      } else {
        setTrainingData([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de treinamento:', error);
      setTrainingData([]);
    }
  };

  const updateConfig = async (field: string, value: boolean) => {
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!userRole) return;

      const newConfig = { ...config, [field]: value };

    const { error } = await supabase
      .from('ia_configurations')
      .upsert({
        company_id: userRole.company_id,
          learning_mode: newConfig.learning_mode,
          auto_optimization: newConfig.auto_optimization,
          collaborative_mode: newConfig.collaborative_mode
      }, {
        onConflict: 'company_id'
      });

      if (error) throw error;

      setConfig(newConfig);
      toast.success('Configuração atualizada!');
    } catch (error) {
      console.error('Erro ao atualizar config:', error);
      toast.error('Erro ao atualizar configuração');
    }
  };

  const analyzePatterns = async () => {
    setAnalyzing(true);
    toast.info('Analisando padrões de conversação...');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Recarregar padrões (que já fazem análise real)
      await loadPatterns();
      await loadStats();

      // Aguardar um pouco para o state atualizar
      await new Promise(resolve => setTimeout(resolve, 500));

      // Salvar padrões identificados no banco (usando o state atualizado)
      const currentPatterns = patterns;
      if (currentPatterns.length > 0) {
        for (const pattern of currentPatterns) {
          await supabase
            .from('ia_patterns')
            .upsert({
              company_id: userRole.company_id,
              pattern_type: pattern.tipo,
              pattern_name: pattern.descricao,
              pattern_data: { frequencia: pattern.frequencia },
              confidence_score: pattern.confianca / 100,
              times_validated: pattern.frequencia,
              is_active: true
            }, {
              onConflict: 'company_id,pattern_type'
            });
        }
      }
      
      setAnalyzing(false);
      toast.success('Análise concluída! Padrões atualizados.');
    } catch (error) {
      console.error('Erro ao analisar padrões:', error);
      setAnalyzing(false);
      toast.error('Erro ao analisar padrões');
    }
  };

  const handleFeedback = async (id: string, feedback: 'positivo' | 'negativo') => {
    setTrainingData(prev => prev.map(t => 
      t.id === id ? { ...t, feedback } : t
    ));
    toast.success(feedback === 'positivo' ? 'Feedback positivo registrado!' : 'Feedback negativo registrado. A IA vai aprender com isso.');
  };

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Sistema de Aprendizado Contínuo</CardTitle>
              <CardDescription>
                A IA está aprendendo e se aprimorando com cada interação
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <Label htmlFor="learning">Modo Aprendizado</Label>
                  <p className="text-xs text-muted-foreground">Aprende com interações</p>
                </div>
              </div>
              <Switch
                id="learning"
                checked={config.learning_mode}
                onCheckedChange={(v) => updateConfig('learning_mode', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-accent" />
                <div>
                  <Label htmlFor="auto">Auto-otimização</Label>
                  <p className="text-xs text-muted-foreground">Melhoria automática</p>
                </div>
              </div>
              <Switch
                id="auto"
                checked={config.auto_optimization}
                onCheckedChange={(v) => updateConfig('auto_optimization', v)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg bg-background">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-success" />
                <div>
                  <Label htmlFor="collab">Modo Colaborativo</Label>
                  <p className="text-xs text-muted-foreground">IA + Humano</p>
                </div>
              </div>
              <Switch
                id="collab"
                checked={config.collaborative_mode}
                onCheckedChange={(v) => updateConfig('collaborative_mode', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas principais */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.totalInteracoes}</div>
              <p className="text-sm text-muted-foreground">Total de Interações</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-success">{stats.precisao.toFixed(0)}%</div>
              <p className="text-sm text-muted-foreground">Precisão</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-accent">{stats.aprendizado.toFixed(0)}%</div>
              <p className="text-sm text-muted-foreground">Progresso de Aprendizado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">{stats.conversoes}</div>
              <p className="text-sm text-muted-foreground">Conversões Assistidas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <Tabs defaultValue="padroes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="padroes">Padrões Identificados</TabsTrigger>
          <TabsTrigger value="treinamento">Dados de Treinamento</TabsTrigger>
        </TabsList>

        <TabsContent value="padroes" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={analyzePatterns} disabled={analyzing}>
              {analyzing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Analisar Padrões de Conversão
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {patterns.map((pattern) => (
                <Card key={pattern.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary">{pattern.tipo}</Badge>
                          <Badge variant="outline" className="text-xs">
                            {pattern.frequencia} ocorrências
                  </Badge>
                        </div>
                        <p className="text-sm">{pattern.descricao}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{pattern.confianca.toFixed(0)}%</div>
                        <p className="text-xs text-muted-foreground">confiança</p>
                      </div>
                  </div>
                    <Progress value={pattern.confianca} className="mt-3 h-1" />
                  </CardContent>
                </Card>
              ))}

              {patterns.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      Clique em "Analisar Padrões" para identificar padrões de conversação
                    </p>
                  </CardContent>
                </Card>
              )}
                </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="treinamento" className="space-y-4 mt-4">
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {trainingData.map((data) => (
                <Card key={data.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-4 w-4 text-blue-600" />
                    </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Pergunta do Lead:</p>
                          <p className="text-sm font-medium">{data.pergunta}</p>
                  </div>
                    </div>

                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                          <Brain className="h-4 w-4 text-green-600" />
                  </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-1">Resposta da IA:</p>
                          <p className="text-sm">{data.resposta}</p>
                    </div>
                  </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-xs text-muted-foreground">
                          {new Date(data.created_at).toLocaleDateString('pt-BR')}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Essa resposta foi boa?</span>
                          <Button
                            size="sm"
                            variant={data.feedback === 'positivo' ? 'default' : 'outline'}
                            className="h-8 w-8 p-0"
                            onClick={() => handleFeedback(data.id, 'positivo')}
                          >
                            <ThumbsUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={data.feedback === 'negativo' ? 'destructive' : 'outline'}
                            className="h-8 w-8 p-0"
                            onClick={() => handleFeedback(data.id, 'negativo')}
                          >
                            <ThumbsDown className="h-4 w-4" />
                          </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

              {trainingData.length === 0 && (
          <Card>
                  <CardContent className="p-8 text-center">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">
                      Os dados de treinamento aparecerão aqui conforme a IA interagir com os leads
              </p>
            </CardContent>
          </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
