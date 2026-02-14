import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Sparkles, Target, Workflow, BarChart3, Send, AlertTriangle } from "lucide-react";
import { N8nIntegration } from "@/components/ia/N8nIntegration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FluxoAutomacaoBuilder } from "@/components/fluxos/FluxoAutomacaoBuilder";
import { IAAgentCard } from "@/components/ia/IAAgentCard";

import { DisparoEmMassa } from "@/components/campanhas/DisparoEmMassa";
import { CampanhasDashboard } from "@/components/campanhas/CampanhasDashboard";
import { useEffect, useState } from "react";
import { useAIAgents } from "@/hooks/useAIAgents";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function IA() {
  const { canAccess, isAdmin, isSuperAdmin, loading: permissionsLoading } = usePermissions();
  const [agentStates, setAgentStates] = useState({ atendimento: false, agendamento: false });
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [loadingAiPermission, setLoadingAiPermission] = useState(true);
  const { getAgentConfigs, updateAgentConfig } = useAIAgents();

  // Verificar permissão de acesso à Automação
  if (!permissionsLoading && !canAccess('automacao') && !isAdmin) {
    return <Navigate to="/leads" replace />;
  }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Verificar diretamente no banco se é super_admin
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('role, company_id')
        .eq('user_id', user.id)
        .single();
      
      const isUserSuperAdmin = userRoleData?.role === 'super_admin';
      
      // Super admin tem acesso total - não precisa verificar permissões
      if (isUserSuperAdmin) {
        console.log('✅ Super Admin detectado - liberando IA');
        setAiEnabled(true);
        setLoadingAiPermission(false);
      } else {
        if (!userRoleData?.company_id) return;
        
        // Verificar se a empresa tem permissão para usar IA
        const { data: company } = await supabase
          .from('companies')
          .select('allow_ai_features')
          .eq('id', userRoleData.company_id)
          .single();
        
        setAiEnabled(company?.allow_ai_features ?? false);
        setLoadingAiPermission(false);
      }
      
      // Carregar configs dos agentes (sempre desativados por padrão)
      const configs = await getAgentConfigs();
      const state = { atendimento: false, agendamento: false } as any;
      if (configs && Array.isArray(configs)) {
        configs.forEach((c: any) => { state[c.agent_type] = !!c.enabled; });
      }
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
    await updateAgentConfig(id, { enabled: active });
  };

  const aiAgents = [
    {
      id: "atendimento",
      name: "IA de Atendimento",
      description: "Pré-atendimento, qualificação, vendas, suporte e gestão de leads",
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
      id: "agendamento",
      name: "IA de Agendamento",
      description: "Agenda, remarca e cancela compromissos automaticamente",
      icon: Target,
      color: "bg-emerald-500",
      active: agentStates.agendamento ?? true,
      stats: {
        conversationsHandled: 18,
        avgResponseTime: "5s",
        successRate: "98%",
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

      {/* Alerta quando IA não está habilitada para esta subconta */}
      {!loadingAiPermission && aiEnabled === false && (
        <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Funcionalidade de IA não habilitada</AlertTitle>
          <AlertDescription>
            Os agentes de IA não estão disponíveis para sua conta. Entre em contato com o administrador para contratar e ativar esta funcionalidade.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="agentes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agentes" className="gap-2">
            <Bot className="h-4 w-4" />
            Agentes
          </TabsTrigger>
          <TabsTrigger value="fluxos" className="gap-2">
            <Workflow className="h-4 w-4" />
            Fluxos
          </TabsTrigger>
          <TabsTrigger value="campanhas" className="gap-2">
            <Send className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agentes" className="space-y-6 mt-6">
          {aiEnabled === false ? (
            <Card className="border-destructive/20 bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="font-semibold">Agentes de IA Bloqueados</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Os agentes de IA não estão habilitados para sua conta. Esta funcionalidade precisa ser contratada e ativada pelo administrador.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold">Agentes de IA Disponíveis</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Os agentes de IA estão disponíveis e podem responder automaticamente conversas em tempo real.
                    Ative cada agente individualmente para começar a usar.
                  </p>
                </CardContent>
              </Card>

              <div className="grid gap-6 md:grid-cols-2">
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

              {/* Integração n8n */}
              <N8nIntegration />
            </>
          )}
        </TabsContent>


        <TabsContent value="fluxos" className="space-y-4 mt-6">
          <FluxoAutomacaoBuilder />
        </TabsContent>

        <TabsContent value="campanhas" className="space-y-4 mt-6">
          <Tabs defaultValue="disparo" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="disparo">
                <Send className="h-4 w-4 mr-2" />
                Disparo em Massa
              </TabsTrigger>
              <TabsTrigger value="relatorio">
                <BarChart3 className="h-4 w-4 mr-2" />
                Relatório
              </TabsTrigger>
            </TabsList>
            <TabsContent value="disparo" className="mt-4">
              <DisparoEmMassa />
            </TabsContent>
            <TabsContent value="relatorio" className="mt-4">
              <CampanhasDashboard />
            </TabsContent>
          </Tabs>
        </TabsContent>


      </Tabs>
    </div>
  );
}
