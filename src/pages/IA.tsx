import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Sparkles, TrendingUp, Target, Workflow, BarChart3, Send, Brain, Lightbulb, BookOpen } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";
import { IAAgentCard } from "@/components/ia/IAAgentCard";
import { PainelInsights } from "@/components/ia/PainelInsights";
import { DisparoEmMassa } from "@/components/campanhas/DisparoEmMassa";
import { TreinamentoIA } from "@/components/ia/TreinamentoIA";
import { RecomendacoesIA } from "@/components/ia/RecomendacoesIA";
import { BaseConhecimentoIA } from "@/components/ia/BaseConhecimentoIA";
import { useEffect, useState } from "react";
import { useAIAgents } from "@/hooks/useAIAgents";
import { supabase } from "@/integrations/supabase/client";

export default function IA() {
  const [agentStates, setAgentStates] = useState({ atendimento: true, vendedora: true, suporte: false });
  const { getAgentConfigs, updateAgentConfig } = useAIAgents();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();
      if (!userRole?.company_id) return;
      const configs = await getAgentConfigs(userRole.company_id);
      const state = { atendimento: true, vendedora: true, suporte: false } as any;
      configs.forEach((c: any) => { state[c.agent_type] = !!c.enabled; });
      setAgentStates(state);
    };
    load();
  }, [getAgentConfigs]);

  const handleAgentToggle = async (id: string, active: boolean) => {
    setAgentStates(prev => ({ ...prev, [id]: active }));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();
    if (!userRole?.company_id) return;
    await updateAgentConfig(userRole.company_id, id, { enabled: active });
  };

  const aiAgents = [
    {
      id: "atendimento",
      name: "IA de Atendimento",
      description: "Pré-atendimento e triagem inicial automática",
      icon: Bot,
      color: "bg-blue-500",
      active: agentStates.atendimento,
      stats: {
        conversationsHandled: 23,
        avgResponseTime: "8s",
        successRate: "94%",
      }
    },
    {
      id: "vendedora",
      name: "IA Vendedora",
      description: "Conversão e negociação automatizada",
      icon: Sparkles,
      color: "bg-purple-500",
      active: agentStates.vendedora,
      stats: {
        conversationsHandled: 15,
        avgResponseTime: "12s",
        successRate: "89%",
      }
    },
    {
      id: "suporte",
      name: "IA de Suporte",
      description: "Resolução de dúvidas e pós-venda",
      icon: Bot,
      color: "bg-cyan-500",
      active: agentStates.suporte,
      stats: {
        conversationsHandled: 9,
        avgResponseTime: "15s",
        successRate: "96%",
      }
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Fluxos e Automação com IA
        </h1>
        <p className="text-muted-foreground text-lg">
          Agentes inteligentes, automações e campanhas
        </p>
      </div>

      <Tabs defaultValue="agentes" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="agentes" className="gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="conhecimento" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Conhecimento
          </TabsTrigger>
          <TabsTrigger value="treinamento" className="gap-2">
            <Brain className="h-4 w-4" />
            Treinamento
          </TabsTrigger>
          <TabsTrigger value="recomendacoes" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Recomendações
          </TabsTrigger>
          <TabsTrigger value="fluxos" className="gap-2">
            <Workflow className="h-4 w-4" />
            Fluxos
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <Send className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agentes" className="space-y-6 mt-6">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">IAs Ativadas e Funcionando</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Os agentes de IA estão ativos e podem responder automaticamente conversas em tempo real.
                Configure cada agente para personalizar o comportamento.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {aiAgents.map((agent) => (
              <IAAgentCard
                key={agent.id}
                {...agent}
                onToggle={handleAgentToggle}
              />
            ))}
          </div>

          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle>Modo Híbrido: IA + Humano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure quando a IA deve transferir conversas para atendimento humano:
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Transferência Automática</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Quando não souber responder</li>
                    <li>• Cliente solicitar atendente</li>
                    <li>• Negociação acima de R$ 10.000</li>
                    <li>• Reclamação detectada</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Sugestões ao Humano</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• IA sugere respostas</li>
                    <li>• Humano pode aceitar ou editar</li>
                    <li>• Histórico completo disponível</li>
                    <li>• Transição suave</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conhecimento" className="space-y-6 mt-6">
          <BaseConhecimentoIA />
        </TabsContent>

        <TabsContent value="fluxos" className="space-y-4 mt-6">
          <FluxoAutomacaoBuilder />
        </TabsContent>

        <TabsContent value="campanhas" className="space-y-4 mt-6">
          <DisparoEmMassa />
        </TabsContent>

        <TabsContent value="treinamento" className="space-y-4 mt-6">
          <TreinamentoIA />
        </TabsContent>

        <TabsContent value="recomendacoes" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Recomendações Inteligentes</CardTitle>
            </CardHeader>
            <CardContent>
              <RecomendacoesIA />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4 mt-6">
          <PainelInsights />
        </TabsContent>
      </Tabs>
    </div>
  );
}
