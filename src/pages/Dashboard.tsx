import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Target, MessageSquare, Calendar, CheckCircle, Bot, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

interface Stats {
  totalLeads: number;
  totalValue: number;
  conversionRate: number;
  activeDeals: number;
  conversas: number;
  compromissos: number;
  tarefas: number;
  mensagensIA: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    totalValue: 0,
    conversionRate: 0,
    activeDeals: 0,
    conversas: 0,
    compromissos: 0,
    tarefas: 0,
    mensagensIA: 0,
  });
  const [loading, setLoading] = useState(true);
  const [etapas, setEtapas] = useState<any[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Leads
      const { data: leads } = await supabase.from("leads").select("value, status, etapa_id");
      const totalLeads = leads?.length || 0;
      const totalValue = leads?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
      const activeDeals = leads?.filter((l) => l.status !== "perdido" && l.status !== "ganho").length || 0;
      const wonDeals = leads?.filter((l) => l.status === "ganho").length || 0;
      const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;

      // Conversas
      const { count: conversasCount } = await supabase.from("conversas").select("*", { count: 'exact', head: true });

      // Compromissos
      const { count: compromissosCount } = await supabase.from("compromissos").select("*", { count: 'exact', head: true });

      // Tarefas
      const { count: tarefasCount } = await supabase.from("tasks").select("*", { count: 'exact', head: true });

      // Mensagens IA
      const { count: iaCount } = await supabase.from("ia_training_data").select("*", { count: 'exact', head: true });

      // Etapas para gráfico de funil
      const { data: etapasData } = await supabase
        .from("etapas")
        .select("id, nome, cor")
        .order("posicao");
      
      const etapasComContagem = await Promise.all((etapasData || []).map(async (etapa) => {
        const leadsNaEtapa = leads?.filter(l => l.etapa_id === etapa.id) || [];
        return {
          ...etapa,
          quantidade: leadsNaEtapa.length,
          valor: leadsNaEtapa.reduce((sum, l) => sum + (Number(l.value) || 0), 0),
        };
      }));

      setEtapas(etapasComContagem);

      setStats({
        totalLeads,
        totalValue,
        conversionRate: Math.round(conversionRate),
        activeDeals,
        conversas: conversasCount || 0,
        compromissos: compromissosCount || 0,
        tarefas: tarefasCount || 0,
        mensagensIA: iaCount || 0,
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total de Leads",
      value: stats.totalLeads,
      icon: Users,
      description: "Leads ativos no sistema",
      color: "text-primary",
    },
    {
      title: "Valor em Pipeline",
      value: `R$ ${stats.totalValue.toLocaleString("pt-BR")}`,
      icon: DollarSign,
      description: "Valor total em negociação",
      color: "text-success",
    },
    {
      title: "Taxa de Conversão",
      value: `${stats.conversionRate}%`,
      icon: TrendingUp,
      description: "Conversão média",
      color: "text-accent",
    },
    {
      title: "Negócios Ativos",
      value: stats.activeDeals,
      icon: Target,
      description: "Em andamento",
      color: "text-warning",
    },
  ];

  const operacionalCards = [
    {
      title: "Conversas Ativas",
      value: stats.conversas,
      icon: MessageSquare,
      description: "WhatsApp, Instagram, Facebook",
      color: "text-blue-500",
    },
    {
      title: "Agendamentos",
      value: stats.compromissos,
      icon: Calendar,
      description: "Compromissos marcados",
      color: "text-purple-500",
    },
    {
      title: "Tarefas",
      value: stats.tarefas,
      icon: CheckCircle,
      description: "Em todos os quadros",
      color: "text-green-500",
    },
    {
      title: "Atendimentos IA",
      value: stats.mensagensIA,
      icon: Bot,
      description: "Mensagens processadas",
      color: "text-cyan-500",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Dashboard Gerencial
        </h1>
        <p className="text-muted-foreground text-lg">Visão completa do seu CRM em tempo real</p>
      </div>

      <Tabs defaultValue="vendas" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="ia">Inteligência Artificial</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => (
              <Card 
                key={stat.title} 
                className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Funil de Vendas Visualizado */}
          {etapas.length > 0 && (
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle>Pipeline por Etapa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {etapas.map((etapa) => (
                  <div key={etapa.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: etapa.cor }}
                        />
                        <span className="font-medium">{etapa.nome}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {etapa.quantidade} leads • R$ {etapa.valor.toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <Progress 
                      value={stats.totalLeads > 0 ? (etapa.quantidade / stats.totalLeads) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-card overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 rounded-full blur-3xl" />
            <CardHeader className="relative">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                CEUSIA CRM - Sistema Multiempresa
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Plataforma completa de gestão comercial com IA integrada
              </p>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Gestão de Leads e Funil</p>
                    <p className="text-sm text-muted-foreground">Kanban visual com drag & drop</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-success/10">
                    <MessageSquare className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Conversas Unificadas</p>
                    <p className="text-sm text-muted-foreground">WhatsApp, Instagram, Facebook</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-purple-500/10">
                    <Calendar className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Agenda e Compromissos</p>
                    <p className="text-sm text-muted-foreground">Lembretes automáticos via WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-cyan-500/10">
                    <Bot className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">IAs Autônomas</p>
                    <p className="text-sm text-muted-foreground">Atendimento, Vendas e Suporte</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operacional" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {operacionalCards.map((stat, index) => (
              <Card 
                key={stat.title} 
                className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="ia" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  IA de Atendimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Acurácia</span>
                    <span className="font-semibold">94%</span>
                  </div>
                  <Progress value={94} />
                  <div className="text-xs text-muted-foreground mt-2">
                    23 conversas atendidas hoje
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-500" />
                  IA Vendedora
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conversões</span>
                    <span className="font-semibold">89%</span>
                  </div>
                  <Progress value={89} />
                  <div className="text-xs text-muted-foreground mt-2">
                    15 negociações em andamento
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-cyan-500" />
                  IA de Suporte
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Satisfação</span>
                    <span className="font-semibold">96%</span>
                  </div>
                  <Progress value={96} />
                  <div className="text-xs text-muted-foreground mt-2">
                    9 atendimentos resolvidos
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
