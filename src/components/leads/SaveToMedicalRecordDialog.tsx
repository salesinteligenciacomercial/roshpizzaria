import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, FileText, Image, Video, File } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SaveToMedicalRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string;
  fileName: string;
  messageType: string;
  leadId: string;
  companyId: string;
  leadName?: string;
}

const categories = [
  { value: "antes", label: "Antes do Tratamento" },
  { value: "depois", label: "Depois do Tratamento" },
  { value: "durante", label: "Durante o Tratamento" },
  { value: "exame", label: "Exame" },
  { value: "laudo", label: "Laudo Médico" },
  { value: "outros", label: "Outros" },
];

export function SaveToMedicalRecordDialog({
  open,
  onOpenChange,
  mediaUrl,
  fileName,
  messageType,
  leadId,
  companyId,
  leadName,
}: SaveToMedicalRecordDialogProps) {
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("outros");
  const [treatmentName, setTreatmentName] = useState("");
  const [treatmentDate, setTreatmentDate] = useState<Date | undefined>(new Date());
  const [description, setDescription] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const getFileType = (type: string): string => {
    switch (type) {
      case "image": return "image";
      case "video": return "video";
      case "pdf": return "document";
      case "document": return "document";
      default: return "document";
    }
  };

  const getFileIcon = () => {
    switch (messageType) {
      case "image": return <Image className="h-8 w-8 text-primary" />;
      case "video": return <Video className="h-8 w-8 text-primary" />;
      case "pdf": return <FileText className="h-8 w-8 text-primary" />;
      default: return <File className="h-8 w-8 text-primary" />;
    }
  };

  const handleSave = async () => {
    if (!mediaUrl || !leadId || !companyId) {
      toast.error("Dados insuficientes para salvar");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Determinar nome do arquivo
      const finalFileName = fileName || `arquivo-${Date.now()}`;
      
      // Determinar tamanho aproximado (se for base64)
      let fileSize = 0;
      if (mediaUrl.startsWith('data:')) {
        const base64Data = mediaUrl.split(',')[1];
        if (base64Data) {
          fileSize = Math.round((base64Data.length * 3) / 4);
        }
      }

      // Determinar mimeType
      let mimeType = "application/octet-stream";
      if (mediaUrl.startsWith('data:')) {
        const match = mediaUrl.match(/^data:([^;]+);/);
        if (match) mimeType = match[1];
      } else if (fileName) {
        const ext = fileName.toLowerCase().split('.').pop();
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
          mp4: "video/mp4",
          pdf: "application/pdf",
        };
        mimeType = mimeMap[ext || ""] || mimeType;
      }

      // Inserir registro no banco
      const { error } = await supabase.from("lead_attachments").insert({
        lead_id: leadId,
        company_id: companyId,
        file_name: finalFileName,
        file_url: mediaUrl,
        file_type: getFileType(messageType),
        file_size: fileSize > 0 ? fileSize : null,
        mime_type: mimeType,
        category: category,
        treatment_name: treatmentName || null,
        treatment_date: treatmentDate ? format(treatmentDate, "yyyy-MM-dd") : null,
        description: description || null,
        uploaded_by: user?.id || null,
      });

      if (error) throw error;

      toast.success("Arquivo salvo no prontuário!");
      onOpenChange(false);
      
      // Limpar campos
      setCategory("outros");
      setTreatmentName("");
      setTreatmentDate(new Date());
      setDescription("");
    } catch (error) {
      console.error("Erro ao salvar no prontuário:", error);
      toast.error("Erro ao salvar arquivo no prontuário");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Salvar no Prontuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview do arquivo */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{fileName || "Arquivo"}</p>
              <p className="text-xs text-muted-foreground capitalize">{messageType}</p>
            </div>
          </div>

          {leadName && (
            <p className="text-sm text-muted-foreground">
              Salvando para: <span className="font-medium text-foreground">{leadName}</span>
            </p>
          )}

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome do Tratamento */}
          <div className="space-y-2">
            <Label>Nome do Tratamento / Procedimento</Label>
            <Input
              value={treatmentName}
              onChange={(e) => setTreatmentName(e.target.value)}
              placeholder="Ex: Botox, Preenchimento, Consulta..."
            />
          </div>

          {/* Data do Tratamento */}
          <div className="space-y-2">
            <Label>Data do Tratamento</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {treatmentDate ? format(treatmentDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={treatmentDate}
                  onSelect={(date) => {
                    setTreatmentDate(date);
                    setCalendarOpen(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição / Observações</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicione detalhes sobre o arquivo..."
              rows={2}
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
