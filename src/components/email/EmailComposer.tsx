import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Send, Loader2 } from "lucide-react";

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  defaultTo?: string;
  defaultSubject?: string;
  leadId?: string;
  leadName?: string;
}

export function EmailComposer({
  open,
  onOpenChange,
  companyId,
  defaultTo = "",
  defaultSubject = "",
  leadId,
  leadName,
}: EmailComposerProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !body) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha destinatário, assunto e mensagem.",
        variant: "destructive",
      });
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      toast({
        title: "Email inválido",
        description: "Digite um endereço de email válido.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSending(true);

      const { data, error } = await supabase.functions.invoke('enviar-email-gmail', {
        body: {
          company_id: companyId,
          to,
          subject,
          body,
          is_html: isHtml,
          lead_id: leadId,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Email Enviado!",
        description: `Email enviado com sucesso para ${to}`,
      });

      // Limpar e fechar
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody("");
      onOpenChange(false);

    } catch (error: any) {
      console.error('Erro ao enviar email:', error);
      
      let errorMessage = 'Não foi possível enviar o email.';
      if (error.message?.includes('não está conectado')) {
        errorMessage = 'Gmail não está conectado. Configure nas Configurações.';
      } else if (error.message?.includes('não encontrada')) {
        errorMessage = 'Integração Gmail não configurada.';
      }

      toast({
        title: "Erro ao enviar",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-red-600" />
            Enviar Email
            {leadName && (
              <span className="text-sm font-normal text-muted-foreground">
                para {leadName}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            O email será enviado da sua conta Gmail conectada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="to">Para</Label>
            <Input
              id="to"
              type="email"
              placeholder="email@exemplo.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              placeholder="Assunto do email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="body">Mensagem</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="html-mode" className="text-xs text-muted-foreground">
                  HTML
                </Label>
                <Switch
                  id="html-mode"
                  checked={isHtml}
                  onCheckedChange={setIsHtml}
                  disabled={sending}
                />
              </div>
            </div>
            <Textarea
              id="body"
              placeholder={isHtml ? "<p>Seu conteúdo HTML aqui...</p>" : "Escreva sua mensagem..."}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={sending}
              rows={8}
              className="resize-none font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
