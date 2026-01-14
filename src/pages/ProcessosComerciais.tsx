import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Target,
  Brain,
  FileText,
  AlertTriangle,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProcessInsightsReport } from "@/components/processos/ProcessInsightsReport";
import { SugestoesIAList } from "@/components/processos/SugestoesIAList";
import { NotionWorkspace } from "@/components/processos/notion/NotionWorkspace";
import { CommercialIntelligenceDashboard } from "@/components/ia/CommercialIntelligenceDashboard";

interface Stats {
  playbooks: number;
  routines: number;
  stages: number;
  suggestions: number;
  alerts: number;
}

export default function ProcessosComerciais() {
  const [activeTab, setActiveTab] = useState("intelligence");
  const [stats, setStats] = useState<Stats>({ playbooks: 0, routines: 0, stages: 0, suggestions: 0, alerts: 0 });
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
    await Promise.all([loadStats(), loadSuggestions(), loadAlerts()]);
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

  const loadAlerts = async () => {
    if (!companyId) return;
    
    const { count } = await supabase
      .from('ia_commercial_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'pending');

    setStats(prev => ({ ...prev, alerts: count || 0 }));
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
          <p className="text-muted-foreground mt-1">Inteligência comercial, documentos, playbooks, cadências e processos do seu time</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap gap-2 h-auto p-1 bg-muted/50">
          <TabsTrigger value="intelligence" className="flex items-center gap-2 py-2 relative">
            <Zap className="h-4 w-4" />
            <span className="hidden md:inline">Inteligência Comercial</span>
            {stats.alerts > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.alerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="workspace" className="flex items-center gap-2 py-2">
            <FileText className="h-4 w-4" />
            <span className="hidden md:inline">Workspace</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2 py-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden md:inline">Insights & Gargalos</span>
          </TabsTrigger>
          <TabsTrigger value="sugestoes" className="flex items-center gap-2 py-2 relative">
            <Brain className="h-4 w-4" />
            <span className="hidden md:inline">Sugestões da IA</span>
            {stats.suggestions > 0 && (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {stats.suggestions}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="intelligence">
          <CommercialIntelligenceDashboard />
        </TabsContent>

        <TabsContent value="workspace">
          <NotionWorkspace companyId={companyId} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Insights & Gargalos
              </CardTitle>
              <CardDescription>Análise automática de gargalos e pontos de melhoria nos seus processos comerciais</CardDescription>
            </CardHeader>
            <CardContent>
              <ProcessInsightsReport companyId={companyId} onSuggestionsGenerated={loadSuggestions} />
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
