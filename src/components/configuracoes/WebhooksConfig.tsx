import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Key, 
  Plus, 
  Copy, 
  Trash2, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  FileJson,
  ChevronDown,
  Loader2,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApiKey {
  id: string;
  name: string;
  api_key: string;
  description: string | null;
  is_active: boolean;
  allowed_ips: string[] | null;
  rate_limit: number;
  created_at: string;
  last_used_at: string | null;
  total_requests: number;
}

interface WebhookLog {
  id: string;
  endpoint: string;
  request_method: string;
  request_body: Record<string, unknown>;
  response_status: number;
  error_message: string | null;
  lead_id: string | null;
  ip_address: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

export function WebhooksConfig() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  
  // Dialog states
  const [showNewKeyDialog, setShowNewKeyDialog] = useState(false);
  const [showLogDetailsDialog, setShowLogDetailsDialog] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  
  // Form states
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [newKeyAllowedIps, setNewKeyAllowedIps] = useState("");
  
  // Visibility states
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  
  const webhookUrl = `https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-generic-leads`;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      
      if (!userRole?.company_id) return;
      setCompanyId(userRole.company_id);
      
      // Load API keys
      const { data: keys, error: keysError } = await supabase
        .from('webhook_api_keys')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false });
      
      if (keysError) throw keysError;
      setApiKeys(keys || []);
      
      // Load logs
      await loadLogs(userRole.company_id);
    } catch (error) {
      console.error('Error loading webhook data:', error);
      toast.error('Erro ao carregar dados de webhooks');
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async (cId?: string) => {
    setLogsLoading(true);
    try {
      const { data: logsData, error: logsError } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('company_id', cId || companyId)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (logsError) throw logsError;
      setLogs((logsData || []) as unknown as WebhookLog[]);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'wh_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Nome da API Key é obrigatório');
      return;
    }
    
    try {
      const apiKey = generateApiKey();
      const allowedIps = newKeyAllowedIps.trim() 
        ? newKeyAllowedIps.split(',').map(ip => ip.trim()).filter(ip => ip)
        : null;
      
      const { error } = await supabase
        .from('webhook_api_keys')
        .insert({
          company_id: companyId,
          name: newKeyName.trim(),
          api_key: apiKey,
          description: newKeyDescription.trim() || null,
          allowed_ips: allowedIps
        });
      
      if (error) throw error;
      
      toast.success('API Key criada com sucesso');
      setShowNewKeyDialog(false);
      setNewKeyName("");
      setNewKeyDescription("");
      setNewKeyAllowedIps("");
      loadData();
    } catch (error) {
      console.error('Error creating API key:', error);
      toast.error('Erro ao criar API Key');
    }
  };

  const toggleApiKey = async (key: ApiKey) => {
    try {
      const { error } = await supabase
        .from('webhook_api_keys')
        .update({ is_active: !key.is_active })
        .eq('id', key.id);
      
      if (error) throw error;
      
      toast.success(key.is_active ? 'API Key desativada' : 'API Key ativada');
      loadData();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Erro ao atualizar API Key');
    }
  };

  const deleteApiKey = async (key: ApiKey) => {
    if (!confirm(`Deseja realmente excluir a API Key "${key.name}"?`)) return;
    
    try {
      const { error } = await supabase
        .from('webhook_api_keys')
        .delete()
        .eq('id', key.id);
      
      if (error) throw error;
      
      toast.success('API Key excluída');
      loadData();
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Erro ao excluir API Key');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(keyId)) {
        next.delete(keyId);
      } else {
        next.add(keyId);
      }
      return next;
    });
  };

  const examplePayload = {
    nome: "João Silva",
    telefone: "11999998888",
    email: "joao@email.com",
    cpf: "123.456.789-00",
    valor: 1500.00,
    data_nascimento: "1990-05-15",
    empresa: "Empresa ABC",
    servico: "Consultoria",
    origem: "Sistema Externo",
    tags: ["VIP", "Indicação"],
    observacoes: "Cliente indicado pelo parceiro X",
    utm_source: "google",
    utm_campaign: "campanha-maio"
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="keys" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="docs">Documentação</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Chaves de API</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie as chaves de autenticação para receber dados via webhook
              </p>
            </div>
            <Button onClick={() => setShowNewKeyDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova API Key
            </Button>
          </div>

          {apiKeys.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2">Nenhuma API Key criada</h4>
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Crie uma API Key para começar a receber leads via webhook
                </p>
                <Button onClick={() => setShowNewKeyDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira API Key
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(key => (
                <Card key={key.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{key.name}</h4>
                          <Badge variant={key.is_active ? "default" : "secondary"}>
                            {key.is_active ? "Ativa" : "Inativa"}
                          </Badge>
                        </div>
                        {key.description && (
                          <p className="text-sm text-muted-foreground">{key.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                            {visibleKeys.has(key.id) ? key.api_key : '•'.repeat(20)}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggleKeyVisibility(key.id)}
                          >
                            {visibleKeys.has(key.id) ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyToClipboard(key.api_key, 'API Key')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span>Requisições: {key.total_requests}</span>
                          {key.last_used_at && (
                            <span>
                              Último uso: {format(new Date(key.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          )}
                          <span>
                            Criada: {format(new Date(key.created_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={key.is_active}
                          onCheckedChange={() => toggleApiKey(key)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteApiKey(key)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documentation Tab */}
        <TabsContent value="docs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                URL do Webhook
              </CardTitle>
              <CardDescription>
                Envie requisições POST para este endpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded text-sm font-mono break-all">
                  {webhookUrl}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(webhookUrl, 'URL')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileJson className="h-5 w-5" />
                Payload de Exemplo
              </CardTitle>
              <CardDescription>
                Envie os dados do lead no corpo da requisição
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
                  {JSON.stringify(examplePayload, null, 2)}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(JSON.stringify(examplePayload, null, 2), 'Exemplo')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="h-5 w-5" />
                Exemplos de Integração
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 font-medium hover:text-primary">
                  <ChevronDown className="h-4 w-4" />
                  cURL
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
{`curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: SUA_API_KEY" \\
  -d '${JSON.stringify(examplePayload)}'`}
                  </pre>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 font-medium hover:text-primary">
                  <ChevronDown className="h-4 w-4" />
                  JavaScript / Fetch
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
{`fetch("${webhookUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "SUA_API_KEY"
  },
  body: JSON.stringify(${JSON.stringify(examplePayload, null, 2)})
})
.then(res => res.json())
.then(data => console.log(data));`}
                  </pre>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 font-medium hover:text-primary">
                  <ChevronDown className="h-4 w-4" />
                  Python
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto">
{`import requests

response = requests.post(
    "${webhookUrl}",
    headers={
        "Content-Type": "application/json",
        "x-api-key": "SUA_API_KEY"
    },
    json=${JSON.stringify(examplePayload, null, 4).replace(/"/g, "'")}
)

print(response.json())`}
                  </pre>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 font-medium hover:text-primary">
                  <ChevronDown className="h-4 w-4" />
                  Campos Aceitos
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo</TableHead>
                          <TableHead>Aliases</TableHead>
                          <TableHead>Tipo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono">nome</TableCell>
                          <TableCell className="text-sm">name, full_name, nome_completo, customer_name</TableCell>
                          <TableCell>string (obrigatório)</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">telefone</TableCell>
                          <TableCell className="text-sm">phone, celular, mobile, whatsapp, phone_number</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">email</TableCell>
                          <TableCell className="text-sm">e_mail</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">cpf</TableCell>
                          <TableCell className="text-sm">documento, document, cpf_cnpj</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">valor</TableCell>
                          <TableCell className="text-sm">value, sale_value, valor_venda, amount</TableCell>
                          <TableCell>number</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">data_nascimento</TableCell>
                          <TableCell className="text-sm">birthday, aniversario, birth_date, nascimento</TableCell>
                          <TableCell>string (YYYY-MM-DD)</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">empresa</TableCell>
                          <TableCell className="text-sm">company, company_name</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">servico</TableCell>
                          <TableCell className="text-sm">service, produto, product</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">origem</TableCell>
                          <TableCell className="text-sm">source, canal, channel</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">tags</TableCell>
                          <TableCell className="text-sm">-</TableCell>
                          <TableCell>array ou string (vírgula)</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">observacoes</TableCell>
                          <TableCell className="text-sm">notes, mensagem, message, comentarios</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono">utm_*</TableCell>
                          <TableCell className="text-sm">utm_source, utm_medium, utm_campaign, utm_content, utm_term</TableCell>
                          <TableCell>string</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Campos não reconhecidos serão salvos automaticamente nas observações do lead.
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">Logs de Requisições</h3>
              <p className="text-sm text-muted-foreground">
                Últimas 100 requisições recebidas
              </p>
            </div>
            <Button variant="outline" onClick={() => loadLogs()} disabled={logsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {logs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="font-medium mb-2">Nenhuma requisição recebida</h4>
                <p className="text-sm text-muted-foreground text-center">
                  Os logs aparecerão aqui quando você enviar dados via webhook
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {log.response_status >= 200 && log.response_status < 300 ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {log.response_status}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              {log.response_status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {log.ip_address || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.processing_time_ms ? `${log.processing_time_ms}ms` : '-'}
                        </TableCell>
                        <TableCell>
                          {log.lead_id ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.lead_id.substring(0, 8)}...
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedLog(log);
                              setShowLogDetailsDialog(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* New API Key Dialog */}
      <Dialog open={showNewKeyDialog} onOpenChange={setShowNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
            <DialogDescription>
              Crie uma nova chave de autenticação para receber leads via webhook
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="keyName">Nome *</Label>
              <Input
                id="keyName"
                placeholder="Ex: Integração Site"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyDescription">Descrição</Label>
              <Textarea
                id="keyDescription"
                placeholder="Descrição opcional da integração"
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keyIps">IPs Permitidos (opcional)</Label>
              <Input
                id="keyIps"
                placeholder="Ex: 192.168.1.1, 10.0.0.1"
                value={newKeyAllowedIps}
                onChange={(e) => setNewKeyAllowedIps(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separe múltiplos IPs por vírgula. Deixe vazio para permitir qualquer IP.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewKeyDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createApiKey}>
              <Key className="h-4 w-4 mr-2" />
              Criar API Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Details Dialog */}
      <Dialog open={showLogDetailsDialog} onOpenChange={setShowLogDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Requisição</DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    {selectedLog.response_status >= 200 && selectedLog.response_status < 300 ? (
                      <Badge className="bg-green-500">Sucesso ({selectedLog.response_status})</Badge>
                    ) : (
                      <Badge variant="destructive">Erro ({selectedLog.response_status})</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tempo de processamento</Label>
                  <p className="mt-1">{selectedLog.processing_time_ms}ms</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">IP de origem</Label>
                  <p className="mt-1 font-mono">{selectedLog.ip_address || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Lead criado</Label>
                  <p className="mt-1 font-mono text-sm">{selectedLog.lead_id || '-'}</p>
                </div>
              </div>
              
              {selectedLog.error_message && (
                <div>
                  <Label className="text-muted-foreground">Mensagem de erro</Label>
                  <p className="mt-1 text-destructive">{selectedLog.error_message}</p>
                </div>
              )}
              
              <div>
                <Label className="text-muted-foreground">Payload recebido</Label>
                <ScrollArea className="h-[200px] mt-2">
                  <pre className="p-4 bg-muted rounded-lg text-sm">
                    {JSON.stringify(selectedLog.request_body, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
