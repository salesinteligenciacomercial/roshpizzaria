import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, QrCode, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function WhatsAppQRCode() {
  const [loading, setLoading] = useState(false);
  const [connection, setConnection] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string>("");
  const [instanceName, setInstanceName] = useState("");
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");

  useEffect(() => {
    loadConnection();
    
    // Atualizar status a cada 10 segundos
    const interval = setInterval(() => {
      if (connection) {
        checkConnectionStatus();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [connection]);

  const loadConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', userRole.company_id)
        .single();

      if (data) {
        setConnection(data);
        setStatus(data.status as any);
        setInstanceName(data.instance_name);
      }
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
    }
  };

  const generateQRCode = async () => {
    if (!instanceName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }

    setLoading(true);
    setStatus("connecting");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      // Criar ou atualizar conexão
      const connectionData = {
        company_id: userRole.company_id,
        instance_name: instanceName,
        evolution_api_url: import.meta.env.VITE_EVOLUTION_API_URL || 'https://api.evolutionapi.com',
        evolution_api_key: '', // Será preenchido pela API
        status: 'connecting',
        qr_code_expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutos
      };

      const { data: conn, error: connError } = await supabase
        .from('whatsapp_connections')
        .upsert(connectionData, { onConflict: 'company_id' })
        .select()
        .single();

      if (connError) throw connError;
      setConnection(conn);

      // Simular geração de QR Code (na produção, chamaria a Evolution API)
      const mockQR = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`whatsapp-instance-${instanceName}-${Date.now()}`)}`;
      setQrCode(mockQR);

      toast.success("QR Code gerado! Escaneie com seu WhatsApp");

      // Simular checagem de status (na produção, seria polling real)
      setTimeout(() => {
        checkConnectionStatus();
      }, 30000);
    } catch (error: any) {
      console.error('Erro ao gerar QR Code:', error);
      toast.error(error.message || "Erro ao gerar QR Code");
      setStatus("disconnected");
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      if (!connection) return;

      // Na produção, faria requisição para Evolution API
      // Por ora, simular status
      const isConnected = Math.random() > 0.5;

      if (isConnected && status !== "connected") {
        const { error } = await supabase
          .from('whatsapp_connections')
          .update({ 
            status: 'connected',
            last_connected_at: new Date().toISOString(),
            whatsapp_number: '+5511999999999' // Seria retornado pela API
          })
          .eq('id', connection.id);

        if (!error) {
          setStatus("connected");
          toast.success("WhatsApp conectado com sucesso!");
          setQrCode("");
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }
  };

  const disconnectWhatsApp = async () => {
    try {
      if (!connection) return;

      const { error } = await supabase
        .from('whatsapp_connections')
        .update({ 
          status: 'disconnected',
          qr_code: null,
          whatsapp_number: null
        })
        .eq('id', connection.id);

      if (error) throw error;

      setStatus("disconnected");
      setQrCode("");
      setConnection(null);
      toast.success("WhatsApp desconectado");
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast.error("Erro ao desconectar");
    }
  };

  const getStatusBadge = () => {
    const badges = {
      disconnected: <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Desconectado</Badge>,
      connecting: <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Conectando...</Badge>,
      connected: <Badge className="gap-1 bg-success"><CheckCircle className="h-3 w-3" /> Conectado</Badge>,
    };
    return badges[status];
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-success" />
              Conexão WhatsApp
            </CardTitle>
            <CardDescription>
              Conecte seu WhatsApp via QR Code usando Evolution API
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "disconnected" && (
          <>
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input
                placeholder="Ex: empresa-whatsapp"
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Escolha um nome único para identificar esta conexão
              </p>
            </div>
            <Button 
              onClick={generateQRCode} 
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Gerar QR Code
                </>
              )}
            </Button>
          </>
        )}

        {status === "connecting" && qrCode && (
          <div className="space-y-4">
            <div className="p-6 bg-muted/50 rounded-lg flex flex-col items-center gap-4">
              <img 
                src={qrCode} 
                alt="QR Code WhatsApp" 
                className="w-64 h-64 border-4 border-white shadow-lg rounded-lg"
              />
              <div className="text-center space-y-2">
                <p className="font-medium">Escaneie este QR Code com seu WhatsApp</p>
                <p className="text-sm text-muted-foreground">
                  1. Abra o WhatsApp no seu celular<br/>
                  2. Toque em Menu ou Configurações<br/>
                  3. Toque em Aparelhos conectados<br/>
                  4. Toque em Conectar um aparelho<br/>
                  5. Aponte seu celular para esta tela
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={generateQRCode}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Gerar Novo QR Code
            </Button>
          </div>
        )}

        {status === "connected" && connection && (
          <div className="space-y-4">
            <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">WhatsApp Conectado!</span>
              </div>
              <div className="space-y-1 text-sm">
                <p><strong>Instância:</strong> {connection.instance_name}</p>
                {connection.whatsapp_number && (
                  <p><strong>Número:</strong> {connection.whatsapp_number}</p>
                )}
                {connection.last_connected_at && (
                  <p><strong>Conectado em:</strong> {new Date(connection.last_connected_at).toLocaleString('pt-BR')}</p>
                )}
              </div>
            </div>
            <Button 
              variant="destructive" 
              onClick={disconnectWhatsApp}
              className="w-full"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Desconectar WhatsApp
            </Button>
          </div>
        )}

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Importante:</strong> A conexão WhatsApp é única por empresa. 
            Certifique-se de não usar o mesmo número em múltiplos dispositivos.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
