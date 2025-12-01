import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Lightbulb, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Target, 
  Zap, 
  ArrowRight,
  MessageSquare,
  Calendar,
  Users,
  DollarSign,
  RefreshCw,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Recomendacao {
  id: string;
  tipo: 'melhoria' | 'alerta' | 'oportunidade' | 'otimizacao';
  titulo: string;
  descricao: string;
  impacto: 'alto' | 'medio' | 'baixo';
  area: string;
  acao?: string;
  implementada: boolean;
}

export function RecomendacoesIA() {
  const [recomendacoes, setRecomendacoes] = useState<Recomendacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRecomendacoes();

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

      // Subscription para conversas
      const conversasChannel = supabase
        .channel('recomendacoes-conversas')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversas',
          filter: `company_id=eq.${userRole.company_id}`
        }, () => {
          loadRecomendacoes();
        })
        .subscribe();

      // Subscription para leads
      const leadsChannel = supabase
        .channel('recomendacoes-leads')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `company_id=eq.${userRole.company_id}`
        }, () => {
          loadRecomendacoes();
        })
        .subscribe();

      // Subscription para recomendações
      const recsChannel = supabase
        .channel('recomendacoes-recs')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ia_recommendations',
          filter: `company_id=eq.${userRole.company_id}`
        }, () => {
          loadRecomendacoes();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(conversasChannel);
        supabase.removeChannel(leadsChannel);
        supabase.removeChannel(recsChannel);
      };
    };

    const cleanup = setupRealtime();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, []);

  const loadRecomendacoes = async () => {
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Analisar dados reais para gerar recomendações
      const umaSemanaAtras = new Date();
      umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

      // Buscar conversas da última semana
      const { data: conversas } = await supabase
        .from('conversas')
        .select('*')
        .eq('company_id', userRole.company_id)
        .gte('created_at', umaSemanaAtras.toISOString());

      // Buscar configurações da IA
      const { data: iaConfig } = await supabase
        .from('ia_configurations')
        .select('*')
        .eq('company_id', userRole.company_id)
        .maybeSingle();

      // Buscar leads
      const { data: leads } = await supabase
        .from('leads')
        .select('id, created_at, etapa_id, funil_id')
        .eq('company_id', userRole.company_id)
        .gte('created_at', umaSemanaAtras.toISOString());

      const recomendacoes: Recomendacao[] = [];

      // Análise 1: Tempo de resposta
      if (conversas && conversas.length > 0) {
        const mensagensClientes = conversas.filter(c => !c.fromme);
        const mensagensIA = conversas.filter(c => c.fromme);
        const taxaRespostaIA = mensagensClientes.length > 0 
          ? (mensagensIA.length / mensagensClientes.length) * 100 
          : 0;

        const customPrompts = iaConfig?.custom_prompts as any;
        const atendimentoEnabled = customPrompts?.atendimento?.enabled || false;
        
        if (taxaRespostaIA < 50 && !atendimentoEnabled) {
          recomendacoes.push({
            id: 'rec-1',
            tipo: 'oportunidade',
            titulo: 'Ativar IA de Atendimento',
            descricao: `Apenas ${taxaRespostaIA.toFixed(0)}% das mensagens estão sendo respondidas automaticamente. Ativar a IA pode melhorar significativamente o atendimento.`,
            impacto: 'alto',
            area: 'Atendimento',
            acao: 'Ativar IA de Atendimento',
            implementada: false
          });
        }
      }

      // Análise 2: Horário de atendimento
      if (conversas && conversas.length > 0) {
        const mensagensForaHorario = conversas.filter(c => {
          const hora = new Date(c.created_at || '').getHours();
          return hora < 8 || hora > 18;
        }).length;
        const percentualForaHorario = (mensagensForaHorario / conversas.length) * 100;

        if (percentualForaHorario > 20) {
          recomendacoes.push({
            id: 'rec-2',
            tipo: 'melhoria',
            titulo: 'Configurar atendimento 24/7',
            descricao: `${percentualForaHorario.toFixed(0)}% das mensagens chegam fora do horário comercial. Configure a IA para responder 24/7.`,
            impacto: 'medio',
            area: 'Disponibilidade',
            acao: 'Configurar horário',
            implementada: false
          });
        }
      }

      // Análise 3: Taxa de conversão
      if (leads && leads.length > 0) {
        const leadsConvertidos = leads.filter(l => l.etapa_id && l.funil_id).length;
        const taxaConversao = (leadsConvertidos / leads.length) * 100;

        if (taxaConversao < 15) {
          recomendacoes.push({
            id: 'rec-3',
            tipo: 'alerta',
            titulo: 'Taxa de conversão abaixo da média',
            descricao: `Sua taxa de conversão está em ${taxaConversao.toFixed(0)}%, abaixo da média de 18%. Revise o prompt de vendas e adicione treinamentos.`,
            impacto: 'alto',
            area: 'Vendas',
            acao: 'Otimizar prompt',
            implementada: false
          });
        }
      }

      // Análise 4: Mensagens não respondidas
      if (conversas && conversas.length > 0) {
        const mensagensClientes = conversas.filter(c => !c.fromme);
        const mensagensRespondidas = mensagensClientes.filter((msg, idx) => {
          const proximaMsg = conversas.find(c => 
            c.numero === msg.numero && 
            c.fromme && 
            new Date(c.created_at || '') > new Date(msg.created_at || '')
          );
          return !!proximaMsg;
        }).length;
        const taxaNaoRespondidas = mensagensClientes.length > 0
          ? ((mensagensClientes.length - mensagensRespondidas) / mensagensClientes.length) * 100
          : 0;

        if (taxaNaoRespondidas > 30) {
          recomendacoes.push({
            id: 'rec-4',
            tipo: 'oportunidade',
            titulo: 'Configurar follow-up automático',
            descricao: `${taxaNaoRespondidas.toFixed(0)}% das mensagens não recebem resposta. Configure follow-up automático para reengajar leads.`,
            impacto: 'alto',
            area: 'Engajamento',
            acao: 'Configurar follow-up',
            implementada: false
          });
        }
      }

      // Análise 5: Perguntas frequentes
      if (conversas && conversas.length > 0) {
        const mensagensClientes = conversas.filter(c => !c.fromme).map(c => c.mensagem.toLowerCase());
        const perguntasComuns = [
          { palavra: 'preço', count: 0 },
          { palavra: 'horário', count: 0 },
          { palavra: 'agendar', count: 0 },
          { palavra: 'endereço', count: 0 },
          { palavra: 'telefone', count: 0 }
        ];

        mensagensClientes.forEach(msg => {
          perguntasComuns.forEach(p => {
            if (msg.includes(p.palavra)) p.count++;
          });
        });

        const topPergunta = perguntasComuns.sort((a, b) => b.count - a.count)[0];
        if (topPergunta.count > 5) {
          recomendacoes.push({
            id: 'rec-5',
            tipo: 'otimizacao',
            titulo: 'Adicionar FAQ frequente',
            descricao: `A pergunta sobre "${topPergunta.palavra}" aparece ${topPergunta.count} vezes. Adicione na base de conhecimento.`,
            impacto: 'medio',
            area: 'Conhecimento',
            acao: 'Adicionar FAQ',
            implementada: false
          });
        }
      }

      // Análise 6: Base de conhecimento vazia
      const knowledgeBase = (iaConfig as any)?.knowledge_base;
      if (iaConfig && (!knowledgeBase || Object.keys(knowledgeBase).length === 0)) {
        recomendacoes.push({
          id: 'rec-6',
          tipo: 'melhoria',
          titulo: 'Configurar base de conhecimento',
          descricao: 'Sua base de conhecimento está vazia. Adicione informações da empresa, produtos e FAQs para melhorar as respostas da IA.',
          impacto: 'alto',
          area: 'Conhecimento',
          acao: 'Configurar base',
          implementada: false
        });
      }

      // Buscar recomendações salvas do banco
      const { data: savedRecs } = await supabase
        .from('ia_recommendations')
        .select('*')
        .eq('company_id', userRole.company_id)
        .eq('status', 'pending')
        .order('priority', { ascending: true });

      if (savedRecs && savedRecs.length > 0) {
        savedRecs.forEach(r => {
          recomendacoes.push({
            id: r.id,
            tipo: r.recommendation_type === 'action' ? 'melhoria' : 
                  r.recommendation_type === 'message' ? 'oportunidade' :
                  r.recommendation_type === 'timing' ? 'otimizacao' : 'alerta',
            titulo: r.recommendation_text.substring(0, 50),
            descricao: r.recommendation_text,
            impacto: r.priority === 'high' ? 'alto' : r.priority === 'medium' ? 'medio' : 'baixo',
            area: (r.recommendation_data as any)?.area || 'Geral',
            acao: (r.recommendation_data as any)?.action,
            implementada: r.status === 'accepted'
          });
        });
      }

      setRecomendacoes(recomendacoes);
    } catch (error) {
      console.error('Erro ao carregar recomendações:', error);
      setRecomendacoes([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshRecomendacoes = async () => {
    setRefreshing(true);
    toast.info('Analisando dados e gerando novas recomendações...');
    
    // Simular análise
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    await loadRecomendacoes();
    
    setRefreshing(false);
    toast.success('Recomendações atualizadas!');
  };

  const implementarRecomendacao = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) return;

      // Atualizar no banco se for uma recomendação salva
      if (id.startsWith('rec-')) {
        // É uma recomendação gerada dinamicamente, apenas marcar localmente
        setRecomendacoes(prev => prev.map(r => 
          r.id === id ? { ...r, implementada: true } : r
        ));
      } else {
        // É uma recomendação do banco, atualizar status
        const { error } = await supabase
          .from('ia_recommendations')
          .update({ 
            status: 'accepted',
            applied_at: new Date().toISOString(),
            applied_by: user.id
          })
          .eq('id', id);

        if (error) throw error;
      }

      setRecomendacoes(prev => prev.map(r => 
        r.id === id ? { ...r, implementada: true } : r
      ));
      toast.success('Recomendação marcada como implementada!');
    } catch (error) {
      console.error('Erro ao implementar recomendação:', error);
      toast.error('Erro ao marcar recomendação como implementada');
    }
  };

  const getTipoIcon = (tipo: Recomendacao['tipo']) => {
    switch (tipo) {
      case 'melhoria': return <TrendingUp className="h-5 w-5 text-blue-500" />;
      case 'alerta': return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'oportunidade': return <Lightbulb className="h-5 w-5 text-yellow-500" />;
      case 'otimizacao': return <Zap className="h-5 w-5 text-purple-500" />;
    }
  };

  const getTipoBadge = (tipo: Recomendacao['tipo']) => {
    switch (tipo) {
      case 'melhoria': return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30">Melhoria</Badge>;
      case 'alerta': return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30">Alerta</Badge>;
      case 'oportunidade': return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30">Oportunidade</Badge>;
      case 'otimizacao': return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30">Otimização</Badge>;
    }
  };

  const getImpactoBadge = (impacto: Recomendacao['impacto']) => {
    switch (impacto) {
      case 'alto': return <Badge variant="destructive">Alto Impacto</Badge>;
      case 'medio': return <Badge variant="secondary">Médio Impacto</Badge>;
      case 'baixo': return <Badge variant="outline">Baixo Impacto</Badge>;
    }
  };

  const getAreaIcon = (area: string) => {
    switch (area.toLowerCase()) {
      case 'atendimento': return <MessageSquare className="h-4 w-4" />;
      case 'agendamento': return <Calendar className="h-4 w-4" />;
      case 'vendas': return <DollarSign className="h-4 w-4" />;
      case 'engajamento': return <Users className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const pendentes = recomendacoes.filter(r => !r.implementada);
  const implementadas = recomendacoes.filter(r => r.implementada);
  const altoImpacto = pendentes.filter(r => r.impacto === 'alto').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Recomendações Inteligentes</h3>
              <p className="text-sm text-muted-foreground">
                {pendentes.length} pendentes • {altoImpacto} de alto impacto
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={refreshRecomendacoes} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar Análise
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 border-yellow-200 dark:border-yellow-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Lightbulb className="h-8 w-8 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{recomendacoes.filter(r => r.tipo === 'oportunidade').length}</div>
                <p className="text-sm text-muted-foreground">Oportunidades</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{recomendacoes.filter(r => r.tipo === 'alerta').length}</div>
                <p className="text-sm text-muted-foreground">Alertas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{recomendacoes.filter(r => r.tipo === 'melhoria').length}</div>
                <p className="text-sm text-muted-foreground">Melhorias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{implementadas.length}</div>
                <p className="text-sm text-muted-foreground">Implementadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de recomendações */}
      <Card>
        <CardHeader>
          <CardTitle>Recomendações Pendentes</CardTitle>
          <CardDescription>
            Ações sugeridas pela IA para melhorar seu atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {pendentes.map((rec) => (
                <Card key={rec.id} className="border-l-4" style={{
                  borderLeftColor: rec.tipo === 'alerta' ? 'rgb(249, 115, 22)' : 
                                  rec.tipo === 'oportunidade' ? 'rgb(234, 179, 8)' :
                                  rec.tipo === 'melhoria' ? 'rgb(59, 130, 246)' : 'rgb(168, 85, 247)'
                }}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        {getTipoIcon(rec.tipo)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {getTipoBadge(rec.tipo)}
                          {getImpactoBadge(rec.impacto)}
                          <Badge variant="outline" className="flex items-center gap-1">
                            {getAreaIcon(rec.area)}
                            {rec.area}
                          </Badge>
                        </div>
                        
                        <h4 className="font-semibold mb-1">{rec.titulo}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{rec.descricao}</p>
                        
                        {rec.acao && (
                          <Button 
                            size="sm" 
                            onClick={() => implementarRecomendacao(rec.id)}
                          >
                            {rec.acao}
                            <ArrowRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {pendentes.length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                  <p className="text-muted-foreground">
                    Todas as recomendações foram implementadas! 🎉
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recomendações implementadas */}
      {implementadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Implementadas ({implementadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {implementadas.map((rec) => (
                <div 
                  key={rec.id} 
                  className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg"
                >
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{rec.titulo}</span>
                  <Badge variant="outline" className="ml-auto">{rec.area}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
