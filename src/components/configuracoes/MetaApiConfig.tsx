import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Save, CheckCircle, AlertCircle, ExternalLink, Copy, Eye, EyeOff } from 'lucide-react';

interface MetaApiConfigProps {
  companyId: string;
}

interface WhatsAppConnection {
  id: string;
  instance_name: string;
  api_provider: 'evolution' | 'meta' | 'both';
  meta_phone_number_id: string | null;
  meta_access_token: string | null;
  meta_webhook_verify_token: string | null;
  meta_business_account_id: string | null;
  status: string | null;
}

export function MetaApiConfig({ companyId }: MetaApiConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connection, setConnection] = useState<WhatsAppConnection | null>(null);
  const [showToken, setShowToken] = useState(false);
  
  const [formData, setFormData] = useState({
    api_provider: 'evolution' as 'evolution' | 'meta' | 'both',
    meta_phone_number_id: '',
    meta_access_token: '',
    meta_webhook_verify_token: '',
    meta_business_account_id: '',
  });

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-meta`;

  useEffect(() => {
    loadConnection();
  }, [companyId]);

  const loadConnection = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConnection(data as WhatsAppConnection);
        setFormData({
          api_provider: (data.api_provider as 'evolution' | 'meta' | 'both') || 'evolution',
          meta_phone_number_id: data.meta_phone_number_id || '',
          meta_access_token: data.meta_access_token || '',
          meta_webhook_verify_token: data.meta_webhook_verify_token || '',
          meta_business_account_id: data.meta_business_account_id || '',
        });
      }
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Validações baseadas no provider selecionado
      if (formData.api_provider === 'meta' || formData.api_provider === 'both') {
        if (!formData.meta_phone_number_id || !formData.meta_access_token) {
          toast.error('Phone Number ID e Access Token são obrigatórios para Meta API');
          return;
        }
      }

      // Gerar token de verificação se não existir
      let webhookVerifyToken = formData.meta_webhook_verify_token;
      if (!webhookVerifyToken && (formData.api_provider === 'meta' || formData.api_provider === 'both')) {
        webhookVerifyToken = crypto.randomUUID();
        setFormData(prev => ({ ...prev, meta_webhook_verify_token: webhookVerifyToken }));
      }

      const updateData = {
        api_provider: formData.api_provider,
        meta_phone_number_id: formData.meta_phone_number_id || null,
        meta_access_token: formData.meta_access_token || null,
        meta_webhook_verify_token: webhookVerifyToken || null,
        meta_business_account_id: formData.meta_business_account_id || null,
        updated_at: new Date().toISOString(),
      };

      if (connection) {
        const { error } = await supabase
          .from('whatsapp_connections')
          .update(updateData)
          .eq('id', connection.id);

        if (error) throw error;
      } else {
        // Criar nova conexão se não existir
        const { error } = await supabase
          .from('whatsapp_connections')
          .insert({
            ...updateData,
            company_id: companyId,
            instance_name: 'meta-' + companyId.slice(0, 8),
            status: 'pending',
          });

        if (error) throw error;
      }

      toast.success('Configuração salva com sucesso!');
      loadConnection();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" className="h-6 w-6" alt="WhatsApp" />
          Configuração da API do WhatsApp
        </CardTitle>
        <CardDescription>
          Configure qual API de WhatsApp utilizar: Evolution API, Meta Business API ou ambas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Seleção de Provider */}
        <div className="space-y-2">
          <Label>Provedor de API</Label>
          <Select
            value={formData.api_provider}
            onValueChange={(value: 'evolution' | 'meta' | 'both') => 
              setFormData(prev => ({ ...prev, api_provider: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="evolution">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                    Evolution API
                  </Badge>
                  <span className="text-muted-foreground text-sm">- Não oficial, flexível</span>
                </div>
              </SelectItem>
              <SelectItem value="meta">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    Meta Business API
                  </Badge>
                  <span className="text-muted-foreground text-sm">- Oficial, estável</span>
                </div>
              </SelectItem>
              <SelectItem value="both">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                    Ambas APIs
                  </Badge>
                  <span className="text-muted-foreground text-sm">- Fallback automático</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {formData.api_provider === 'evolution' && 'Usando apenas Evolution API (configuração atual)'}
            {formData.api_provider === 'meta' && 'Usando apenas Meta Business API oficial'}
            {formData.api_provider === 'both' && 'Tenta Meta API primeiro, com fallback para Evolution'}
          </p>
        </div>

        {/* Campos Meta API */}
        {(formData.api_provider === 'meta' || formData.api_provider === 'both') && (
          <>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-4 flex items-center gap-2">
                <Badge className="bg-blue-500">Meta</Badge>
                Configuração Meta Business API
              </h4>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_phone_number_id">Phone Number ID *</Label>
                  <Input
                    id="meta_phone_number_id"
                    placeholder="Ex: 123456789012345"
                    value={formData.meta_phone_number_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_phone_number_id: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encontre em: Meta Business Suite → WhatsApp → Configurações da API
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_access_token">Access Token *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="meta_access_token"
                      type={showToken ? 'text' : 'password'}
                      placeholder="Token de acesso permanente"
                      value={formData.meta_access_token}
                      onChange={(e) => setFormData(prev => ({ ...prev, meta_access_token: e.target.value }))}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowToken(!showToken)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gere um token permanente no painel de desenvolvedores do Meta
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meta_business_account_id">Business Account ID</Label>
                  <Input
                    id="meta_business_account_id"
                    placeholder="Ex: 123456789012345"
                    value={formData.meta_business_account_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, meta_business_account_id: e.target.value }))}
                  />
                </div>

                {/* Webhook Configuration */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h5 className="font-medium text-sm">Configuração do Webhook</h5>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">URL do Webhook</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={webhookUrl} 
                        readOnly 
                        className="font-mono text-xs bg-background"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(webhookUrl, 'URL')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Token de Verificação</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={formData.meta_webhook_verify_token || 'Será gerado ao salvar'} 
                        readOnly 
                        className="font-mono text-xs bg-background"
                      />
                      {formData.meta_webhook_verify_token && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => copyToClipboard(formData.meta_webhook_verify_token, 'Token')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Configure estes valores no painel de desenvolvedores do Meta em: 
                    App → WhatsApp → Configuração → Webhook
                  </p>
                </div>
              </div>
            </div>

            {/* Link para documentação */}
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
              <a 
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Documentação Meta WhatsApp Business API
              </a>
            </div>
          </>
        )}

        {/* Status atual */}
        {connection && (
          <div className="flex items-center gap-2 text-sm">
            {connection.status === 'connected' ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Conexão ativa</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-yellow-600">Pendente de configuração</span>
              </>
            )}
            <Badge variant="outline" className="ml-2">
              {connection.api_provider?.toUpperCase() || 'EVOLUTION'}
            </Badge>
          </div>
        )}

        {/* Botão Salvar */}
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
