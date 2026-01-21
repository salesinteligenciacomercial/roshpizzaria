import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Send, Loader2, User, MessageSquare, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  lastMessage?: string;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageContent: string;
  messageType: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
  mediaUrl?: string;
  fileName?: string;
  companyId: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  messageContent,
  messageType,
  mediaUrl,
  fileName,
  companyId,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // Carregar contatos/conversas recentes
  useEffect(() => {
    if (open) {
      loadContacts();
    }
  }, [open, companyId]);

  const loadContacts = async () => {
    setLoading(true);
    try {
      // Buscar conversas recentes únicas
      const { data: conversas, error } = await supabase
        .from("conversas")
        .select("numero, telefone_formatado, nome_contato, lead_id")
        .eq("company_id", companyId)
        .eq("is_group", false)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      // Remover duplicatas e criar lista de contatos
      const uniqueContacts = new Map<string, Contact>();
      
      conversas?.forEach((c) => {
        const phone = c.telefone_formatado || c.numero;
        if (phone && !uniqueContacts.has(phone)) {
          uniqueContacts.set(phone, {
            id: phone,
            name: c.nome_contato || phone,
            phone: phone,
          });
        }
      });

      // Buscar leads para enriquecer dados
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, telefone, phone")
        .eq("company_id", companyId)
        .limit(500);

      leads?.forEach((lead) => {
        const phone = lead.telefone || lead.phone;
        if (phone) {
          const phoneClean = phone.replace(/\D/g, "");
          if (!uniqueContacts.has(phoneClean)) {
            uniqueContacts.set(phoneClean, {
              id: phoneClean,
              name: lead.name || phoneClean,
              phone: phoneClean,
            });
          } else {
            // Atualizar nome se o lead tiver nome
            const existing = uniqueContacts.get(phoneClean);
            if (existing && lead.name && (!existing.name || existing.name === phoneClean)) {
              existing.name = lead.name;
            }
          }
        }
      });

      setContacts(Array.from(uniqueContacts.values()));
    } catch (error) {
      console.error("Erro ao carregar contatos:", error);
      toast({
        title: "Erro ao carregar contatos",
        description: "Não foi possível carregar a lista de contatos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const searchLower = search.toLowerCase();
    return (
      contact.name.toLowerCase().includes(searchLower) ||
      contact.phone.includes(search.replace(/\D/g, ""))
    );
  });

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleForward = async () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "Selecione ao menos um contato",
        description: "Escolha para quem deseja encaminhar a mensagem",
        variant: "destructive",
      });
      return;
    }

    setSending("multiple");
    let successCount = 0;
    let errorCount = 0;

    for (const contactId of selectedContacts) {
      const contact = contacts.find((c) => c.id === contactId);
      if (!contact) continue;

      try {
        // Preparar payload
        const payload: any = {
          numero: contact.phone.replace(/\D/g, ""),
          company_id: companyId,
        };

        if (messageType === "text") {
          payload.mensagem = `📩 Mensagem encaminhada:\n\n${messageContent}`;
        } else if (mediaUrl) {
          payload.mensagem = messageContent ? `📩 Encaminhado:\n\n${messageContent}` : "📩 Mídia encaminhada";
          payload.mediaUrl = mediaUrl;
          payload.tipo_mensagem = messageType;
          payload.fileName = fileName;
          payload.caption = messageContent || "";
        }

        // Enviar via edge function
        const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
          body: payload,
        });

        if (error) throw error;

        // Registrar na tabela de conversas
        const telefoneFormatado = contact.phone.replace(/\D/g, "").replace(/^55/, "");
        
        await supabase.from("conversas").insert({
          numero: contact.phone.replace(/\D/g, ""),
          telefone_formatado: telefoneFormatado,
          mensagem: messageType === "text" 
            ? `📩 Mensagem encaminhada:\n\n${messageContent}`
            : messageContent || "📩 Mídia encaminhada",
          origem: "encaminhamento",
          status: "enviada",
          tipo_mensagem: messageType,
          midia_url: mediaUrl || null,
          arquivo_nome: fileName || null,
          nome_contato: contact.name,
          company_id: companyId,
          fromme: true,
          sent_by: "Sistema - Encaminhamento",
          read: true,
          delivered: true,
        });

        successCount++;
      } catch (error) {
        console.error("Erro ao encaminhar para", contact.name, error);
        errorCount++;
      }
    }

    setSending(null);

    if (successCount > 0) {
      toast({
        title: "✅ Mensagem encaminhada",
        description: `Enviada para ${successCount} contato(s)${errorCount > 0 ? `, ${errorCount} falharam` : ""}`,
      });
      setSelectedContacts([]);
      onOpenChange(false);
    } else {
      toast({
        title: "❌ Erro ao encaminhar",
        description: "Não foi possível encaminhar a mensagem",
        variant: "destructive",
      });
    }
  };

  const getMessagePreview = () => {
    if (messageType === "text") {
      return messageContent.length > 100 
        ? messageContent.substring(0, 100) + "..." 
        : messageContent;
    }
    
    const typeLabels: Record<string, string> = {
      image: "📷 Imagem",
      audio: "🎵 Áudio",
      video: "🎬 Vídeo",
      pdf: "📄 PDF",
      document: "📎 Documento",
      contact: "👤 Contato",
    };
    
    return typeLabels[messageType] || "📎 Arquivo";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Encaminhar mensagem
          </DialogTitle>
          <DialogDescription>
            Selecione os contatos para encaminhar
          </DialogDescription>
        </DialogHeader>

        {/* Preview da mensagem */}
        <div className="bg-muted/50 rounded-lg p-3 border">
          <span className="text-xs text-muted-foreground">Mensagem a encaminhar:</span>
          <p className="text-sm mt-1 line-clamp-3">{getMessagePreview()}</p>
        </div>

        {/* Barra de pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Lista de contatos */}
        <ScrollArea className="h-[300px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {search ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredContacts.map((contact) => {
                const isSelected = selectedContacts.includes(contact.id);
                return (
                  <button
                    key={contact.id}
                    onClick={() => toggleContactSelection(contact.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isSelected 
                        ? "bg-primary/10 border border-primary/30" 
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={contact.avatar} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-sm">{contact.name}</p>
                      <p className="text-xs text-muted-foreground">{contact.phone}</p>
                    </div>
                    {isSelected && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Botão de enviar */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedContacts.length > 0 && (
              <Badge variant="secondary">{selectedContacts.length} selecionado(s)</Badge>
            )}
          </div>
          <Button
            onClick={handleForward}
            disabled={selectedContacts.length === 0 || sending !== null}
            className="gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Encaminhar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
