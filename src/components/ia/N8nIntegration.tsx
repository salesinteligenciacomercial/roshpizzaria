import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Workflow, 
  Plus, 
  Trash2, 
  Play, 
  Loader2, 
  Zap,
  BookOpen,
  Copy,
  Tag,
  Clock,
  Info,
  Globe,
  Webhook,
  Lightbulb
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface N8nFlow {
  id: string;
  name: string;
  tag?: string;
  webhookUrl: string;
  description?: string;
  active: boolean;
  lastTriggered?: Date;
  triggerType: 'manual' | 'automatic' | 'scheduled';
  createdAt: Date;
}

interface N8nConfig {
  baseUrl: string;
  apiKey?: string;
  flows: N8nFlow[];
}

export function N8nIntegration() {
  const [config, setConfig] = useState<N8nConfig>({
    baseUrl: "",
    apiKey: "",
    flows: []
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingFlow, setTestingFlow] = useState<string | null>(null);
  const [addFlowOpen, setAddFlowOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  
  // Novo fluxo
  const [newFlow, setNewFlow] = useState<Partial<N8nFlow>>({
    name: "",
    tag: "",
    webhookUrl: "",
    description: "",
    triggerType: "manual"
  });

  // Carregar configurações salvas
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      // Buscar configuração da company
      const { data: company } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userRole.company_id)
        .single();

      if (company?.settings) {
        const settings = company.settings as any;
        if (settings.n8n_config) {
          setConfig(settings.n8n_config);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações n8n:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      // Buscar settings atuais
      const { data: company } = await supabase
        .from('companies')
        .select('settings')
        .eq('id', userRole.company_id)
        .single();

      const currentSettings = (company?.settings || {}) as any;
      
      // Atualizar com nova config
      const { error } = await supabase
        .from('companies')
        .update({
          settings: {
            ...currentSettings,
            n8n_config: config
          }
        })
        .eq('id', userRole.company_id);

      if (error) throw error;

      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar configurações n8n:', error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleAddFlow = () => {
    if (!newFlow.name?.trim() || !newFlow.webhookUrl?.trim()) {
      toast.error("Nome e URL do Webhook são obrigatórios");
      return;
    }

    const flow: N8nFlow = {
      id: `flow-${Date.now()}`,
      name: newFlow.name.trim(),
      tag: newFlow.tag?.trim(),
      webhookUrl: newFlow.webhookUrl.trim(),
      description: newFlow.description?.trim(),
      triggerType: newFlow.triggerType as 'manual' | 'automatic' | 'scheduled',
      active: true,
      createdAt: new Date()
    };

    setConfig(prev => ({
      ...prev,
      flows: [...prev.flows, flow]
    }));

    setNewFlow({
      name: "",
      tag: "",
      webhookUrl: "",
      description: "",
      triggerType: "manual"
    });

    setAddFlowOpen(false);
    toast.success("Fluxo adicionado! Clique em Salvar para persistir.");
  };

  const handleRemoveFlow = (flowId: string) => {
    setConfig(prev => ({
      ...prev,
      flows: prev.flows.filter(f => f.id !== flowId)
    }));
    toast.info("Fluxo removido. Clique em Salvar para persistir.");
  };

  const handleToggleFlow = (flowId: string) => {
    setConfig(prev => ({
      ...prev,
      flows: prev.flows.map(f => 
        f.id === flowId ? { ...f, active: !f.active } : f
      )
    }));
  };

  const handleTestFlow = async (flow: N8nFlow) => {
    try {
      setTestingFlow(flow.id);

      const response = await fetch(flow.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          source: "lovable-crm",
          flow_name: flow.name
        })
      });

      // Atualizar lastTriggered
      setConfig(prev => ({
        ...prev,
        flows: prev.flows.map(f => 
          f.id === flow.id ? { ...f, lastTriggered: new Date() } : f
        )
      }));

      toast.success("Teste enviado! Verifique o histórico no n8n.");
    } catch (error) {
      console.error('Erro ao testar fluxo:', error);
      toast.error("Erro ao enviar teste. Verifique a URL do webhook.");
    } finally {
      setTestingFlow(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <Card className="border-0 shadow-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Workflow className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Integração n8n
                <Badge variant="secondary" className="ml-2">Beta</Badge>
              </CardTitle>
              <CardDescription>
                Conecte fluxos de automação e agentes IA personalizados
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Guia
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Guia de Integração n8n
                  </DialogTitle>
                  <DialogDescription>
                    Passo a passo para conectar seus fluxos de automação
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="step1">
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-primary">1</Badge>
                          Criar uma conta no n8n
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-8">
                        <p className="text-sm text-muted-foreground">
                          Acesse <a href="https://n8n.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">n8n.io</a> e crie sua conta gratuita ou faça login.
                        </p>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">
                            💡 O n8n oferece um plano gratuito com execuções limitadas, ideal para começar.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="step2">
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-primary">2</Badge>
                          Criar um novo Workflow
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-8">
                        <p className="text-sm text-muted-foreground">
                          No painel do n8n, clique em "Create Workflow" para criar um novo fluxo de automação.
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Dê um nome descritivo ao workflow</li>
                          <li>Adicione uma tag para facilitar a identificação</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="step3">
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-primary">3</Badge>
                          Adicionar Trigger Webhook
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-8">
                        <p className="text-sm text-muted-foreground">
                          No workflow, adicione o nó "Webhook" como trigger inicial:
                        </p>
                        <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-4">
                          <li>Clique no botão "+" para adicionar um nó</li>
                          <li>Busque por "Webhook" e selecione</li>
                          <li>Configure o método como "POST"</li>
                          <li>Copie a URL do webhook (Production URL)</li>
                        </ol>
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            ⚠️ Use sempre a "Production URL" para que o webhook funcione mesmo quando o editor estiver fechado.
                          </p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="step4">
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-primary">4</Badge>
                          Construir o Fluxo de Automação
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-8">
                        <p className="text-sm text-muted-foreground">
                          Após o trigger, adicione os nós que executarão a automação:
                        </p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                          <li><strong>IA:</strong> Use nós como OpenAI, Anthropic, ou AI Agent</li>
                          <li><strong>Integrações:</strong> Conecte com WhatsApp, Email, CRM, etc.</li>
                          <li><strong>Lógica:</strong> Use IF, Switch, Loop para condições</li>
                          <li><strong>Dados:</strong> HTTP Request, Database, Spreadsheet</li>
                        </ul>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="step5">
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <Badge className="bg-primary">5</Badge>
                          Ativar e Registrar no CRM
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-8">
                        <ol className="text-sm text-muted-foreground space-y-2 list-decimal pl-4">
                          <li>Ative o workflow no n8n (toggle no canto superior direito)</li>
                          <li>Copie a URL do webhook</li>
                          <li>Volte aqui e clique em "Adicionar Fluxo"</li>
                          <li>Cole a URL e configure o fluxo</li>
                          <li>Ative o fluxo no CRM</li>
                        </ol>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="examples">
                      <AccordionTrigger className="text-left">
                        <span className="flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          Exemplos de Uso
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pl-8">
                        <div className="grid gap-3">
                          <div className="p-3 border rounded-lg">
                            <h5 className="font-medium text-sm">Agente IA Personalizado</h5>
                            <p className="text-xs text-muted-foreground mt-1">
                              Crie um agente com OpenAI + ferramentas específicas do seu negócio
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <h5 className="font-medium text-sm">Notificação Multicanal</h5>
                            <p className="text-xs text-muted-foreground mt-1">
                              Envie notificações via Email, SMS e WhatsApp simultaneamente
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <h5 className="font-medium text-sm">Integração com Google Sheets</h5>
                            <p className="text-xs text-muted-foreground mt-1">
                              Sincronize dados do CRM com planilhas automaticamente
                            </p>
                          </div>
                          <div className="p-3 border rounded-lg">
                            <h5 className="font-medium text-sm">Automação de Vendas</h5>
                            <p className="text-xs text-muted-foreground mt-1">
                              Qualificação de leads + envio de propostas automáticas
                            </p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button onClick={saveConfig} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* URL Base (opcional) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label>URL Base do n8n (opcional)</Label>
          </div>
          <Input
            placeholder="https://seu-n8n.app.n8n.cloud"
            value={config.baseUrl}
            onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Apenas para referência. Cada fluxo usa sua própria URL de webhook.
          </p>
        </div>

        <Separator />

        {/* Lista de Fluxos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Fluxos Configurados
              <Badge variant="outline">{config.flows.length}</Badge>
            </h4>
            
            <Dialog open={addFlowOpen} onOpenChange={setAddFlowOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Fluxo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Fluxo n8n</DialogTitle>
                  <DialogDescription>
                    Configure um webhook do n8n para ser ativado pelo CRM
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome do Fluxo *</Label>
                    <Input
                      placeholder="Ex: Agente IA de Vendas"
                      value={newFlow.name || ""}
                      onChange={(e) => setNewFlow(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tag (para identificação)</Label>
                    <Input
                      placeholder="Ex: vendas, suporte, agendamento"
                      value={newFlow.tag || ""}
                      onChange={(e) => setNewFlow(prev => ({ ...prev, tag: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>URL do Webhook *</Label>
                    <Input
                      placeholder="https://seu-n8n.app.n8n.cloud/webhook/..."
                      value={newFlow.webhookUrl || ""}
                      onChange={(e) => setNewFlow(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Cole a Production URL do webhook do n8n
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      placeholder="Descreva o que este fluxo faz..."
                      value={newFlow.description || ""}
                      onChange={(e) => setNewFlow(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de Ativação</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={newFlow.triggerType === 'manual' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewFlow(prev => ({ ...prev, triggerType: 'manual' }))}
                      >
                        Manual
                      </Button>
                      <Button
                        type="button"
                        variant={newFlow.triggerType === 'automatic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewFlow(prev => ({ ...prev, triggerType: 'automatic' }))}
                      >
                        Automático
                      </Button>
                      <Button
                        type="button"
                        variant={newFlow.triggerType === 'scheduled' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setNewFlow(prev => ({ ...prev, triggerType: 'scheduled' }))}
                      >
                        Agendado
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Manual: você dispara. Automático: dispara em eventos do CRM.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setAddFlowOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddFlow}>
                      Adicionar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {config.flows.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Workflow className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum fluxo configurado</p>
              <p className="text-sm">Clique em "Adicionar Fluxo" para começar</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {config.flows.map((flow) => (
                  <Card key={flow.id} className={`border ${flow.active ? 'border-green-500/30' : 'border-muted'}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h5 className="font-semibold">{flow.name}</h5>
                            {flow.tag && (
                              <Badge variant="secondary" className="text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                {flow.tag}
                              </Badge>
                            )}
                            <Badge variant={flow.active ? "default" : "outline"} className="text-xs">
                              {flow.active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          
                          {flow.description && (
                            <p className="text-sm text-muted-foreground">{flow.description}</p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Webhook className="h-3 w-3" />
                              {flow.triggerType === 'manual' ? 'Manual' : 
                               flow.triggerType === 'automatic' ? 'Automático' : 'Agendado'}
                            </span>
                            {flow.lastTriggered && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Último: {new Date(flow.lastTriggered).toLocaleString('pt-BR')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 mt-2">
                            <Input
                              value={flow.webhookUrl}
                              readOnly
                              className="text-xs h-8 bg-muted/50"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(flow.webhookUrl)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Switch
                            checked={flow.active}
                            onCheckedChange={() => handleToggleFlow(flow.id)}
                          />
                          
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleTestFlow(flow)}
                            disabled={testingFlow === flow.id}
                          >
                            {testingFlow === flow.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemoveFlow(flow.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Info sobre integração automática */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h5 className="font-medium text-sm">Como usar fluxos automáticos</h5>
              <p className="text-xs text-muted-foreground">
                Fluxos com tipo "Automático" podem ser disparados por eventos do CRM:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-1">
                <li>Nova mensagem recebida no WhatsApp</li>
                <li>Lead criado ou atualizado</li>
                <li>Lead movido para nova etapa do funil</li>
                <li>Compromisso agendado ou cancelado</li>
                <li>Tarefa criada ou concluída</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Configure os triggers no próprio n8n para receber os dados corretos.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
