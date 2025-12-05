import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { robustFormatPhoneNumber } from "@/utils/phoneFormatter";
import * as XLSX from "xlsx";

interface ImportarLeadsDialogProps {
  onLeadsImported: () => void;
}

export function ImportarLeadsDialog({ onLeadsImported }: ImportarLeadsDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [importTags, setImportTags] = useState<string>("");
  const [importReport, setImportReport] = useState<{
    total: number;
    success: number;
    duplicates: number;
    errors: { line: number; errors: string[] }[];
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();
    const supportedFormats = ['csv', 'tsv', 'xlsx', 'xls', 'ods', 'txt'];
    
    if (!fileExtension || !supportedFormats.includes(fileExtension)) {
      toast.error(`Formato não suportado. Use: CSV, TSV, XLSX, XLS, ODS ou TXT`);
      return;
    }

    console.log(`📁 Arquivo selecionado: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`);
    setFile(selectedFile);
    setImportReport(null);
    processFile(selectedFile);
  };

  const parseCSVLine = (line: string, delimiter: string = ','): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^["']|["']$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^["']|["']$/g, ''));
    return result.filter((_, i) => i === 0 || result[i] !== '' || i < result.length - 1);
  };

  const parseTSVLine = (line: string): string[] => {
    return parseCSVLine(line, '\t');
  };

  const readExcelFile = async (file: File): Promise<{ headers: string[]; rows: string[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][];
          
          if (jsonData.length < 1) {
            reject(new Error("Arquivo Excel vazio"));
            return;
          }

          // Primeira linha são os headers
          const headers = jsonData[0].map((h: any) => String(h || '').toLowerCase().trim());
          const rows = jsonData.slice(1).map(row => row.map(cell => String(cell || '').trim()));

          resolve({ headers, rows });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileWithEncoding = (file: File, encoding: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error(`Erro ao ler arquivo com encoding ${encoding}`));
      reader.readAsText(file, encoding);
    });
  };

  const processFile = async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    console.log(`📂 Processando arquivo: ${file.name} (${fileExtension})`);

    try {
      if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'ods') {
        console.log("📊 Lendo arquivo Excel...");
        const { headers, rows } = await readExcelFile(file);
        console.log(`✅ Excel processado: ${headers.length} colunas, ${rows.length} linhas`);
        const previewData = rows.slice(0, 5).map(row => {
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || '';
          });
          return obj;
        });
        setPreview(previewData);
      } else {
        // CSV ou TSV - tenta múltiplas codificações
        console.log("📄 Lendo arquivo CSV/TSV...");
        
        let text = '';
        const encodings = ['UTF-8', 'ISO-8859-1', 'windows-1252'];
        
        for (const encoding of encodings) {
          try {
            text = await readFileWithEncoding(file, encoding);
            // Verifica se tem caracteres estranhos (indica encoding errado)
            if (!text.includes('�') && text.length > 0) {
              console.log(`✅ Arquivo lido com encoding: ${encoding}`);
              break;
            }
          } catch (e) {
            console.warn(`⚠️ Falha com encoding ${encoding}, tentando próximo...`);
          }
        }

        if (!text || text.trim().length === 0) {
          toast.error("Não foi possível ler o arquivo. Verifique se não está vazio ou corrompido.");
          return;
        }

        const delimiter = fileExtension === 'tsv' ? '\t' : detectDelimiter(text);
        console.log(`🔍 Delimitador detectado: "${delimiter === '\t' ? 'TAB' : delimiter}"`);
        
        const lines = text.split(/\r?\n/).filter(line => line.trim());
        console.log(`📝 Total de linhas encontradas: ${lines.length}`);

        if (lines.length < 1) {
          toast.error("Arquivo vazio ou inválido");
          return;
        }

        const firstLineValues = parseCSVLine(lines[0], delimiter);
        console.log(`📋 Primeira linha (${firstLineValues.length} valores):`, firstLineValues);
        
        const hasHeaders = firstLineValues.some(val => {
          const cleaned = val.replace(/\D/g, '');
          return isNaN(Number(cleaned)) || cleaned.length < 8;
        });
        
        let headers: string[];
        let dataStartIndex: number;

        if (hasHeaders) {
          headers = firstLineValues.map(h => h.toLowerCase().trim());
          dataStartIndex = 1;
          console.log("📌 Cabeçalhos detectados:", headers);
        } else {
          headers = firstLineValues.map((_, i) => `coluna${i + 1}`);
          dataStartIndex = 0;
          console.log("📌 Sem cabeçalhos, usando genéricos:", headers);
        }

        const previewData = lines.slice(dataStartIndex, dataStartIndex + 5).map(line => {
          const values = parseCSVLine(line, delimiter);
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });

        console.log(`✅ Preview gerado: ${previewData.length} linhas`);
        setPreview(previewData);
      }
    } catch (error: any) {
      console.error("❌ Erro ao processar arquivo:", error);
      toast.error(`Erro ao processar arquivo: ${error.message}`);
    }
  };

  // Detecta o delimitador mais provável do CSV
  const detectDelimiter = (text: string): string => {
    const firstLine = text.split(/\r?\n/)[0] || '';
    const delimiters = [',', ';', '\t', '|'];
    let bestDelimiter = ',';
    let maxCount = 0;

    for (const d of delimiters) {
      const count = (firstLine.match(new RegExp(d === '|' ? '\\|' : d, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }

    return bestDelimiter;
  };

  // Funções de validação
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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

    // Validação obrigatória: telefone
    if (!lead.telefone || !lead.telefone.trim()) {
      errors.push("Telefone é obrigatório");
    } else {
      const phoneValidation = robustFormatPhoneNumber(lead.telefone.trim());
      if (!phoneValidation.isValid) {
        errors.push("Telefone inválido (deve ter formato válido de telefone brasileiro)");
      } else {
        lead.telefone = phoneValidation.formatted;
        lead.phone = phoneValidation.formatted;
      }
    }

    // Nome é opcional, mas se não tiver, usa um padrão
    if (!lead.name || lead.name.trim().length === 0) {
      lead.name = `Lead ${lineNumber}`;
    }

    // Validação de email se fornecido
    if (lead.email && lead.email.trim()) {
      if (!validateEmail(lead.email.trim())) {
        errors.push("Email inválido");
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

  const extractPhoneNumbers = (text: string): string[] => {
    if (!text || !text.trim()) return [];
    
    // Remove tudo que não é número, espaço, hífen ou parênteses
    const cleaned = text.replace(/[^\d\s\-()]/g, '');
    // Divide por espaços, vírgulas, tabs ou múltiplos espaços
    const parts = cleaned.split(/[\s,\t]+/).filter(p => p.trim().length > 0);
    
    const phones: string[] = [];
    for (const part of parts) {
      const numbersOnly = part.replace(/\D/g, '');
      // Se tiver pelo menos 10 dígitos (DDD + número), considera como telefone
      // Aceita também 8 ou 9 dígitos se parecer com número de telefone
      if (numbersOnly.length >= 10 || (numbersOnly.length >= 8 && numbersOnly.length <= 11)) {
        phones.push(part.trim());
      }
    }
    
    return phones;
  };

  const isPhoneNumber = (value: string): boolean => {
    if (!value || !value.trim()) return false;
    const numbersOnly = value.replace(/\D/g, '');
    // Telefone brasileiro tem pelo menos 10 dígitos (DDD + número fixo) ou 11 (DDD + celular)
    return numbersOnly.length >= 10 && numbersOnly.length <= 13;
  };

  const processData = async (file: File): Promise<{ headers: string[]; rows: string[][] }> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xlsx' || fileExtension === 'xls' || fileExtension === 'ods') {
      return await readExcelFile(file);
    } else {
      // Tenta múltiplas codificações
      const encodings = ['UTF-8', 'ISO-8859-1', 'windows-1252'];
      let text = '';
      
      for (const encoding of encodings) {
        try {
          text = await readFileWithEncoding(file, encoding);
          if (!text.includes('�') && text.length > 0) {
            console.log(`📄 processData: Arquivo lido com encoding ${encoding}`);
            break;
          }
        } catch (e) {
          console.warn(`⚠️ processData: Falha com encoding ${encoding}`);
        }
      }

      if (!text || text.trim().length === 0) {
        throw new Error("Não foi possível ler o arquivo");
      }

      const delimiter = fileExtension === 'tsv' ? '\t' : detectDelimiter(text);
      const lines = text.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 1) {
        throw new Error("Arquivo vazio");
      }

      const firstLineValues = parseCSVLine(lines[0], delimiter);
      
      const hasHeaders = firstLineValues.some(val => {
        const cleaned = val.replace(/\D/g, '');
        return isNaN(Number(cleaned)) || cleaned.length < 8;
      });
      
      let headers: string[];
      let dataStartIndex: number;

      if (hasHeaders) {
        headers = firstLineValues.map(h => h.toLowerCase().trim());
        dataStartIndex = 1;
      } else {
        headers = firstLineValues.map((_, i) => `coluna${i + 1}`);
        dataStartIndex = 0;
      }

      const rows = lines.slice(dataStartIndex).map(line => parseCSVLine(line, delimiter));

      console.log(`📊 processData: ${headers.length} colunas, ${rows.length} linhas de dados`);
      return { headers, rows };
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo primeiro");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("❌ Usuário não autenticado. Faça login e tente novamente.");
        setLoading(false);
        return;
      }

      // Buscar company_id do usuário
      const { data: userRole, error: roleError } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (roleError) {
        toast.error("❌ Não foi possível verificar sua empresa. Tente novamente ou contate o suporte.");
        setLoading(false);
        return;
      }

      if (!userRole?.company_id) {
        toast.error("⚠️ Sua conta não está vinculada a uma empresa. Solicite configuração ao administrador.");
        setLoading(false);
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

      // Buscar todos os usuários da empresa para validar responsáveis
      const { data: companyUsers } = await supabase
        .from("user_roles")
        .select("user_id, profiles(email)")
        .eq("company_id", userRole.company_id);

      const userEmailMap = new Map<string, string>();
      companyUsers?.forEach(ur => {
        const email = (ur.profiles as any)?.email;
        if (email) {
          userEmailMap.set(email.toLowerCase(), ur.user_id);
        }
      });

      // Processar arquivo
      const { headers, rows } = await processData(file);

      // Tags adicionais da interface
      const additionalTags = importTags
        .split(/[,;]/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Se não tiver cabeçalhos nomeados, processa cada célula como possível telefone
      const hasNamedHeaders = headers.some(h => 
        ['nome', 'name', 'telefone', 'phone', 'whatsapp', 'celular'].includes(h)
      );

      const processedLeads: { lead: any; lineNumber: number }[] = [];

      rows.forEach((row, rowIndex) => {
        if (!hasNamedHeaders) {
          // Sem cabeçalhos nomeados, processa cada célula como possível telefone
          // Cria um lead para cada telefone válido encontrado na linha
          const validPhones: string[] = [];
          
          row.forEach((cell) => {
            if (cell && cell.trim()) {
              // Se a célula parece ser um telefone (10-13 dígitos), tenta formatar
              if (isPhoneNumber(cell)) {
                const validation = robustFormatPhoneNumber(cell);
                if (validation.isValid && !validPhones.includes(validation.formatted)) {
                  validPhones.push(validation.formatted);
                }
              } else {
                // Tenta extrair telefones do texto
                const phones = extractPhoneNumbers(cell);
                phones.forEach(p => {
                  const validation = robustFormatPhoneNumber(p);
                  if (validation.isValid && !validPhones.includes(validation.formatted)) {
                    validPhones.push(validation.formatted);
                  }
                });
              }
            }
          });

          // Cria um lead para cada telefone válido encontrado
          validPhones.forEach((phone) => {
            const lead: any = {
              owner_id: user.id,
              company_id: userRole.company_id,
              funil_id: funilId,
              etapa_id: etapaId,
              status: 'novo',
              stage: 'prospeccao',
              value: 0,
              telefone: phone,
              phone: phone,
            };

            // Adiciona tags da interface se houver
            if (additionalTags.length > 0) {
              lead.tags = [...additionalTags];
            }

            processedLeads.push({ lead, lineNumber: rowIndex + 2 });
          });
        } else {
          // Com cabeçalhos nomeados, processa normalmente
          const lead: any = {
            owner_id: user.id,
            company_id: userRole.company_id,
            funil_id: funilId,
            etapa_id: etapaId,
            status: 'novo',
            stage: 'prospeccao',
            value: 0,
          };

          // Processa com cabeçalhos nomeados
          headers.forEach((header, colIndex) => {
            const value = row[colIndex]?.trim().replace(/^["']|["']$/g, '');
            if (!value) return;

            // Mapear colunas do arquivo para campos do banco
            switch (header) {
              case 'nome':
              case 'name':
                lead.name = value;
                break;
              case 'telefone':
              case 'phone':
              case 'whatsapp':
              case 'celular':
                lead.telefone = value;
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
                lead.value = value;
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
              case 'responsavel':
              case 'responsible':
              case 'atribuido':
              case 'assignee':
                const responsavelEmail = value.toLowerCase().trim();
                const responsavelId = userEmailMap.get(responsavelEmail);
                if (responsavelId) {
                  lead.responsavel_id = responsavelId;
                }
                break;
              default:
                // Se o header não for reconhecido, mas o valor parece ser um telefone, tenta usar
                if (!lead.telefone) {
                  if (isPhoneNumber(value)) {
                    const validation = robustFormatPhoneNumber(value);
                    if (validation.isValid) {
                      lead.telefone = validation.formatted;
                      lead.phone = validation.formatted;
                    }
                  } else {
                    const phones = extractPhoneNumbers(value);
                    if (phones.length > 0) {
                      const validation = robustFormatPhoneNumber(phones[0]);
                      if (validation.isValid) {
                        lead.telefone = validation.formatted;
                        lead.phone = validation.formatted;
                      }
                    }
                  }
                }
                break;
            }
          });

          // Adiciona tags da interface se houver
          if (additionalTags.length > 0) {
            if (!lead.tags) {
              lead.tags = [];
            }
            lead.tags = [...lead.tags, ...additionalTags];
          }

          processedLeads.push({ lead, lineNumber: rowIndex + 2 });
        }
      });

      // Filtra apenas leads que têm telefone
      const leadsWithPhones = processedLeads.filter(({ lead }) => {
        return lead.telefone && lead.telefone.trim();
      });

      // Validar todos os leads
      const validationResults = leadsWithPhones.map(({ lead, lineNumber }) => ({
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

      if (validLeads.length === 0) {
        toast.error("Nenhum lead válido encontrado no arquivo. Verifique os erros abaixo.");
        setLoading(false);
        return;
      }

      // Função para normalizar telefone para comparação (remove tudo que não é número)
      const normalizePhoneForComparison = (phone: string): string => {
        return phone.replace(/\D/g, '');
      };

      // Buscar leads existentes da empresa para verificar duplicatas
      const phoneNumbersToCheck = validLeads
        .map(lead => lead.telefone || lead.phone)
        .filter(phone => phone);

      if (phoneNumbersToCheck.length === 0) {
        toast.error("Nenhum telefone válido encontrado para verificar duplicatas.");
        setLoading(false);
        return;
      }

      // Buscar leads existentes com os telefones que estão sendo importados
      const { data: existingLeads, error: searchError } = await supabase
        .from("leads")
        .select("id, telefone, phone")
        .eq("company_id", userRole.company_id);

      if (searchError) {
        console.error("Erro ao buscar leads existentes:", searchError);
        toast.error("Erro ao verificar duplicatas. Tente novamente.");
        setLoading(false);
        return;
      }

      // Criar mapa de telefones normalizados dos leads existentes
      const existingPhonesMap = new Map<string, boolean>();
      existingLeads?.forEach(lead => {
        const phone = lead.telefone || lead.phone;
        if (phone) {
          const normalized = normalizePhoneForComparison(phone);
          existingPhonesMap.set(normalized, true);
        }
      });

      // Separar leads novos e duplicados
      const newLeads: any[] = [];
      const duplicateLeads: { lead: any; reason: string }[] = [];

      validLeads.forEach(lead => {
        const phone = lead.telefone || lead.phone;
        if (!phone) {
          duplicateLeads.push({ lead, reason: "Telefone não encontrado" });
          return;
        }

        const normalizedPhone = normalizePhoneForComparison(phone);
        
        if (existingPhonesMap.has(normalizedPhone)) {
          duplicateLeads.push({ 
            lead, 
            reason: `Telefone ${phone} já existe no sistema` 
          });
        } else {
          // Adicionar ao mapa para evitar duplicatas dentro do mesmo lote de importação
          existingPhonesMap.set(normalizedPhone, true);
          newLeads.push(lead);
        }
      });

      // Criar relatório de importação com informações de duplicatas
      const report = {
        total: leadsWithPhones.length,
        success: newLeads.length,
        duplicates: duplicateLeads.length,
        errors
      };

      setImportReport(report);

      if (newLeads.length === 0) {
        if (duplicateLeads.length > 0) {
          toast.warning(`Todos os ${duplicateLeads.length} leads já existem no sistema (telefones duplicados).`);
        } else {
          toast.error("Nenhum lead válido para importar.");
        }
        setLoading(false);
        return;
      }

      // Importar apenas leads novos (não duplicados)
      const { error } = await supabase
        .from("leads")
        .insert(newLeads);

      if (error) throw error;

      // Mostrar resultado da importação
      let message = `${newLeads.length} lead${newLeads.length !== 1 ? 's' : ''} importado${newLeads.length !== 1 ? 's' : ''} com sucesso!`;
      
      if (duplicateLeads.length > 0) {
        message += ` ${duplicateLeads.length} duplicado${duplicateLeads.length !== 1 ? 's' : ''} ignorado${duplicateLeads.length !== 1 ? 's' : ''}.`;
      }
      
      if (errors.length > 0) {
        message += ` ${errors.length} linha${errors.length !== 1 ? 's' : ''} com erro${errors.length !== 1 ? 's' : ''} ignorada${errors.length !== 1 ? 's' : ''}.`;
      }

      if (duplicateLeads.length > 0 || errors.length > 0) {
        toast.warning(message);
      } else {
        toast.success(message);
      }

      setOpen(false);
      setFile(null);
      setPreview([]);
      setImportTags("");
      onLeadsImported();
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
        setImportTags("");
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
              <strong>Formatos suportados:</strong> CSV, TSV, XLSX, XLS, ODS, TXT
              <br />
              <strong>Delimitadores:</strong> vírgula (,), ponto e vírgula (;), tab, pipe (|) - detectado automaticamente
              <br />
              <strong>Obrigatório:</strong> Telefone (pode ser apenas números em colunas)
              <br />
              <strong>Opcionais:</strong> nome, email, cpf, empresa, origem, valor, status, servico, segmentacao, tags, observacoes, responsavel
              <br />
              • O sistema detecta automaticamente telefones mesmo sem cabeçalho
              <br />
              • Separe múltiplas tags com ponto e vírgula (;) ou vírgula (,)
              <br />
              • O telefone será formatado automaticamente para +55 (código do país + DDD + número)
              <br />
              • Aceita números em diferentes formatos: 55 87 9142-6333, 879914263333, 8791426-3333, etc.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="file">Arquivo (CSV, TSV, XLSX, XLS, ODS, TXT)</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,.ods,.txt"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags para segmentação (opcional)</Label>
            <Input
              id="tags"
              type="text"
              placeholder="Ex: cliente-vip, promocao, seguimento-1; seguimento-2"
              value={importTags}
              onChange={(e) => setImportTags(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Separe múltiplas tags com vírgula (,) ou ponto e vírgula (;). Essas tags serão aplicadas a todos os leads importados.
            </p>
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
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{importReport.total}</div>
                    <div className="text-sm text-blue-800">Total de linhas</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{importReport.success}</div>
                    <div className="text-sm text-green-800">Importados</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">{importReport.duplicates || 0}</div>
                    <div className="text-sm text-yellow-800">Duplicados</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importReport.errors.length}</div>
                    <div className="text-sm text-red-800">Com erros</div>
                  </div>
                </div>

                {importReport.duplicates > 0 && (
                  <div className="space-y-2">
                    <Label className="text-yellow-600">Leads duplicados (ignorados):</Label>
                    <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                      <div className="text-sm text-yellow-800">
                        {importReport.duplicates} lead{importReport.duplicates !== 1 ? 's' : ''} com telefone{importReport.duplicates !== 1 ? 's' : ''} que já existe{importReport.duplicates !== 1 ? 'm' : ''} no sistema foram ignorado{importReport.duplicates !== 1 ? 's' : ''} para evitar duplicação.
                      </div>
                    </div>
                  </div>
                )}

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
