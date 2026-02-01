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
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TemplatePreview } from "@/components/whatsapp/TemplatePreview";

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
  disabled?: boolean;
}

export function TemplateSelector({
  companyId,
  selectedTemplate,
  onSelectTemplate,
  templateVariables,
  onVariablesChange,
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
            
            {variables.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">Este template não possui variáveis</p>
                <p className="text-xs mt-1">O texto será enviado como está</p>
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
      )}
    </div>
  );
}
