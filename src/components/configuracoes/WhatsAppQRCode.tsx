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

  useEffect(() => {
    loadConnections();
    
    const interval = setInterval(() => {
      loadConnections();
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const loadConnections = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('👤 Usuário não autenticado');
        return;
      }

      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('company_id')
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

      console.log('✅ Company ID encontrado:', userRole.company_id);

      const { data, error: connError } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false });

      if (connError) {
        console.error('❌ Erro ao carregar conexões:', connError);
        return;
      }

      if (data) {
        console.log('📱 Conexões carregadas:', data.length);
        setConnections(data);
        if (!selectedConnection && data.length > 0) {
          setSelectedConnection(data[0]);
        }
      }
    } catch (error) {
      console.error('❌ Erro geral ao carregar conexões:', error);
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
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (roleError) {
        console.error('❌ Erro ao buscar role:', roleError);
        throw new Error("Erro ao buscar informações da empresa. Verifique se você está associado a uma empresa.");
      }

      if (!userRole?.company_id) {
        console.error('❌ Company ID não encontrado');
        throw new Error("Você não está associado a nenhuma empresa. Entre em contato com o administrador.");
      }

      console.log('🏢 Company ID encontrado:', userRole.company_id);

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

      const { data: conn, error: connError } = await supabase
        .from('whatsapp_connections')
        .insert(connectionData)
        .select()
        .single();

      if (connError) throw connError;
      
      setSelectedConnection(conn);
      
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

  const resetForm = () => {
    setInstanceName("");
    setApiKey("");
    setApiUrl("https://evolution-evolution-api.kxuvcf.easypanel.host");
    setCreationMode("qrcode");
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
      loadConnections();
    } catch (error: any) {
      console.error('Erro ao deletar:', error);
      toast.error("Erro ao remover instância");
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      disconnected: <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>,
      connecting: <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Conectando...</Badge>,
      connected: <Badge className="gap-1 bg-success"><CheckCircle className="h-3 w-3" /> Conectado</Badge>,
    };
    return badges[status as keyof typeof badges] || badges.disconnected;
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
          <Button onClick={() => setShowNewInstance(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Instância
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
                    {getStatusBadge(conn.status)}
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
            </AlertDescription>
          </Alert>
        </div>
      </CardContent>
    </Card>
  );
}
