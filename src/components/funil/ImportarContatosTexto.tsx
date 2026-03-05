import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ClipboardPaste, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { robustFormatPhoneNumber } from "@/utils/phoneFormatter";

interface ImportarContatosTextoProps {
  onLeadsImported: () => void;
  onClose: () => void;
}

/**
 * Parses raw pasted text into phone numbers.
 * Handles formats like:
 *   21 27287549
 *   38 98405928486 99992956331 32695555
 *   (11) 2652-2200
 *   61 999639787
 *   55613364410438 991480277
 */
function parsePhoneNumbersFromText(text: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  // Split into lines
  const lines = text.split(/\n/).filter(l => l.trim());

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Try to extract numbers with parentheses format first: (XX) XXXX-XXXX
    const parenRegex = /\((\d{2})\)\s*(\d{4,5})[- ]?(\d{4})/g;
    let parenMatch;
    let lineAfterParen = line;
    
    while ((parenMatch = parenRegex.exec(line)) !== null) {
      const ddd = parenMatch[1];
      const num = parenMatch[2] + parenMatch[3];
      addPhone(`${ddd}${num}`, results, seen);
      // Remove matched portion from line
      lineAfterParen = lineAfterParen.replace(parenMatch[0], ' ');
    }

    // Now process remaining content (without parenthesized numbers)
    // Remove non-digit chars except spaces
    const cleaned = lineAfterParen.replace(/[^\d\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!cleaned) continue;

    const parts = cleaned.split(' ').filter(p => p.length > 0);
    
    if (parts.length === 0) continue;

    // Strategy: detect if first part is a 2-digit DDD
    let i = 0;
    while (i < parts.length) {
      const part = parts[i];
      const digits = part.replace(/\D/g, '');

      // If this part is exactly 2 digits, treat as DDD for subsequent numbers
      if (digits.length === 2) {
        const ddd = digits;
        i++;
        // Consume following parts as phone numbers with this DDD
        while (i < parts.length) {
          const nextDigits = parts[i].replace(/\D/g, '');
          if (nextDigits.length === 2) {
            // Next DDD found, break to outer loop
            break;
          }
          if (nextDigits.length >= 8 && nextDigits.length <= 9) {
            // Local number (8 or 9 digits), prepend DDD
            addPhone(`${ddd}${nextDigits}`, results, seen);
            i++;
          } else if (nextDigits.length >= 10 && nextDigits.length <= 13) {
            // Already has DDD or country code
            addPhone(nextDigits, results, seen);
            i++;
          } else if (nextDigits.length >= 14) {
            // Multiple numbers concatenated, try to split
            splitConcatenated(nextDigits, results, seen);
            i++;
          } else {
            // Too short, skip
            i++;
          }
        }
      } else if (digits.length >= 10 && digits.length <= 13) {
        // Full number with DDD
        addPhone(digits, results, seen);
        i++;
      } else if (digits.length >= 14) {
        // Multiple numbers concatenated
        splitConcatenated(digits, results, seen);
        i++;
      } else if (digits.length === 8 || digits.length === 9) {
        // Number without DDD - can't format without DDD, skip or add as-is
        // We'll skip since user said DDD is required
        i++;
      } else {
        i++;
      }
    }
  }

  return results;
}

function addPhone(digits: string, results: string[], seen: Set<string>) {
  const clean = digits.replace(/\D/g, '');
  const validation = robustFormatPhoneNumber(clean);
  if (validation.isValid && !seen.has(validation.formatted)) {
    seen.add(validation.formatted);
    results.push(validation.formatted);
  }
}

function splitConcatenated(digits: string, results: string[], seen: Set<string>) {
  // Try to split long digit strings into 10-11 digit chunks (DDD + number)
  let remaining = digits;
  while (remaining.length >= 10) {
    // Try 13 digits first (55 + DDD + 9 digits), then 12, 11, 10
    for (const len of [13, 12, 11, 10]) {
      if (remaining.length >= len) {
        const candidate = remaining.substring(0, len);
        const validation = robustFormatPhoneNumber(candidate);
        if (validation.isValid) {
          if (!seen.has(validation.formatted)) {
            seen.add(validation.formatted);
            results.push(validation.formatted);
          }
          remaining = remaining.substring(len);
          break;
        }
      }
      if (len === 10 && remaining.length >= 10) {
        // Even if not valid, consume 10 digits to avoid infinite loop
        remaining = remaining.substring(10);
      }
    }
  }
}

export function ImportarContatosTexto({ onLeadsImported, onClose }: ImportarContatosTextoProps) {
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState("");
  const [importTags, setImportTags] = useState("");
  const [parsedPhones, setParsedPhones] = useState<string[]>([]);
  const [importReport, setImportReport] = useState<{
    total: number;
    success: number;
    duplicates: number;
  } | null>(null);

  const handleParsePreview = () => {
    const phones = parsePhoneNumbersFromText(rawText);
    setParsedPhones(phones);
    setImportReport(null);
  };

  const handleImport = async () => {
    if (parsedPhones.length === 0) {
      toast.error("Nenhum número válido encontrado. Cole os números e clique em 'Analisar'.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado.");
        return;
      }

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        toast.error("Sua conta não está vinculada a uma empresa.");
        return;
      }

      const { data: funis } = await supabase
        .from("funis")
        .select("id")
        .eq("company_id", userRole.company_id)
        .limit(1);

      if (!funis?.length) {
        toast.error("Crie um funil antes de importar leads.");
        return;
      }

      const { data: etapas } = await supabase
        .from("etapas")
        .select("id")
        .eq("funil_id", funis[0].id)
        .order("posicao", { ascending: true })
        .limit(1);

      if (!etapas?.length) {
        toast.error("Crie etapas no funil antes de importar leads.");
        return;
      }

      // Check duplicates
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("telefone, phone")
        .eq("company_id", userRole.company_id);

      const existingSet = new Set<string>();
      existingLeads?.forEach(l => {
        const p = (l.telefone || l.phone || '').replace(/\D/g, '');
        if (p) existingSet.add(p);
      });

      const additionalTags = importTags
        .split(/[,;]/)
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const newLeads: any[] = [];
      let duplicates = 0;

      parsedPhones.forEach((phone, idx) => {
        const normalized = phone.replace(/\D/g, '');
        if (existingSet.has(normalized)) {
          duplicates++;
          return;
        }
        existingSet.add(normalized);

        // Format display name from phone: +55 (XX) XXXXX-XXXX
        const ddd = normalized.length >= 4 ? normalized.substring(2, 4) : '';
        const localNum = normalized.substring(4);
        const displayName = ddd ? `Contato (${ddd}) ${localNum}` : `Lead ${idx + 1}`;

        newLeads.push({
          owner_id: user.id,
          company_id: userRole.company_id,
          funil_id: funis[0].id,
          etapa_id: etapas[0].id,
          status: 'novo',
          stage: 'prospeccao',
          value: 0,
          name: displayName,
          telefone: phone,
          phone: phone,
          ...(additionalTags.length > 0 ? { tags: additionalTags } : {}),
        });
      });

      setImportReport({
        total: parsedPhones.length,
        success: newLeads.length,
        duplicates,
      });

      if (newLeads.length === 0) {
        toast.warning(`Todos os ${duplicates} contatos já existem no sistema.`);
        return;
      }

      // Insert in batches of 500
      for (let i = 0; i < newLeads.length; i += 500) {
        const batch = newLeads.slice(i, i + 500);
        const { error } = await supabase.from("leads").insert(batch);
        if (error) throw error;
      }

      const msg = `${newLeads.length} contato${newLeads.length !== 1 ? 's' : ''} importado${newLeads.length !== 1 ? 's' : ''}!` +
        (duplicates > 0 ? ` ${duplicates} duplicado${duplicates !== 1 ? 's' : ''} ignorado${duplicates !== 1 ? 's' : ''}.` : '');

      duplicates > 0 ? toast.warning(msg) : toast.success(msg);
      onLeadsImported();
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar contatos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Cole os números no formato <strong>DDD + Número</strong>, um por linha ou separados por espaço.
          <br />
          Exemplos: <code>21 27287549</code>, <code>(11) 99492-0769</code>, <code>61 999639787</code>
          <br />
          O sistema formata automaticamente com +55 e identifica múltiplos números por linha.
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <Label htmlFor="paste-numbers">Cole os números aqui</Label>
        <Textarea
          id="paste-numbers"
          placeholder={`21 27287549\n38 98405928\n(11) 2652-2200\n61 999639787`}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setParsedPhones([]);
            setImportReport(null);
          }}
          rows={8}
          className="font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="paste-tags">Tags para segmentação (opcional)</Label>
        <Input
          id="paste-tags"
          placeholder="Ex: cliente-vip, promocao"
          value={importTags}
          onChange={(e) => setImportTags(e.target.value)}
        />
      </div>

      {rawText.trim() && parsedPhones.length === 0 && !importReport && (
        <Button variant="secondary" onClick={handleParsePreview} className="w-full">
          <ClipboardPaste className="mr-2 h-4 w-4" />
          Analisar Números
        </Button>
      )}

      {parsedPhones.length > 0 && (
        <div className="space-y-2">
          <Label>Números identificados ({parsedPhones.length})</Label>
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
            {parsedPhones.map((phone, i) => {
              const digits = phone.replace(/\D/g, '');
              const ddd = digits.substring(2, 4);
              const num = digits.substring(4);
              const formatted = num.length === 9
                ? `+55 (${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`
                : `+55 (${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
              return (
                <div key={i} className="text-sm font-mono text-foreground bg-muted/50 px-2 py-1 rounded">
                  {formatted}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {importReport && (
        <div className="border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{importReport.total}</div>
              <div className="text-sm text-blue-800 dark:text-blue-300">Total</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{importReport.success}</div>
              <div className="text-sm text-green-800 dark:text-green-300">Importados</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{importReport.duplicates}</div>
              <div className="text-sm text-yellow-800 dark:text-yellow-300">Duplicados</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button
          onClick={handleImport}
          disabled={parsedPhones.length === 0 || loading}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          {loading ? "Importando..." : `Importar ${parsedPhones.length} Contato${parsedPhones.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  );
}
