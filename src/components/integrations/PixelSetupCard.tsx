import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MousePointerClick, Copy, Check, ChevronDown, ExternalLink, Code } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PixelSetupCardProps {
  companyId: string;
}

export default function PixelSetupCard({ companyId }: PixelSetupCardProps) {
  const [pixelId, setPixelId] = useState("");
  const [savedPixelId, setSavedPixelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [snippetData, setSnippetData] = useState<{ js_snippet: string; webhook_url: string } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      const { data } = await supabase
        .from('tenant_integrations')
        .select('pixel_id')
        .eq('company_id', companyId)
        .single();
      
      if (data?.pixel_id) {
        setSavedPixelId(data.pixel_id);
        setPixelId(data.pixel_id);
      }
    };
    fetchConfig();
  }, [companyId]);

  const handleSavePixelId = async () => {
    if (!pixelId.trim()) {
      toast.error("Informe o Pixel ID");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tenant_integrations')
        .update({ pixel_id: pixelId.trim() })
        .eq('company_id', companyId);

      if (error) {
        // Try insert if update failed
        await supabase
          .from('tenant_integrations')
          .insert({ company_id: companyId, pixel_id: pixelId.trim() });
      }

      setSavedPixelId(pixelId.trim());
      toast.success("Pixel ID salvo com sucesso!");
      
      // Fetch snippet
      fetchSnippet();
    } catch (err) {
      console.error('Error saving pixel_id:', err);
      toast.error("Erro ao salvar Pixel ID");
    } finally {
      setLoading(false);
    }
  };

  const fetchSnippet = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-conversions-api?company_id=${companyId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setSnippetData(data);
    } catch (err) {
      console.error('Error fetching snippet:', err);
    }
  };

  useEffect(() => {
    if (savedPixelId) {
      fetchSnippet();
    }
  }, [savedPixelId]);

  const copySnippet = () => {
    if (snippetData?.js_snippet) {
      navigator.clipboard.writeText(snippetData.js_snippet);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-0 shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <MousePointerClick className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">Meta Pixel & Conversions API</CardTitle>
              <CardDescription>
                Rastreie conversões do seu site e envie para o Meta
              </CardDescription>
            </div>
          </div>
          {savedPixelId && (
            <Badge variant="default" className="bg-green-500">Configurado</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pixel_id">Pixel ID</Label>
          <div className="flex gap-2">
            <Input
              id="pixel_id"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value)}
              placeholder="Ex: 1234567890123456"
            />
            <Button onClick={handleSavePixelId} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Encontre seu Pixel ID em{" "}
            <a 
              href="https://business.facebook.com/events_manager" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Events Manager <ExternalLink className="inline h-3 w-3" />
            </a>
          </p>
        </div>

        {savedPixelId && snippetData && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <div className="flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Código de Instalação
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Adicione este código ao seu site</Label>
                  <Button variant="ghost" size="sm" onClick={copySnippet}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64">
                  <code>{snippetData.js_snippet}</code>
                </pre>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium text-sm">Eventos suportados:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• <code className="bg-background px-1 rounded">Lead</code> - Quando um formulário é preenchido</li>
                  <li>• <code className="bg-background px-1 rounded">CompleteRegistration</code> - Cadastro completo</li>
                  <li>• <code className="bg-background px-1 rounded">Purchase</code> - Compra realizada</li>
                  <li>• <code className="bg-background px-1 rounded">AddToCart</code> - Adicionou ao carrinho</li>
                  <li>• <code className="bg-background px-1 rounded">ViewContent</code> - Visualizou produto</li>
                </ul>
              </div>

              <div className="text-xs text-muted-foreground">
                <p className="font-medium mb-1">Exemplo de uso:</p>
                <pre className="bg-background p-2 rounded">
{`// Ao enviar formulário de contato
trackServerEvent('Lead', {
  email: 'cliente@email.com',
  phone: '11999999999',
  fn: 'Nome do Cliente'
});`}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
