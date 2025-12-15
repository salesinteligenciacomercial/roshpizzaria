import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  GitBranch, 
  BarChart3, 
  FileBarChart, 
  BookOpen,
  Workflow,
  Target,
  TrendingUp,
  Brain,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NovoPlaybookDialog } from "@/components/processos/NovoPlaybookDialog";
import { NovaRotinaDialog } from "@/components/processos/NovaRotinaDialog";
import { NovaEtapaDialog } from "@/components/processos/NovaEtapaDialog";
import { PlaybooksList } from "@/components/processos/PlaybooksList";
import { RotinasList } from "@/components/processos/RotinasList";
import { EtapasList } from "@/components/processos/EtapasList";
import { KPIsDashboard } from "@/components/processos/KPIsDashboard";
import { SugestoesIAList } from "@/components/processos/SugestoesIAList";
import { NotionWorkspace } from "@/components/processos/notion/NotionWorkspace";

interface Stats {
  playbooks: number;
  routines: number;
  stages: number;
  suggestions: number;
}

export default function ProcessosComerciais() {
  const [activeTab, setActiveTab] = useState("workspace");
  const [stats, setStats] = useState<Stats>({ playbooks: 0, routines: 0, stages: 0, suggestions: 0 });
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    loadCompanyId();
  }, []);

  useEffect(() => {
    if (companyId) {
      loadAllData();
    }
  }, [companyId]);

  const loadCompanyId = async () => {
    const { data } = await supabase.rpc('get_my_company_id');
    if (data) setCompanyId(data);
  };

  const loadAllData = async () => {
    if (!companyId) return;
    await Promise.all([loadPlaybooks(), loadRoutines(), loadStages(), loadSuggestions()]);
  };

  const loadPlaybooks = async () => {
    const { data, count } = await supabase
      .from('processes_playbooks')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setPlaybooks(data || []);
    setStats(prev => ({ ...prev, playbooks: count || 0 }));
  };

  const loadRoutines = async () => {
    const { data, count } = await supabase
      .from('processes_routines')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setRoutines(data || []);
    setStats(prev => ({ ...prev, routines: count || 0 }));
  };

  const loadStages = async () => {
    const { data, count } = await supabase
      .from('processes_stages')
      .select('*', { count: 'exact' })
      .eq('company_id', companyId)
      .order('stage_order', { ascending: true });
    setStages(data || []);
    setStats(prev => ({ ...prev, stages: count || 0 }));
  };

  const loadSuggestions = async () => {
    const { data } = await supabase
      .from('ai_process_suggestions')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setSuggestions(data || []);
    const pending = data?.filter(s => s.status === 'pending').length || 0;
    setStats(prev => ({ ...prev, suggestions: pending }));
  };

  const sections = [
    { id: "playbooks", title: "Playbooks Comerciais", description: "Scripts de atendimento, prospecção, follow-up e fechamento", icon: BookOpen, color: "text-blue-500", bgColor: "bg-blue-500/10", count: stats.playbooks },
    { id: "rotinas", title: "Cadências e Rotinas", description: "Rotinas de prospecção com etapas e intervalos definidos", icon: Workflow, color: "text-purple-500", bgColor: "bg-purple-500/10", count: stats.routines },
    { id: "etapas", title: "Processos Etapa por Etapa", description: "Fluxograma visual com checklists e objetivos por etapa", icon: GitBranch, color: "text-green-500", bgColor: "bg-green-500/10", count: stats.stages },
    { id: "kpis", title: "KPIs & Conversões", description: "Dashboard com taxas de conversão e métricas de desempenho", icon: TrendingUp, color: "text-orange-500", bgColor: "bg-orange-500/10", count: null },
    { id: "relatorios", title: "Relatórios de Processos", description: "Insights automáticos da IA sobre gargalos e melhorias", icon: FileBarChart, color: "text-red-500", bgColor: "bg-red-500/10", count: null },
    { id: "sugestoes", title: "Sugestões da IA", description: "Aprovação de melhorias sugeridas pela IA de Processos", icon: Brain, color: "text-cyan-500", bgColor: "bg-cyan-500/10", count: stats.suggestions }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <Target className="h-8 w-8 text-primary" />
            </div>
            Processos Comerciais
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie playbooks, cadências e processos do seu time comercial</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-8 gap-2 h-auto p-1 bg-muted/50">
          <TabsTrigger value="workspace" className="flex items-center gap-2 py-2"><FileText className="h-4 w-4" /><span className="hidden md:inline">Workspace</span></TabsTrigger>
          <TabsTrigger value="home" className="flex items-center gap-2 py-2"><Target className="h-4 w-4" /><span className="hidden md:inline">Visão Geral</span></TabsTrigger>
          <TabsTrigger value="playbooks" className="flex items-center gap-2 py-2"><BookOpen className="h-4 w-4" /><span className="hidden md:inline">Playbooks</span></TabsTrigger>
          <TabsTrigger value="rotinas" className="flex items-center gap-2 py-2"><Workflow className="h-4 w-4" /><span className="hidden md:inline">Cadências</span></TabsTrigger>
          <TabsTrigger value="etapas" className="flex items-center gap-2 py-2"><GitBranch className="h-4 w-4" /><span className="hidden md:inline">Etapas</span></TabsTrigger>
          <TabsTrigger value="kpis" className="flex items-center gap-2 py-2"><TrendingUp className="h-4 w-4" /><span className="hidden md:inline">KPIs</span></TabsTrigger>
          <TabsTrigger value="relatorios" className="flex items-center gap-2 py-2"><FileBarChart className="h-4 w-4" /><span className="hidden md:inline">Relatórios</span></TabsTrigger>
          <TabsTrigger value="sugestoes" className="flex items-center gap-2 py-2 relative"><Brain className="h-4 w-4" /><span className="hidden md:inline">IA</span>{stats.suggestions > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">{stats.suggestions}</Badge>}</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <NotionWorkspace companyId={companyId} />
        </TabsContent>

        <TabsContent value="home" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((section) => (
              <Card key={section.id} className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] border-border/50" onClick={() => setActiveTab(section.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-3 rounded-xl ${section.bgColor}`}><section.icon className={`h-6 w-6 ${section.color}`} /></div>
                    {section.count !== null && <Badge variant="secondary" className="text-lg px-3">{section.count}</Badge>}
                  </div>
                  <CardTitle className="text-lg mt-3">{section.title}</CardTitle>
                  <CardDescription className="text-sm">{section.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <Card className="border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Visão Geral do Módulo</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/10 text-center"><p className="text-3xl font-bold text-blue-500">{stats.playbooks}</p><p className="text-sm text-muted-foreground">Playbooks</p></div>
                <div className="p-4 rounded-xl bg-purple-500/10 text-center"><p className="text-3xl font-bold text-purple-500">{stats.routines}</p><p className="text-sm text-muted-foreground">Rotinas</p></div>
                <div className="p-4 rounded-xl bg-green-500/10 text-center"><p className="text-3xl font-bold text-green-500">{stats.stages}</p><p className="text-sm text-muted-foreground">Etapas</p></div>
                <div className="p-4 rounded-xl bg-cyan-500/10 text-center"><p className="text-3xl font-bold text-cyan-500">{stats.suggestions}</p><p className="text-sm text-muted-foreground">Sugestões Pendentes</p></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="playbooks" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-blue-500" />Playbooks Comerciais</CardTitle><CardDescription>Crie e gerencie scripts de atendimento, prospecção, follow-up e fechamento</CardDescription></div>
              <NovoPlaybookDialog companyId={companyId} onSuccess={loadPlaybooks} />
            </CardHeader>
            <CardContent><PlaybooksList playbooks={playbooks} onRefresh={loadPlaybooks} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rotinas" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><Workflow className="h-5 w-5 text-purple-500" />Cadências e Rotinas</CardTitle><CardDescription>Configure rotinas de prospecção com etapas, canais e intervalos</CardDescription></div>
              <NovaRotinaDialog companyId={companyId} onSuccess={loadRoutines} />
            </CardHeader>
            <CardContent><RotinasList routines={routines} onRefresh={loadRoutines} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="etapas" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5 text-green-500" />Processos Etapa por Etapa</CardTitle><CardDescription>Visualize e configure o fluxo comercial com checklists e objetivos</CardDescription></div>
              <NovaEtapaDialog companyId={companyId} stagesCount={stats.stages} onSuccess={loadStages} />
            </CardHeader>
            <CardContent><EtapasList stages={stages} onRefresh={loadStages} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-orange-500" />KPIs & Conversões</CardTitle><CardDescription>Dashboard com métricas de conversão e desempenho do time</CardDescription></CardHeader>
            <CardContent><KPIsDashboard companyId={companyId} /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><FileBarChart className="h-5 w-5 text-red-500" />Relatórios de Processos</CardTitle><CardDescription>Insights automáticos da IA sobre gargalos e oportunidades de melhoria</CardDescription></CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <FileBarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum relatório gerado ainda</p>
                <p className="text-sm">A IA de Processos analisará seus dados e gerará insights</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sugestoes" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader><CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5 text-cyan-500" />Sugestões da IA de Processos</CardTitle><CardDescription>Revise e aprove melhorias sugeridas automaticamente pela IA</CardDescription></CardHeader>
            <CardContent><SugestoesIAList suggestions={suggestions} onRefresh={loadSuggestions} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
