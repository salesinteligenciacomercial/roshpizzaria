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
    await Promise.all([loadStats(), loadSuggestions()]);
  };

  const loadStats = async () => {
    if (!companyId) return;
    
    const [playbooksRes, routinesRes, stagesRes] = await Promise.all([
      supabase.from('processes_playbooks').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('processes_routines').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('processes_stages').select('id', { count: 'exact', head: true }).eq('company_id', companyId)
    ]);

    setStats(prev => ({
      ...prev,
      playbooks: playbooksRes.count || 0,
      routines: routinesRes.count || 0,
      stages: stagesRes.count || 0
    }));
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
    { id: "workspace", title: "Workspace", description: "Páginas, Tarefas, Calendário, Playbooks, Cadências e Etapas", icon: FileText, color: "text-primary", bgColor: "bg-primary/10", count: null },
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
          <p className="text-muted-foreground mt-1">Gerencie documentos, tarefas, playbooks, cadências e processos do seu time comercial</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
          <TabsTrigger value="workspace" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Workspace</span>
          </TabsTrigger>
          <TabsTrigger value="kpis" className="flex items-center gap-2 py-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden md:inline">KPIs & Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="sugestoes" className="flex items-center gap-2 py-2 relative">
            <Brain className="h-4 w-4" />
            <span className="hidden md:inline">IA</span>
            {stats.suggestions > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.suggestions}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <NotionWorkspace companyId={companyId} />
        </TabsContent>

        <TabsContent value="kpis" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-orange-500" />
                KPIs & Relatórios
              </CardTitle>
              <CardDescription>Dashboard com métricas de conversão, desempenho e insights do time</CardDescription>
            </CardHeader>
            <CardContent>
              <KPIsDashboard companyId={companyId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sugestoes" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-cyan-500" />
                Sugestões da IA de Processos
              </CardTitle>
              <CardDescription>Revise e aprove melhorias sugeridas automaticamente pela IA</CardDescription>
            </CardHeader>
            <CardContent>
              <SugestoesIAList suggestions={suggestions} onRefresh={loadSuggestions} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
