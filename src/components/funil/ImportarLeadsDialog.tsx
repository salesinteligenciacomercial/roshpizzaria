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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error("Apenas arquivos CSV são suportados no momento");
      return;
    }

    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const previewData = lines.slice(1, 6).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = values[index]?.trim() || '';
        });
        return obj;
      });

      setPreview(previewData);
    };
    reader.readAsText(file);
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

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id)
        .single();

      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        setLoading(false);
        return;
      }

      // Buscar primeiro funil e etapa do usuário
      const { data: funil } = await supabase
        .from("funis")
        .select("id, etapas(id)")
        .eq("company_id", userRole.company_id)
        .limit(1)
        .single();

      if (!funil || !funil.etapas || funil.etapas.length === 0) {
        toast.error("Crie um funil com etapas antes de importar leads");
        setLoading(false);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const leadsToImport = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',');
            const lead: any = {
              owner_id: user.id,
              company_id: userRole.company_id,
              funil_id: funil.id,
              etapa_id: funil.etapas[0].id,
              status: 'novo',
              stage: 'prospeccao',
              value: 0,
            };

            headers.forEach((header, index) => {
              const value = values[index]?.trim();
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
                  let telefone = value.replace(/\D/g, "");
                  if (!telefone.startsWith("55")) {
                    telefone = "55" + telefone;
                  }
                  lead.telefone = telefone;
                  lead.phone = telefone;
                  break;
                case 'email':
                case 'e-mail':
                  lead.email = value;
                  break;
                case 'empresa':
                case 'company':
                  lead.company = value;
                  break;
                case 'origem':
                case 'source':
                  lead.source = value;
                  break;
                case 'valor':
                case 'value':
                  lead.value = parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
                  break;
                case 'status':
                  lead.status = value.toLowerCase();
                  break;
                case 'servico':
                case 'service':
                  lead.servico = value;
                  break;
                case 'segmentacao':
                case 'segmento':
                  lead.segmentacao = value;
                  break;
                case 'tags':
                  lead.tags = value.split(';').map((t: string) => t.trim());
                  break;
              }
            });

            return lead;
          })
          .filter(lead => lead.name); // Só importar leads com nome

        if (leadsToImport.length === 0) {
          toast.error("Nenhum lead válido encontrado no arquivo");
          return;
        }

        const { error } = await supabase
          .from("leads")
          .insert(leadsToImport);

        if (error) throw error;

        toast.success(`${leadsToImport.length} leads importados com sucesso!`);
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
    <Dialog open={open} onOpenChange={setOpen}>
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
              Colunas aceitas: nome, telefone, email, empresa, origem, valor, status, servico, segmentacao, tags
              <br />
              Separe múltiplas tags com ponto e vírgula (;)
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
