import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle, CheckCircle2, Video, Image, FileText, LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TemplatePreview } from "@/components/whatsapp/TemplatePreview";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
}

interface TemplateSelectorProps {
  companyId: string;
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template | null) => void;
  templateVariables: Record<string, string>;
  onVariablesChange: (variables: Record<string, string>) => void;
  mediaUrl?: string;
  onMediaUrlChange?: (url: string) => void;
  disabled?: boolean;
}

export function TemplateSelector({
  companyId,
  selectedTemplate,
  onSelectTemplate,
  templateVariables,
  onVariablesChange,
  mediaUrl = "",
  onMediaUrlChange,
  disabled = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApprovedTemplates();
  }, [companyId]);

  const loadApprovedTemplates = async () => {
    if (!companyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("company_id", companyId)
        .eq("status", "APPROVED")
        .order("name");

      if (fetchError) throw fetchError;
      
      setTemplates((data || []) as Template[]);
    } catch (err: any) {
      console.error("Erro ao carregar templates:", err);
      setError("Erro ao carregar templates aprovados");
    } finally {
      setLoading(false);
    }
  };

  // Extrair variáveis do template selecionado
  const extractVariables = (template: Template): string[] => {
    const variables: string[] = [];
    
    if (!template.components) return variables;
    
    template.components.forEach((component: any) => {
      if (component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach((match: string) => {
            const varNum = match.replace(/[{}]/g, '');
            if (!variables.includes(varNum)) {
              variables.push(varNum);
            }
          });
        }
      }
    });
    
    return variables.sort((a, b) => parseInt(a) - parseInt(b));
  };

  // Verificar se template tem header de mídia (VIDEO, IMAGE, DOCUMENT)
  const getMediaHeader = (template: Template): { format: string; hasHandle: boolean } | null => {
    if (!template.components) return null;
    
    const header = template.components.find((c: any) => c.type === "HEADER");
    if (!header || !header.format || header.format === "TEXT") return null;
    
    const hasHandle = !!(header.example?.header_handle?.[0]);
    return { format: header.format, hasHandle };
  };

  const mediaHeader = selectedTemplate ? getMediaHeader(selectedTemplate) : null;

  const handleTemplateChange = (templateId: string) => {
    if (templateId === "none") {
      onSelectTemplate(null);
      onVariablesChange({});
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (template) {
      onSelectTemplate(template);
      
      // Inicializar variáveis com valores padrão
      const vars = extractVariables(template);
      const defaultVars: Record<string, string> = {};
      vars.forEach((v, index) => {
        // Sugerir valores padrão baseados na posição
        if (index === 0) defaultVars[v] = "{{nome}}"; // Nome do lead
        else defaultVars[v] = "";
      });
      onVariablesChange(defaultVars);
    }
  };

  const handleVariableChange = (varNum: string, value: string) => {
    onVariablesChange({
      ...templateVariables,
      [varNum]: value,
    });
  };

  const variables = selectedTemplate ? extractVariables(selectedTemplate) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando templates aprovados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        <AlertCircle className="h-5 w-5 mr-2" />
        <span>{error}</span>
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="p-6 text-center border rounded-lg bg-muted/50">
        <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-muted-foreground mb-2">
          Nenhum template aprovado encontrado
        </p>
        <p className="text-xs text-muted-foreground">
          Crie e aprove templates no WhatsApp Business Manager para usá-los aqui
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor de Template */}
      <div className="space-y-2">
        <Label className="font-semibold">Selecionar Template Aprovado</Label>
        <Select
          value={selectedTemplate?.id || "none"}
          onValueChange={handleTemplateChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha um template..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum (selecionar)</SelectItem>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                <div className="flex items-center gap-2">
                  <span>{template.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {template.category}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {template.language}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? "s" : ""} aprovado{templates.length !== 1 ? "s" : ""} disponíve{templates.length !== 1 ? "is" : "l"}
        </p>
      </div>

      {/* Preview e Variáveis */}
      {selectedTemplate && (
        <div className="space-y-4">
          {/* Alerta para mídia do header */}
          {mediaHeader && !mediaHeader.hasHandle && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <Video className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <strong>Template com {mediaHeader.format === "VIDEO" ? "Vídeo" : mediaHeader.format === "IMAGE" ? "Imagem" : "Documento"}:</strong>{" "}
                Este template requer uma URL de mídia pública para o cabeçalho. 
                Informe a URL abaixo.
              </AlertDescription>
            </Alert>
          )}

          {/* Input de URL de mídia para header */}
          {mediaHeader && !mediaHeader.hasHandle && onMediaUrlChange && (
            <Card className="p-4 border-amber-500/30">
              <Label className="font-semibold mb-2 block flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                URL da Mídia do Cabeçalho ({mediaHeader.format})
              </Label>
              <Input
                placeholder={`https://exemplo.com/${mediaHeader.format.toLowerCase()}.${mediaHeader.format === "VIDEO" ? "mp4" : mediaHeader.format === "IMAGE" ? "jpg" : "pdf"}`}
                value={mediaUrl}
                onChange={(e) => onMediaUrlChange(e.target.value)}
                disabled={disabled}
                className="mb-2"
              />
              <p className="text-xs text-muted-foreground">
                A URL deve ser pública e acessível. Formatos suportados:{" "}
                {mediaHeader.format === "VIDEO" ? "MP4, 3GPP (máx 16MB)" : 
                 mediaHeader.format === "IMAGE" ? "JPEG, PNG (máx 5MB)" : 
                 "PDF, DOC, XLS, PPT (máx 100MB)"}
              </p>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Preview do Template */}
            <Card className="p-4">
              <Label className="font-semibold mb-3 block">Preview do Template</Label>
              <TemplatePreview 
                components={selectedTemplate.components || []} 
                name={selectedTemplate.name}
              />
            </Card>

            {/* Variáveis Dinâmicas */}
            <Card className="p-4">
              <Label className="font-semibold mb-3 block">Variáveis Dinâmicas</Label>
              
              {variables.length === 0 && !mediaHeader ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">Este template não possui variáveis</p>
                  <p className="text-xs mt-1">O texto será enviado como está</p>
                </div>
              ) : variables.length === 0 && mediaHeader ? (
                <div className="text-center py-6 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">Este template não possui variáveis de texto</p>
                  <p className="text-xs mt-1">Apenas a mídia do cabeçalho é necessária</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Configure os valores para cada variável. Use <code className="bg-muted px-1 rounded">{"{{nome}}"}</code> para inserir o nome do lead automaticamente.
                  </p>
                  
                  {variables.map((varNum) => (
                    <div key={varNum} className="space-y-1">
                      <Label className="text-sm">
                        Variável {`{{${varNum}}}`}
                      </Label>
                      <Input
                        placeholder={`Valor para {{${varNum}}}`}
                        value={templateVariables[varNum] || ""}
                        onChange={(e) => handleVariableChange(varNum, e.target.value)}
                        disabled={disabled}
                      />
                      {varNum === "1" && (
                        <p className="text-xs text-muted-foreground">
                          Sugestão: Use {"{{nome}}"} para nome do lead
                        </p>
                      )}
                    </div>
                  ))}
                  
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Variáveis disponíveis:</strong>
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">{"{{nome}}"} = Nome do lead</Badge>
                      <Badge variant="outline" className="text-xs">{"{{telefone}}"} = Telefone</Badge>
                      <Badge variant="outline" className="text-xs">{"{{email}}"} = Email</Badge>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
