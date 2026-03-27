import { useState, useEffect, useRef, useCallback } from "react";
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
// Normalize QR code data to a displayable image src
function normalizeQrCode(qrData: string): string {
  if (!qrData) return '';
  // Already a data URI
  if (qrData.startsWith('data:')) return qrData;
  // Raw base64 - assume PNG
  if (qrData.length > 100) return `data:image/png;base64,${qrData}`;
  return qrData;
}

export function WhatsAppQRCode() {
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [instanceName, setInstanceName] = useState("");
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://evolution-evolution-api.0ntuaf.easypanel.host");
  const [creationMode, setCreationMode] = useState<"qrcode" | "manual">("qrcode");
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [logsByConnection, setLogsByConnection] = useState<Record<string, { ts: string; message: string }[]>>({});
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({});
  const [editApiKeyMap, setEditApiKeyMap] = useState<Record<string, string>>({});
  const [editApiUrlMap, setEditApiUrlMap] = useState<Record<string, string>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [pollingActive, setPollingActive] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadConnections();

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
                toast.success(`Instância ${updated.instance_name} conectada!`);
                // Stop polling when connected
                stopPolling();
                setQrCode("");
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
      if (unsubscribe) unsubscribe();
      stopPolling();
    };
  }, []);

  useEffect(() => {
    if (connections.length > 0 && showNewInstance) {
      setShowNewInstance(false);
    }
  }, [connections.length]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPollingActive(false);
  }, []);

  const startPolling = useCallback((instName: string, compId: string) => {
    stopPolling();
    setPollingActive(true);
    
    const poll = async () => {
      try {
        console.log('🔍 [POLLING] Verificando status da instância:', instName);
        const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
          body: { action: 'check_status', instanceName: instName, companyId: compId }
        });

        if (error) {
          console.error('❌ [POLLING] Erro:', error);
          return;
        }

        console.log('📡 [POLLING] Estado:', data?.state, 'Conectado:', data?.isConnected);

        if (data?.isConnected) {
          toast.success('✅ WhatsApp conectado com sucesso!');
          stopPolling();
          setQrCode("");
          loadConnections();
        }
      } catch (err) {
        console.error('❌ [POLLING] Erro geral:', err);
      }
    };

    // First check immediately
    poll();
    // Then every 15 seconds
    pollingRef.current = setInterval(poll, 15000);
  }, [stopPolling]);

  const appendLog = (connectionId: string, message: string) => {
    setLogsByConnection((prev) => {
      const arr = prev[connectionId] ? [...prev[connectionId]] : [];
      arr.unshift({ ts: new Date().toISOString(), message });
      return { ...prev, [connectionId]: arr.slice(0, 50) };
    });
  };

  const loadConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (roleError || !userRole?.company_id) return;

      const { data, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false });

      if (connError || !data) return;

      setConnections(data);
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
      if (selectedConnection) {
        const match = data.find((c) => c.id === selectedConnection.id);
        if (match) setSelectedConnection(match);
      } else if (data.length > 0) {
        setSelectedConnection(data[0]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar conexões:', error);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id, role')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      // Check existing
      const { data: existingRows } = await supabase
        .from('whatsapp_connections')
        .select('id')
        .eq('company_id', userRole.company_id)
        .limit(1);
      if (existingRows && existingRows.length > 0) {
        toast.error('Apenas 1 instância por CRM. Remova a atual para conectar outra.');
        setLoading(false);
        return;
      }

      if (creationMode === "manual") {
        // Manual mode - same as before
        const connectionData = {
          company_id: userRole.company_id,
          instance_name: instanceName.toUpperCase(),
          evolution_api_url: apiUrl,
          evolution_api_key: apiKey,
          status: 'connected',
          last_connected_at: new Date().toISOString(),
        };

        const { error: connError } = await supabase
          .from('whatsapp_connections')
          .insert(connectionData);

        if (connError) throw connError;

        toast.success("Instância configurada manualmente!");
        setShowNewInstance(false);
        resetForm();
        loadConnections();
      } else {
        // QR Code mode - call edge function
        console.log('🚀 Criando instância via Evolution API:', instanceName.toUpperCase());

        const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
          body: {
            action: 'create',
            instanceName: instanceName.toUpperCase(),
            companyId: userRole.company_id,
          }
        });

        if (error) {
          console.error('❌ Erro na edge function:', error);
          // Try to extract meaningful error from response
          let errorMsg = 'Erro ao criar instância';
          try {
            const parsed = typeof error === 'string' ? JSON.parse(error) : error;
            errorMsg = parsed?.error || parsed?.message || error.message || errorMsg;
          } catch { errorMsg = error.message || errorMsg; }
          throw new Error(errorMsg);
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Erro ao criar instância na Evolution API');
        }

        console.log('✅ Instância criada:', data);

        // Show QR code - normalize format
        if (data.qrcode) {
          setQrCode(normalizeQrCode(data.qrcode));
        } else if (data.pairingCode) {
          // No image QR, but we have pairing code
          toast.info(`Código de pareamento: ${data.pairingCode}`);
        } else {
          toast.warning("QR Code não retornado. Tente atualizar.");
        }

        if (data.connection) {
          setSelectedConnection(data.connection);
        }

        setShowNewInstance(false);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp");

        // Start polling for connection status
        startPolling(instanceName.toUpperCase(), userRole.company_id);
        loadConnections();
      }
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast.error(error.message || "Erro ao criar instância");
    } finally {
      setLoading(false);
    }
  };

  const refreshQRCode = async (conn: any) => {
    try {
      setLoading(true);
      console.log('🔄 Atualizando QR Code para:', conn.instance_name);

      const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
        body: {
          action: 'refresh_qr',
          instanceName: conn.instance_name,
        }
      });

      if (error) throw new Error(error.message);

      if (data?.success === false) {
        toast.warning(data.error || "QR Code não disponível");
        return;
      }

      if (data?.qrcode) {
        setQrCode(normalizeQrCode(data.qrcode));
        toast.success("QR Code atualizado!");

        // Restart polling
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userRole } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).single();
          if (userRole?.company_id) {
            startPolling(conn.instance_name, userRole.company_id);
          }
        }
      } else {
        toast.warning("QR Code não retornado");
      }
    } catch (err: any) {
      console.error('❌ Erro ao atualizar QR:', err);
      toast.error(err.message || "Erro ao atualizar QR Code");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setInstanceName("");
    setApiKey("");
    setApiUrl("https://evolution-evolution-api.0ntuaf.easypanel.host");
    setCreationMode("qrcode");
  };

  const configureWebhook = async (instName: string, url: string, key: string) => {
    try {
      const webhookUrl = `https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-conversas?instance=${instName}`;
      const webhookResponse = await fetch(`${url}/webhook/set/${instName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': key },
        body: JSON.stringify({
          url: webhookUrl,
          events: ['messages.upsert', 'messages.update', 'connection.update', 'contacts.upsert'],
          enabled: true
        })
      });
      return webhookResponse.ok;
    } catch {
      return false;
    }
  };

  const testConnection = async (connection: any) => {
    const isMeta = connection.api_provider === 'meta' || connection.api_provider === 'both';
    
    // Para Meta API, não precisa de evolution_api_url
    if (!isMeta && !connection.evolution_api_url) {
      toast.error("URL da Evolution API não configurada");
      return;
    }
    setTestingConnection(connection.id);
    try {
      const { data, error } = await supabase.functions.invoke('evolution-create-instance', {
        body: { action: 'check_status', instanceName: connection.instance_name, companyId: connection.company_id }
      });

      if (error) throw error;

      const providerLabel = data?.provider === 'meta' ? 'Meta API Oficial' : 'Evolution API';

      if (data?.isConnected) {
        const extraInfo = data?.verified_name ? ` (${data.verified_name})` : '';
        toast.success(`✅ ${connection.instance_name} conectada via ${providerLabel}${extraInfo}`);
        appendLog(connection.id, `Teste: conectada via ${providerLabel}${extraInfo}`);
      } else {
        const reason = data?.reason ? ` - ${data.reason}` : '';
        toast.warning(`⚠️ ${connection.instance_name} não conectada (${data?.state})${reason}`);
        appendLog(connection.id, `Teste: ${data?.state} via ${providerLabel}${reason}`);
      }
      loadConnections(); // Refresh to pick up any status updates from the check
    } catch (error: any) {
      toast.error(`❌ Erro: ${error.message}`);
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
      stopPolling();
      loadConnections();
    } catch (error: any) {
      toast.error("Erro ao remover instância");
    }
  };

  const handleSaveApi = async (conn: any) => {
    const newKey = (((editApiKeyMap[conn.id] ?? conn.evolution_api_key)) || '').trim();
    const newUrl = (((editApiUrlMap[conn.id] ?? conn.evolution_api_url)) || '').trim();
    if (!newKey || !newUrl) {
      toast.error('Preencha URL e API Key');
      return;
    }
    setSavingMap(prev => ({ ...prev, [conn.id]: true }));
    try {
      const { error } = await supabase
        .from('whatsapp_connections')
        .update({
          evolution_api_key: newKey,
          evolution_api_url: newUrl,
          status: 'connected',
          last_connected_at: new Date().toISOString()
        })
        .eq('id', conn.id);
      if (error) throw error;
      toast.success('API Key salva e conexão marcada como conectada');
      appendLog(conn.id, 'API Key/URL atualizadas');
      const ok = await configureWebhook(conn.instance_name, newUrl, newKey);
      if (ok) toast.success('Webhook configurado com sucesso');
      loadConnections();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar API Key');
    } finally {
      setSavingMap(prev => ({ ...prev, [conn.id]: false }));
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
              Conecte seu WhatsApp escaneando o QR Code automaticamente
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connections.length === 0 ? (
              <Button onClick={() => setShowNewInstance(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Conectar WhatsApp
              </Button>
            ) : null}
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
        {showNewInstance && connections.length === 0 && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <Alert className="bg-success/10 border-success">
              <AlertDescription className="text-xs">
                <strong>✅ Regra:</strong> Cada CRM/empresa pode ter apenas <strong>1</strong> instância ativa do WhatsApp.
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
                    A instância será criada automaticamente na Evolution API. Basta escanear o QR Code!
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
            {connections.slice(0, 1).map((conn) => (
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
                      size="icon"
                      onClick={() => testConnection(conn)}
                      disabled={testingConnection === conn.id}
                      title="Testar conexão"
                    >
                      {testingConnection === conn.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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

                {/* QR Code display for connecting status */}
                {conn.status === 'connecting' && (
                  <div className="mt-3 p-4 bg-background rounded-lg border border-dashed">
                    {qrCode ? (
                      <div className="flex flex-col items-center gap-3">
                        <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 mx-auto rounded-lg" />
                        <p className="text-sm text-center text-muted-foreground">
                          Abra o WhatsApp → Menu ⋯ → Aparelhos conectados → Conectar → Escaneie o QR Code
                        </p>
                        {pollingActive && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Aguardando conexão...
                          </div>
                        )}
                        <Button variant="outline" size="sm" onClick={() => refreshQRCode(conn)} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Atualizar QR Code</>}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <p className="text-sm text-muted-foreground">QR Code expirado ou não disponível</p>
                        <Button variant="outline" size="sm" onClick={() => refreshQRCode(conn)} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4 mr-1" /> Gerar novo QR Code</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* API config for connected/manual */}
                {conn.status !== 'connecting' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                    <div>
                      <Label className="text-xs">Evolution API URL</Label>
                      <Input
                        placeholder="https://sua-api"
                        value={editApiUrlMap[conn.id] ?? conn.evolution_api_url ?? ''}
                        onChange={(e) => setEditApiUrlMap(prev => ({ ...prev, [conn.id]: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Evolution API Key</Label>
                      <Input
                        type="password"
                        placeholder="••••••••••"
                        value={editApiKeyMap[conn.id] ?? conn.evolution_api_key ?? ''}
                        onChange={(e) => setEditApiKeyMap(prev => ({ ...prev, [conn.id]: e.target.value }))}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button onClick={() => handleSaveApi(conn)} disabled={!!savingMap[conn.id]} className="flex-1">
                        {savingMap[conn.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          const key = (((editApiKeyMap[conn.id] ?? conn.evolution_api_key)) || '').trim();
                          const url = (((editApiUrlMap[conn.id] ?? conn.evolution_api_url)) || '').trim();
                          if (!key || !url) { toast.error('Preencha URL e API Key'); return; }
                          const ok = await configureWebhook(conn.instance_name, url, key);
                          if (ok) toast.success('Webhook configurado'); else toast.error('Falha ao configurar webhook');
                        }}
                      >
                        Webhook
                      </Button>
                    </div>
                  </div>
                )}
                
                {conn.last_connected_at && (
                  <p className="text-xs text-muted-foreground">
                    Última conexão: {new Date(conn.last_connected_at).toLocaleString('pt-BR')}
                  </p>
                )}

                {/* Logs */}
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
                <p className="text-sm">Clique em "Conectar WhatsApp" para começar</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t space-y-3">
          <Alert className="bg-success/10 border-success">
            <AlertDescription className="text-xs space-y-2">
              <p>
                <strong>✅ Automático:</strong> Ao clicar em "Gerar QR Code", a instância é criada automaticamente na Evolution API. Basta escanear!
              </p>
              <p>
                <strong>🔍 Teste:</strong> Use o botão ↻ para verificar se a conexão está ativa.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
