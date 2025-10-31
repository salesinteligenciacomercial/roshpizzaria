import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportarLeadsDialogProps {
  onLeadsImported: () => void;
}

export function ImportarLeadsDialog({ onLeadsImported }: ImportarLeadsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importReport, setImportReport] = useState<{
    total: number;
    success: number;
    errors: { line: number; errors: string[] }[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error("Apenas arquivos CSV são suportados no momento");
      return;
    }

    setFile(selectedFile);
    setImportReport(null); // Reset report when new file is selected
    processFile(selectedFile);
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        toast.error("Arquivo CSV vazio ou inválido");
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());

      const previewData = lines.slice(1, 6).map(line => {
        const values = parseCSVLine(line);
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index] || '';
        });
        return obj;
      });

      setPreview(previewData);
      setImportReport(null); // Reset report when new file is selected
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Funções de validação robustas
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): { isValid: boolean; formatted?: string } => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10 || cleaned.length > 11) {
      return { isValid: false };
    }

    let formatted = cleaned;
    if (!formatted.startsWith("55")) {
      formatted = "55" + formatted;
    }

    return { isValid: true, formatted };
  };

  const validateValue = (value: string): { isValid: boolean; parsed?: number } => {
    const cleaned = value.replace(/[^0-9,.-]+/g, "").replace(',', '.');
    const parsed = parseFloat(cleaned);

    if (isNaN(parsed) || parsed < 0) {
      return { isValid: false };
    }

    return { isValid: true, parsed };
  };

  const validateLead = (lead: any, lineNumber: number): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validação obrigatória: nome
    if (!lead.name || lead.name.trim().length === 0) {
      errors.push("Nome é obrigatório");
    }

    // Validação de email se fornecido
    if (lead.email && lead.email.trim()) {
      if (!validateEmail(lead.email.trim())) {
        errors.push("Email inválido");
      }
    }

    // Validação de telefone se fornecido
    if (lead.telefone && lead.telefone.trim()) {
      const phoneValidation = validatePhone(lead.telefone.trim());
      if (!phoneValidation.isValid) {
        errors.push("Telefone inválido (deve ter 10-11 dígitos)");
      } else {
        lead.telefone = phoneValidation.formatted;
        lead.phone = phoneValidation.formatted;
      }
    }

    // Validação de valor se fornecido
    if (lead.value !== undefined && lead.value !== null && lead.value !== '') {
      const valueValidation = validateValue(String(lead.value));
      if (!valueValidation.isValid) {
        errors.push("Valor inválido (deve ser um número positivo)");
      } else {
        lead.value = valueValidation.parsed;
      }
    }

    return { isValid: errors.length === 0, errors };
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do usuário com tratamento de erro explícito
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        toast.error("Não foi possível verificar sua empresa. Tente novamente ou contate o suporte.");
        return;
      }

      if (!userRole?.company_id) {
        toast.error("Sua conta não está vinculada a uma empresa. Solicite configuração ao administrador.");
        return;
      }

      // Buscar primeiro funil do usuário
      const { data: funis } = await supabase
        .from("funis")
        .select("id")
        .eq("company_id", userRole.company_id)
        .limit(1);

      if (!funis || funis.length === 0) {
        toast.error("Crie um funil antes de importar leads");
        setLoading(false);
        return;
      }

      const funilId = funis[0].id;

      // Buscar primeira etapa do funil
      const { data: etapas } = await supabase
        .from("etapas")
        .select("id")
        .eq("funil_id", funilId)
        .order("posicao", { ascending: true })
        .limit(1);

      if (!etapas || etapas.length === 0) {
        toast.error("Crie etapas no funil antes de importar leads");
        setLoading(false);
        return;
      }

      const etapaId = etapas[0].id;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

        const processedLeads = lines.slice(1)
          .map((line, index) => {
            const values = parseCSVLine(line);
            const lead: any = {
              owner_id: user.id,
              company_id: userRole.company_id,
              funil_id: funilId,
              etapa_id: etapaId,
              status: 'novo',
              stage: 'prospeccao',
              value: 0,
            };

            headers.forEach((header, colIndex) => {
              const value = values[colIndex]?.trim().replace(/^["']|["']$/g, '');
              if (!value) return;

              // Mapear colunas do CSV para campos do banco
              switch (header) {
                case 'nome':
                case 'name':
                  lead.name = value;
                  break;
                case 'telefone':
                case 'phone':
                case 'whatsapp':
                case 'celular':
                  lead.telefone = value; // Será validado depois
                  break;
                case 'email':
                case 'e-mail':
                  lead.email = value.toLowerCase();
                  break;
                case 'cpf':
                  lead.cpf = value.replace(/\D/g, "");
                  break;
                case 'empresa':
                case 'company':
                  lead.company = value;
                  break;
                case 'origem':
                case 'source':
                case 'fonte':
                  lead.source = value;
                  break;
                case 'valor':
                case 'value':
                case 'ticket':
                  lead.value = value; // Será validado depois
                  break;
                case 'status':
                  const statusValido = ['novo', 'em_contato', 'qualificado', 'negociacao', 'ganho', 'perdido'];
                  const statusNormalizado = value.toLowerCase().replace(/\s+/g, '_');
                  if (statusValido.includes(statusNormalizado)) {
                    lead.status = statusNormalizado;
                  }
                  break;
                case 'servico':
                case 'service':
                case 'produto':
                  lead.servico = value;
                  break;
                case 'segmentacao':
                case 'segmento':
                case 'categoria':
                  lead.segmentacao = value;
                  break;
                case 'tags':
                case 'tag':
                case 'etiquetas':
                  const tagsArray = value.includes(';')
                    ? value.split(';')
                    : value.includes(',')
                    ? value.split(',')
                    : [value];
                  lead.tags = tagsArray.map((t: string) => t.trim()).filter((t: string) => t);
                  break;
                case 'observacoes':
                case 'notes':
                case 'nota':
                case 'observacao':
                  lead.notes = value;
                  break;
              }
            });

            return { lead, lineNumber: index + 2 }; // +2 porque começa na linha 1 (headers) + 1 para index 0
          });

        // Validar todos os leads e separar válidos dos inválidos
        const validationResults = processedLeads.map(({ lead, lineNumber }) => ({
          lead,
          lineNumber,
          validation: validateLead(lead, lineNumber)
        }));

        const validLeads = validationResults
          .filter(result => result.validation.isValid)
          .map(result => result.lead);

        const errors = validationResults
          .filter(result => !result.validation.isValid)
          .map(result => ({
            line: result.lineNumber,
            errors: result.validation.errors
          }));

        // Criar relatório de importação
        const report = {
          total: processedLeads.length,
          success: validLeads.length,
          errors
        };

        setImportReport(report);

        if (validLeads.length === 0) {
          toast.error("Nenhum lead válido encontrado no arquivo. Verifique os erros abaixo.");
          return;
        }

        // Importar apenas leads válidos
        const { error } = await supabase
          .from("leads")
          .insert(validLeads);

        if (error) throw error;

        // Mostrar resultado da importação
        if (errors.length === 0) {
          toast.success(`${validLeads.length} leads importados com sucesso!`);
        } else {
          toast.warning(`${validLeads.length} leads importados. ${errors.length} linhas com erros foram ignoradas.`);
        }

        setOpen(false);
        setFile(null);
        setPreview([]);
        onLeadsImported();
      };

      reader.readAsText(file);
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar leads");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) {
        setFile(null);
        setPreview([]);
        setImportReport(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Leads</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Formato do arquivo CSV:</strong>
              <br />
              <strong>Obrigatório:</strong> nome
              <br />
              <strong>Opcionais:</strong> telefone, email, cpf, empresa, origem, valor, status, servico, segmentacao, tags, observacoes
              <br />
              • Separe múltiplas tags com ponto e vírgula (;) ou vírgula (,)
              <br />
              • O telefone será formatado automaticamente com código do Brasil (+55)
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo CSV</Label>
            <Input
              id="file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Prévia (primeiras 5 linhas)</Label>
              <div className="border rounded-lg p-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {Object.keys(preview[0]).map((key) => (
                        <th key={key} className="text-left p-2 border-b">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((value: any, j) => (
                          <td key={j} className="p-2 border-b">
                            {value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importReport && (
            <div className="space-y-2">
              <Label>Relatório de Importação</Label>
              <div className="border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{importReport.total}</div>
                    <div className="text-sm text-blue-800">Total de linhas</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importReport.success}</div>
                    <div className="text-sm text-green-800">Importados</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importReport.errors.length}</div>
                    <div className="text-sm text-red-800">Com erros</div>
                  </div>
                </div>

                {importReport.errors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-red-600">Linhas com erros:</Label>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importReport.errors.map((error, index) => (
                        <div key={index} className="bg-red-50 p-2 rounded border-l-4 border-red-400">
                          <div className="font-medium text-red-800">Linha {error.line}:</div>
                          <ul className="text-sm text-red-700 ml-4">
                            {error.errors.map((err, i) => (
                              <li key={i}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={!file || loading}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {loading ? "Importando..." : "Importar Leads"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
