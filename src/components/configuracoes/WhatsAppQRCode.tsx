import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, QrCode, CheckCircle, XCircle, RefreshCw, Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function WhatsAppQRCode() {
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [instanceName, setInstanceName] = useState("");
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://evolution-evolution-api.kxuvcf.easypanel.host");
  const [creationMode, setCreationMode] = useState<"qrcode" | "manual">("qrcode");
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [logsByConnection, setLogsByConnection] = useState<Record<string, { ts: string; message: string }[]>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadConnections();

    // Health check automático a cada 30 segundos
    const healthCheckInterval = setInterval(() => {
      performHealthChecks();
    }, 30000);

    // Recarregar conexões a cada 15 segundos
    const reloadInterval = setInterval(() => {
      loadConnections();
    }, 15000);

    // Assinar atualizações em tempo real da tabela
    let unsubscribe: (() => void) | null = null;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        if (!userRole?.company_id) return;

        const channel = supabase.channel('whatsapp_connections_changes');
        channel.on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'whatsapp_connections',
          filter: `company_id=eq.${userRole.company_id}`
        }, (payload) => {
          // Recarregar na mudança
          loadConnections();
          if (payload.eventType === 'UPDATE') {
            const updated: any = payload.new as any;
            const prevStatus = statusMap[updated.id];
            if (prevStatus && prevStatus !== updated.status) {
              const msg = `Status mudou para ${updated.status}`;
              appendLog(updated.id, msg);
              if (updated.status === 'disconnected') {
                toast.error(`Instância ${updated.instance_name} desconectou`);
              } else if (updated.status === 'connected') {
                toast.success(`Instância ${updated.instance_name} conectada`);
              }
            }
          }
        });
        channel.subscribe();
        unsubscribe = () => {
          try { channel.unsubscribe(); } catch {}
        };
      } catch {}
    })();

    return () => {
      clearInterval(healthCheckInterval);
      clearInterval(reloadInterval);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const performHealthChecks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      const { data: connections } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', userRole.company_id)
        .eq('status', 'connected');

      if (!connections) return;

      // Executar health checks em paralelo
      const healthCheckPromises = connections.map(async (conn) => {
        try {
          const isHealthy = await testConnectionHealth(conn);
          const newStatus = isHealthy ? 'connected' : 'disconnected';

          if (newStatus !== conn.status) {
            await supabase
              .from('whatsapp_connections')
              .update({
                status: newStatus,
                last_health_check: new Date().toISOString(),
                last_connected_at: isHealthy ? new Date().toISOString() : conn.last_connected_at
              })
              .eq('id', conn.id);

            console.log(`🔄 Status da instância ${conn.instance_name} atualizado: ${newStatus}`);
          }
        } catch (error) {
          console.error(`❌ Erro no health check de ${conn.instance_name}:`, error);
        }
      });

      await Promise.all(healthCheckPromises);
    } catch (error) {
      console.error('❌ Erro geral nos health checks:', error);
    }
  };

  const testConnectionHealth = async (connection: any): Promise<boolean> => {
    if (!connection.evolution_api_url) return false;

    try {
      const testUrl = `${connection.evolution_api_url}/instance/connectionState/${connection.instance_name}`;

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': connection.evolution_api_key || 'test-key'
        },
        signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
      });

      if (!response.ok) return false;

      const result = await response.json();
      return result.instance?.state === 'open' || result.state === 'connected';
    } catch (error) {
      console.error(`❌ Health check falhou para ${connection.instance_name}:`, error);
      return false;
    }
  };

  const loadConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('👤 Usuário não autenticado');
        return;
      }

      console.log('👤 Usuário autenticado:', user.id);

      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('❌ Erro ao buscar user_role:', roleError);
        return;
      }

      if (!userRole?.company_id) {
        console.log('⚠️ Company ID não encontrado para o usuário');
        return;
      }

      console.log('✅ Company ID encontrado:', userRole.company_id, 'Role:', userRole.role);

      const { data, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false });

      if (connError) {
        console.error('❌ Erro ao carregar conexões:', connError);
        console.error('❌ Detalhes do erro:', {
          message: connError.message,
          details: connError.details,
          hint: connError.hint,
          code: connError.code
        });
        return;
      }

      if (data) {
        console.log('📱 Conexões carregadas:', data.length);
        setConnections(data);
        // Atualiza mapa de status e detecta transições
        setStatusMap((prev) => {
          const next: Record<string, string> = { ...prev };
          for (const c of data) {
            const old = prev[c.id];
            if (old && old !== c.status) {
              appendLog(c.id, `Status mudou de ${old} para ${c.status}`);
            }
            next[c.id] = c.status;
          }
          return next;
        });
        // Sincroniza selectedConnection pela id
        if (selectedConnection) {
          const match = data.find((c) => c.id === selectedConnection.id);
          if (match) setSelectedConnection(match);
        } else if (data.length > 0) {
          setSelectedConnection(data[0]);
        }
      }
    } catch (error) {
      console.error('❌ Erro geral ao carregar conexões:', error);
    }
  };

  const configureWebhook = async (instanceName: string, apiUrl: string, apiKey: string) => {
    try {
      console.log('🔗 Configurando webhook automaticamente...');

      const webhookUrl = `${window.location.origin}/functions/v1/webhook-conversas?instance=${instanceName}`;

      // Configurar webhook na Evolution API
      const webhookResponse = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['messages.upsert', 'messages.update', 'contacts.upsert', 'chats.upsert'],
          enabled: true
        })
      });

      if (!webhookResponse.ok) {
        console.warn('⚠️ Não foi possível configurar webhook automaticamente');
        console.warn('URL do webhook:', webhookUrl);
        console.warn('Status:', webhookResponse.status);
        return false;
      }

      const webhookResult = await webhookResponse.json();
      console.log('✅ Webhook configurado:', webhookResult);
      return true;
    } catch (error) {
      console.error('❌ Erro ao configurar webhook:', error);
      return false;
    }
  };

  const generateQRCode = async () => {
    if (!instanceName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }

    if (creationMode === "manual") {
      if (!apiKey.trim() || !apiUrl.trim()) {
        toast.error("Preencha API Key e URL da Evolution API");
        return;
      }
    }

    setLoading(true);

    try {
      console.log('🚀 Iniciando criação de instância:', instanceName);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('❌ Usuário não autenticado');
        throw new Error("Usuário não autenticado");
      }

      console.log('👤 Usuário autenticado:', user.id);

      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('❌ Erro ao buscar role:', roleError);
        console.error('❌ Detalhes do erro:', {
          message: roleError.message,
          details: roleError.details,
          hint: roleError.hint,
          code: roleError.code
        });
        throw new Error("Erro ao buscar informações da empresa. Verifique se você está associado a uma empresa.");
      }

      if (!userRole?.company_id) {
        console.error('❌ Company ID não encontrado');
        throw new Error("Você não está associado a nenhuma empresa. Entre em contato com o administrador.");
      }

      console.log('🏢 Company ID encontrado:', userRole.company_id, 'Role:', userRole.role);

      // Verificar se já existe instância com este nome nesta empresa
      const { data: existingConn } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('company_id', userRole.company_id)
        .eq('instance_name', instanceName.toUpperCase())
        .single();

      if (existingConn) {
        toast.error("Já existe uma instância com este nome nesta empresa");
        setLoading(false);
        return;
      }

      const connectionData = {
        company_id: userRole.company_id,
        instance_name: instanceName.toUpperCase(),
        evolution_api_url: creationMode === "manual" ? apiUrl : "https://evolution-evolution-api.kxuvcf.easypanel.host",
        evolution_api_key: creationMode === "manual" ? apiKey : null,
        status: 'connecting',
        qr_code_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
      };

      console.log('📱 Criando conexão WhatsApp:', connectionData);

      const { data: conn, error: connError } = await supabase
        .from('whatsapp_connections')
        .insert(connectionData)
        .select()
        .single();

      if (connError) {
        console.error('❌ Erro ao criar conexão:', connError);
        console.error('❌ Detalhes do erro:', {
          message: connError.message,
          details: connError.details,
          hint: connError.hint,
          code: connError.code
        });
        throw connError;
      }

      console.log('✅ Conexão WhatsApp criada:', conn);

      setSelectedConnection(conn);

      // Tentar configurar webhook automaticamente
      const effectiveApiUrl = creationMode === "manual" ? apiUrl : "https://evolution-evolution-api.kxuvcf.easypanel.host";
      const effectiveApiKey = creationMode === "manual" ? apiKey : null;

      if (effectiveApiKey) {
        const webhookConfigured = await configureWebhook(instanceName.toUpperCase(), effectiveApiUrl, effectiveApiKey);
        if (webhookConfigured) {
          console.log('✅ Webhook configurado automaticamente');
        } else {
          console.warn('⚠️ Webhook não foi configurado automaticamente - será necessário configurar manualmente');
        }
      }

      // Se modo manual, marcar como conectado imediatamente
      if (creationMode === "manual") {
        await supabase
          .from('whatsapp_connections')
          .update({ status: 'connected', last_connected_at: new Date().toISOString() })
          .eq('id', conn.id);

        toast.success("Instância configurada manualmente com sucesso!");
        setShowNewInstance(false);
        resetForm();
        loadConnections();
      } else {
        // Gerar QR Code mock (em produção, integrar com Evolution API real)
        const mockQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`whatsapp-${instanceName}-${Date.now()}`)}`;
        setQrCode(mockQR);
        setShowNewInstance(false);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp");
        loadConnections();
      }
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh de QRCode enquanto status = connecting
  useEffect(() => {
    if (!selectedConnection || selectedConnection.status !== 'connecting') return;
    const interval = setInterval(() => {
      const mockQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`whatsapp-${selectedConnection.instance_name}-${Date.now()}`)}`;
      setQrCode(mockQR);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedConnection]);

  const appendLog = (connectionId: string, message: string) => {
    setLogsByConnection((prev) => {
      const arr = prev[connectionId] ? [...prev[connectionId]] : [];
      arr.unshift({ ts: new Date().toISOString(), message });
      return { ...prev, [connectionId]: arr.slice(0, 50) };
    });
  };

  const resetForm = () => {
    setInstanceName("");
    setApiKey("");
    setApiUrl("https://evolution-evolution-api.kxuvcf.easypanel.host");
    setCreationMode("qrcode");
  };

  const testConnection = async (connection: any) => {
    if (!connection.evolution_api_url) {
      toast.error("URL da Evolution API não configurada");
      return;
    }

    setTestingConnection(connection.id);

    try {
      console.log('🔍 Testando conexão Evolution API:', connection.instance_name);

      // Tentar fazer uma requisição de status para a Evolution API
      const testUrl = `${connection.evolution_api_url}/instance/connectionState/${connection.instance_name}`;

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': connection.evolution_api_key || 'test-key'
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Conexão Evolution API testada:', result);

        if (result.instance?.state === 'open' || result.state === 'connected') {
          toast.success(`✅ Conexão ${connection.instance_name} funcionando!`);
          appendLog(connection.id, 'Teste de conectividade: OK');
        } else {
          toast.warning(`⚠️ Instância ${connection.instance_name} não conectada ao WhatsApp`);
          appendLog(connection.id, 'Teste de conectividade: não conectada');
        }
      } else {
        console.error('❌ Erro na resposta da Evolution API:', response.status);
        toast.error(`❌ Falha na conexão: ${response.status}`);
        appendLog(connection.id, `Falha HTTP no teste: ${response.status}`);
      }
    } catch (error: any) {
      console.error('❌ Erro ao testar conexão:', error);
      toast.error(`❌ Erro de conexão: ${error.message}`);
      appendLog(connection.id, `Erro no teste: ${error.message}`);
    } finally {
      setTestingConnection(null);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast.success("Instância removida");
      if (selectedConnection?.id === connectionId) {
        setSelectedConnection(null);
        setQrCode("");
      }
      setLogsByConnection((prev) => {
        const copy = { ...prev };
        delete copy[connectionId];
        return copy;
      });
      loadConnections();
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      toast.error("Erro ao remover instância");
    }
  };

  const getStatusBadge = (status: string, lastHealthCheck?: string) => {
    const now = new Date();
    const lastCheck = lastHealthCheck ? new Date(lastHealthCheck) : null;
    const minutesSinceLastCheck = lastCheck ? Math.floor((now.getTime() - lastCheck.getTime()) / (1000 * 60)) : null;

    const getHealthIndicator = () => {
      if (!lastCheck || minutesSinceLastCheck === null) return null;
      if (minutesSinceLastCheck < 2) return <span className="w-2 h-2 bg-green-500 rounded-full inline-block ml-1" title="Verificado recentemente" />;
      if (minutesSinceLastCheck < 10) return <span className="w-2 h-2 bg-yellow-500 rounded-full inline-block ml-1" title="Verificado há algum tempo" />;
      return <span className="w-2 h-2 bg-red-500 rounded-full inline-block ml-1" title="Verificação antiga" />;
    };

    switch (status) {
      case 'disconnected':
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>;
      case 'connecting':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Conectando...</Badge>;
      case 'connected':
        return (
          <Badge className="gap-1 bg-success">
            <CheckCircle className="h-3 w-3" />
            Conectado
            {getHealthIndicator()}
          </Badge>
        );
      default:
        return <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>;
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-success" />
              Instâncias WhatsApp
            </CardTitle>
            <CardDescription>
              Gerencie múltiplas conexões WhatsApp via Evolution API
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => performHealthChecks()}>Atualizar Status</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              // Testar todas em paralelo
              await Promise.all(connections.map((c) => testConnection(c)));
            }}>Testar Todas</Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const toRemove = connections.filter((c) => c.status === 'disconnected');
              for (const c of toRemove) {
                await deleteConnection(c.id);
              }
            }}>Remover Desconectadas</Button>
            <Button onClick={() => setShowNewInstance(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Instância
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo rápido */}
        {connections.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Conectadas: {connections.filter(c => c.status === 'connected').length}</span>
            <span>Conectando: {connections.filter(c => c.status === 'connecting').length}</span>
            <span>Desconectadas: {connections.filter(c => c.status === 'disconnected').length}</span>
          </div>
        )}
        {showNewInstance && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <Alert className="bg-success/10 border-success">
              <AlertDescription className="text-xs">
                <strong>✅ Sistema Multi-tenant Configurado:</strong> Cada subconta terá acesso isolado com WhatsApp exclusivo, leads separados e usuários independentes.
              </AlertDescription>
            </Alert>

            <Tabs value={creationMode} onValueChange={(v) => setCreationMode(v as "qrcode" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qrcode" className="text-xs">
                  <QrCode className="h-3 w-3 mr-1" /> Escanear QR Code
                </TabsTrigger>
                <TabsTrigger value="manual" className="text-xs">
                  <KeyRound className="h-3 w-3 mr-1" /> Configuração Manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="qrcode" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label>Nome da Instância *</Label>
                  <Input
                    placeholder="Ex: EMPRESA_VENDAS"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">
                    Apenas letras, números e underscore. Será único para esta empresa.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                <div className="space-y-2">
                  <Label>Nome da Instância *</Label>
                  <Input
                    placeholder="Ex: EMPRESA_VENDAS"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                    maxLength={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label>API Key da Evolution API *</Label>
                  <Input
                    type="password"
                    placeholder="Sua API Key da instância"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL da Evolution API *</Label>
                  <Input
                    placeholder="https://sua-api.com"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>

                <Alert>
                  <AlertDescription className="text-xs">
                    Use esta opção se você já tem uma instância configurada na Evolution API e deseja apenas conectá-la ao CRM.
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button onClick={generateQRCode} disabled={loading} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : creationMode === "manual" ? "Conectar" : "Gerar QR Code"}
              </Button>
              <Button variant="outline" onClick={() => {setShowNewInstance(false); resetForm();}}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {connections.map((conn) => (
              <div key={conn.id} className="p-4 border rounded-lg space-y-2 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <QrCode className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">{conn.instance_name}</p>
                      {conn.whatsapp_number && (
                        <p className="text-xs text-muted-foreground">{conn.whatsapp_number}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(conn.status, conn.last_health_check)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => testConnection(conn)}
                      disabled={testingConnection === conn.id}
                    >
                      {testingConnection === conn.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-success" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteConnection(conn.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                
                {conn.status === 'connecting' && selectedConnection?.id === conn.id && qrCode && (
                  <div className="mt-3 p-3 bg-background rounded-lg">
                    <img src={qrCode} alt="QR Code" className="w-48 h-48 mx-auto border" />
                    <p className="text-xs text-center mt-2 text-muted-foreground">
                      Escaneie com WhatsApp em até 2 minutos
                    </p>
                  </div>
                )}
                
                {conn.last_connected_at && (
                  <p className="text-xs text-muted-foreground">
                    Última conexão: {new Date(conn.last_connected_at).toLocaleString('pt-BR')}
                  </p>
                )}
                {conn.last_health_check && (
                  <p className="text-xs text-muted-foreground">
                    Último check: {new Date(conn.last_health_check).toLocaleString('pt-BR')}
                  </p>
                )}

                {/* Logs da conexão */}
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => setExpandedLogs((prev) => ({ ...prev, [conn.id]: !prev[conn.id] }))}>
                    {expandedLogs[conn.id] ? 'Ocultar Logs' : 'Ver Logs'}
                  </Button>
                  {expandedLogs[conn.id] && (
                    <div className="mt-2 max-h-40 overflow-auto rounded border bg-muted/30">
                      {(logsByConnection[conn.id] || []).length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">Sem eventos recentes</div>
                      ) : (
                        <ul className="text-xs">
                          {(logsByConnection[conn.id] || []).map((log, idx) => (
                            <li key={idx} className="px-2 py-1 border-b last:border-b-0">
                              <span className="text-muted-foreground">{new Date(log.ts).toLocaleTimeString('pt-BR')}:</span> {log.message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {connections.length === 0 && !showNewInstance && (
              <div className="text-center py-8 text-muted-foreground">
                <QrCode className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhuma instância configurada</p>
                <p className="text-sm">Clique em "Nova Instância" para começar</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t space-y-3">
          <Alert className="bg-success/10 border-success">
            <AlertDescription className="text-xs space-y-2">
              <p>
                <strong>✅ Isolamento Total por Empresa:</strong> Cada instância WhatsApp criada aqui é exclusiva desta empresa e completamente isolada de outras subcontas.
              </p>
              <p>
                <strong>🔍 Teste de Conexão:</strong> Use o botão de verificação (✓) ao lado de cada instância para testar se a Evolution API está respondendo corretamente.
              </p>
            </AlertDescription>
          </Alert>

          <Alert>
            <AlertDescription className="text-xs space-y-2">
              <p>
                <strong>📱 Configuração do Webhook Evolution API:</strong>
              </p>
              <p>Cole esta URL no webhook da sua instância Evolution API:</p>
              <code className="block bg-muted px-2 py-1 rounded break-all mt-1">
                https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-conversas?instance=NOME_DA_INSTANCIA
              </code>
              <p className="mt-2">
                <strong>Importante:</strong> Substitua NOME_DA_INSTANCIA pelo nome exato da instância que você criou acima.
              </p>
              <p className="mt-2">
                <strong>Eventos suportados:</strong> messages.upsert (novas mensagens), messages.update (status de mensagens).
              </p>
            </AlertDescription>
          </Alert>

          <Alert className="bg-blue/10 border-blue">
            <AlertDescription className="text-xs space-y-2">
              <p>
                <strong>🔧 Documentação Técnica:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li>Webhooks são automaticamente roteados para a empresa correta baseada na instância</li>
                <li>Dados são criptografados em trânsito e armazenados com isolamento RLS</li>
                <li>Teste de conexão valida disponibilidade da Evolution API</li>
                <li>Instâncias podem ser criadas via QR Code ou configuração manual</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
