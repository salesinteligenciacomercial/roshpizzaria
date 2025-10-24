import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Sparkles, TrendingUp, Target, Workflow } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";

export default function IA() {
  const aiAgents = [
    {
      name: "IA de Atendimento",
      description: "Pré-atendimento e triagem inicial de contatos",
      icon: Bot,
      color: "bg-blue-500",
    },
    {
      name: "IA Vendedora",
      description: "Funil de conversão e negociação automatizada",
      icon: Sparkles,
      color: "bg-purple-500",
    },
    {
      name: "IA Analista",
      description: "Interpretação de conversas e relatórios inteligentes",
      icon: TrendingUp,
      color: "bg-orange-500",
    },
    {
      name: "IA de Suporte",
      description: "Resolução de dúvidas e pós-venda automatizado",
      icon: Bot,
      color: "bg-cyan-500",
    },
    {
      name: "IA de Qualificação",
      description: "Segmentação e classificação automática de leads",
      icon: Target,
      color: "bg-pink-500",
    },
    {
      name: "IA de Agendamento",
      description: "Marcação e follow-up de reuniões inteligente",
      icon: Bot,
      color: "bg-indigo-500",
    },
    {
      name: "IA de Follow-Up",
      description: "Reativação e acompanhamento automático",
      icon: Target,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Fluxos e Automação
        </h1>
        <p className="text-muted-foreground text-lg">
          Configure agentes de IA e automações comerciais
        </p>
      </div>

      <Tabs defaultValue="fluxos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="fluxos" className="gap-2">
            <Workflow className="h-4 w-4" />
            Fluxos de Automação
          </TabsTrigger>
          <TabsTrigger value="agentes" className="gap-2">
            <Bot className="h-4 w-4" />
            Agentes de IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos" className="space-y-4 mt-6">
          <FluxoAutomacaoBuilder />
        </TabsContent>

        <TabsContent value="agentes" className="space-y-4 mt-6">
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold">Agentes de IA - Próxima Fase</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Os agentes de IA serão ativados na próxima fase. Por enquanto, você pode criar fluxos de automação manual.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {aiAgents.map((agent, index) => (
              <Card 
                key={agent.name} 
                className="group relative overflow-hidden border-0 shadow-card hover:shadow-lg transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative">
                  <CardTitle className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl ${agent.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <agent.icon className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold">{agent.name}</div>
                      <div className="text-sm font-normal text-muted-foreground">
                        {agent.description}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-sm">
                      Será ativado na fase 4
                    </p>
                    <div className="px-3 py-1 rounded-full bg-muted text-xs font-medium">
                      Em breve
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
