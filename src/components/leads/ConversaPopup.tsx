import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Send, MessageSquare, Info, User, DollarSign, Tag, 
  TrendingUp, Zap, Clock, MoreVertical, Edit, Trash2, Save
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { safeFormatPhoneNumber } from "@/utils/phoneFormatter";
import { AudioRecorder } from "@/components/conversas/AudioRecorder";
import { MediaUpload } from "@/components/conversas/MediaUpload";
import { MessageItem } from "@/components/conversas/MessageItem";
import { EditarInformacoesLeadDialog } from "@/components/conversas/EditarInformacoesLeadDialog";
import { ResponsaveisManager } from "@/components/conversas/ResponsaveisManager";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { Dialog as UIDialog, DialogContent as UIDialogContent, DialogHeader as UIDialogHeader, DialogTitle as UIDialogTitle, DialogTrigger as UIDialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EditarLeadDialog } from "@/components/funil/EditarLeadDialog";

interface ConversaPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string;
}

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact" | "document";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  status?: string;
  origem?: string;
}

export function ConversaPopup({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
}: ConversaPopupProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [leadVinculado, setLeadVinculado] = useState<any>(null);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [tarefaOpen, setTarefaOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [scheduledOpen, setScheduledOpen] = useState(false);
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [editLeadOpen, setEditLeadOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cache simples de avatar por sessão do componente
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const inflightAvatarRef = useRef<Map<string, Promise<string | undefined>>>(new Map());

  // Global events para sincronizar com Leads/Conversas
  const { emitGlobalEvent } = useGlobalSync({ showNotifications: false });

  // Função para obter company_id
  const getCompanyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    
    return userRole?.company_id || null;
  };

  // Função para enviar WhatsApp
  const enviarWhatsApp = async (body: any) => {
    const companyId = await getCompanyId();
    return await supabase.functions.invoke("enviar-whatsapp", {
      body: { company_id: companyId, ...body },
    });
  };

  // Normaliza número para padrão BR com DDI 55 e somente dígitos
  const normalizePhoneBR = (raw?: string): string | null => {
    if (!raw) return null;
    let n = raw.replace(/\D/g, "");
    if (n.startsWith("55")) return n;
    // Se vier local (10/11 dígitos), prefixar 55
    if (n.length === 10 || n.length === 11) return "55" + n;
    // Se vier com 12/13 mas sem 55 (raro), ainda prefixar 55 como fallback
    if (n.length >= 8 && n.length <= 13) return n.startsWith("55") ? n : "55" + n;
    // Último recurso: prefixar 55
    return "55" + n;
  };

  const getAvatarWithCache = async (number: string, companyId: string | null, nameForPlaceholder: string): Promise<string | undefined> => {
    if (!number) return undefined;
    if (/@g\.us$/.test(String(number))) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForPlaceholder || 'Grupo')}&background=10b981&color=fff`;
    }
    const normalized = normalizePhoneBR(number)!;
    const key = `${companyId || 'no-company'}:${normalized}`;
    const cached = avatarCacheRef.current.get(key);
    if (cached) return cached;
    const inflight = inflightAvatarRef.current.get(key);
    if (inflight) return await inflight;

    const promise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-profile-picture', {
          body: { number: normalized, company_id: companyId }
        });
        const url = (!error && data?.profilePictureUrl)
          ? data.profilePictureUrl
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForPlaceholder || normalized)}&background=10b981&color=fff`;
        avatarCacheRef.current.set(key, url);
        inflightAvatarRef.current.delete(key);
        return url;
      } catch {
        const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(nameForPlaceholder || normalized)}&background=10b981&color=fff`;
        avatarCacheRef.current.set(key, url);
        inflightAvatarRef.current.delete(key);
        return url;
      }
    })();
    inflightAvatarRef.current.set(key, promise);
    return await promise;
  };

  // Carregar mensagens agendadas
  const carregarMensagensAgendadas = async () => {
    if (!leadPhone) return;
    const numero = (leadPhone || "").replace(/\D/g, "");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!userRole?.company_id) return;
      const { data } = await supabase
        .from('scheduled_whatsapp_messages')
        .select('*')
        .eq('company_id', userRole.company_id)
        .eq('phone_number', numero)
        .order('scheduled_datetime');
      setScheduledList(data || []);
    } catch (err) {
      console.error('Erro ao carregar mensagens agendadas:', err);
    }
  };

  // Carregar dados do lead
  const carregarLead = async () => {
    if (!leadId) return;
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar lead:", error);
        return;
      }

      if (data) {
        setLeadVinculado(data);
      }
    } catch (error) {
      console.error("Erro ao carregar lead:", error);
    }
  };

  // Carregar histórico de mensagens
  const carregarMensagens = async () => {
    if (!leadPhone) return;

    setLoading(true);
    try {
      // Normalizar número de telefone
      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;
      
      const { data, error } = await supabase
        .from("conversas")
        .select("*")
        .or(`numero.eq.${telefoneNormalizado},telefone_formatado.eq.${telefoneNormalizado}`)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Erro ao carregar mensagens:", error);
        return;
      }

      // Transformar mensagens do banco para o formato do componente
      const formattedMessages: Message[] = (data || []).map((msg: any) => {
        const rawType = String(msg.tipo_mensagem || 'text').toLowerCase();
        const fileName = msg.arquivo_nome as string | undefined;
        const mediaUrl = (msg.media_url || msg.arquivo_url) as string | undefined;

        // Normalizar tipo para os valores aceitos pelo componente
        let type: Message["type"] = 'text';
        if (rawType === 'texto' || rawType === 'text') type = 'text';
        else if (rawType === 'image' || rawType === 'imagem') type = 'image';
        else if (rawType === 'audio' || rawType === 'áudio') type = 'audio';
        else if (rawType === 'video' || rawType === 'vídeo') type = 'video';
        else if (rawType === 'pdf') type = 'pdf';
        else if (rawType === 'document' || rawType === 'documento') {
          // Se documento for PDF, tratar como 'pdf'; senão, como 'document' genérico
          if ((fileName || '').toLowerCase().endsWith('.pdf') || (mediaUrl || '').startsWith('data:application/pdf')) {
            type = 'pdf';
          } else {
            type = 'document';
          }
        }

        // Determinar mimeType a partir da URL base64 ou extensão
        let mimeType: string | undefined = undefined;
        if (mediaUrl && mediaUrl.startsWith('data:')) {
          const m = mediaUrl.match(/^data:([^;]+);base64,/);
          if (m) mimeType = m[1];
        }
        if (!mimeType && fileName) {
          const fn = fileName.toLowerCase();
          if (fn.endsWith('.pdf')) mimeType = 'application/pdf';
          else if (fn.endsWith('.png')) mimeType = 'image/png';
          else if (fn.endsWith('.jpg') || fn.endsWith('.jpeg')) mimeType = 'image/jpeg';
          else if (fn.endsWith('.gif')) mimeType = 'image/gif';
          else if (fn.endsWith('.webp')) mimeType = 'image/webp';
          else if (fn.endsWith('.mp4')) mimeType = 'video/mp4';
          else if (fn.endsWith('.mov')) mimeType = 'video/quicktime';
          else if (fn.endsWith('.avi')) mimeType = 'video/x-msvideo';
          else if (fn.endsWith('.ogg')) mimeType = 'audio/ogg';
          else if (fn.endsWith('.mp3')) mimeType = 'audio/mpeg';
          else if (fn.endsWith('.wav')) mimeType = 'audio/wav';
        }

        return {
        id: msg.id || Date.now().toString() + Math.random(),
        content: msg.mensagem || "",
          type,
        sender: msg.status === "Recebida" ? "contact" : "user",
        timestamp: new Date(msg.created_at || new Date()),
        delivered: msg.status === "Enviada",
        read: msg.status === "Lida",
          mediaUrl,
          fileName,
          mimeType,
        status: msg.status,
        origem: msg.origem,
        } as Message;
      });

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    } finally {
      setLoading(false);
    }
  };

  // Ações rápidas do lead no cabeçalho
  const salvarLeadRapido = async () => {
    try {
      if (leadVinculado) return;
      const companyId = await getCompanyId();
      const { data: { user } } = await supabase.auth.getSession();
      if (!companyId || !user) {
        toast.error('Não foi possível identificar a empresa ou usuário');
        return;
      }
      const telefoneNormalizado = normalizePhoneBR(leadPhone || "");
      const { data, error } = await supabase
        .from('leads')
        .insert([{
          name: leadName,
          telefone: telefoneNormalizado,
          phone: telefoneNormalizado,
          company_id: companyId,
          owner_id: user.id,
          status: 'novo',
          stage: 'prospeccao'
        }])
        .select('*')
        .maybeSingle();

      if (error) throw error;
      setLeadVinculado(data);
      toast.success('Lead salvo no CRM');
    } catch (err) {
      console.error('Erro ao salvar lead:', err);
      toast.error('Erro ao salvar lead');
    }
  };

  const excluirLead = async () => {
    try {
      if (!leadVinculado?.id) return;
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadVinculado.id);
      if (error) throw error;
      setLeadVinculado(null);
      toast.success('Lead excluído');
    } catch (err) {
      console.error('Erro ao excluir lead:', err);
      toast.error('Erro ao excluir lead');
    }
  };

  // Carregar mensagens quando o popup abrir
  useEffect(() => {
    if (open && leadPhone) {
      carregarMensagens();
      carregarMensagensAgendadas();
      carregarLead();
      // Buscar foto de perfil via Edge Function (com cache)
      (async () => {
        try {
          const numero = normalizePhoneBR(leadPhone || "");
          const companyId = await getCompanyId();
          if (!numero) return;
          const url = await getAvatarWithCache(numero, companyId, leadName);
          setAvatarUrl(url || undefined);
        } catch {
          setAvatarUrl(undefined);
        }
      })();
    } else {
      setMessages([]);
      setMessageInput("");
      setLeadVinculado(null);
      setAvatarUrl(undefined);
    }
  }, [open, leadPhone, leadId]);

  // Scroll para o final quando novas mensagens chegarem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enviar mensagem
  const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
    const messageContent = content || messageInput.trim();
    if (!messageContent || !leadPhone || sending) return;

    setSending(true);

    try {
      // Normalizar número de telefone
      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;
      
      // Preparar mensagem para resposta
      const mensagemParaEnviar = replyingTo && messages.find(m => m.id === replyingTo)
        ? {
            mensagem: messageContent,
            quoted: {
              key: { id: replyingTo },
              message: {
                conversation: messages.find(m => m.id === replyingTo)?.content || ''
              }
            }
          }
        : { mensagem: messageContent };

      // Enviar via WhatsApp
      const { data: whatsappData, error: whatsappError } = await enviarWhatsApp({
        numero: telefoneNormalizado,
        ...mensagemParaEnviar,
        quotedMessageId: replyingTo || undefined,
        tipo_mensagem: type,
      });

      if (whatsappError) {
        console.error("Erro ao enviar para WhatsApp:", whatsappError);
        toast.error("Erro ao enviar mensagem para WhatsApp");
        setSending(false);
        return;
      }

      console.log("✅ Mensagem enviada para WhatsApp com sucesso");

      // Buscar company_id do usuário
      const companyId = await getCompanyId();

      // Salvar no banco de dados
      const { error: dbError } = await supabase.from("conversas").insert([
        {
          numero: telefoneNormalizado,
          telefone_formatado: telefoneNormalizado,
          mensagem: messageContent,
          origem: "WhatsApp",
          status: "Enviada",
          tipo_mensagem: type,
          nome_contato: leadName,
          company_id: companyId,
          replied_to_message: replyingTo ? messages.find(m => m.id === replyingTo)?.content || null : null,
        },
      ]);

      if (dbError) {
        console.error("❌ Erro ao salvar mensagem no banco:", dbError);
        toast.error("Erro ao salvar mensagem no histórico");
      } else {
        console.log("✅ Mensagem salva no Supabase");
        toast.success("Mensagem enviada com sucesso!");
      }

      // Adicionar mensagem à lista local
      const newMessage: Message = {
        id: Date.now().toString(),
        content: messageContent,
        type,
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        replyTo: replyingTo || undefined,
      };

      setMessages((prev) => [...prev, newMessage]);
      setMessageInput("");
      setReplyingTo(null);

      // Emitir evento global para sincronizar conversas
      emitGlobalEvent('onMessageSent', { numero: telefoneNormalizado, content: messageContent, type });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao processar envio");
    } finally {
      setSending(false);
    }
  };

  // Enviar mídia
  const handleSendMedia = async (file: File, caption: string, type: string) => {
    if (!leadPhone || sending) return;

    setSending(true);
    try {
      // Converter arquivo para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
      });

      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;

      const { error: whatsappError } = await enviarWhatsApp({
        numero: telefoneNormalizado,
        mensagem: caption || `Arquivo ${type}`,
        tipo_mensagem: type,
        mediaBase64: base64,
        fileName: file.name,
        mimeType: file.type,
        caption: caption || '',
      });

      if (whatsappError) {
        throw whatsappError;
      }

      const companyId = await getCompanyId();
      await supabase.from("conversas").insert([
        {
          numero: telefoneNormalizado,
          telefone_formatado: telefoneNormalizado,
          mensagem: caption || `Arquivo ${type}`,
          origem: "WhatsApp",
          status: "Enviada",
          tipo_mensagem: type,
          nome_contato: leadName,
          arquivo_nome: file.name,
          company_id: companyId,
        },
      ]);

      const newMessage: Message = {
        id: Date.now().toString(),
        content: caption || `Arquivo ${type}`,
        type: type as Message["type"],
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        mediaUrl: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
      };

      setMessages((prev) => [...prev, newMessage]);
      toast.success("Mídia enviada com sucesso!");

      emitGlobalEvent('onMessageSent', { numero: telefoneNormalizado, content: caption || `Arquivo ${type}`, type });
    } catch (error) {
      console.error("Erro ao enviar mídia:", error);
      toast.error("Erro ao enviar mídia");
    } finally {
      setSending(false);
    }
  };

  // Enviar áudio
  const handleSendAudio = async (audioBlob: Blob) => {
    if (!leadPhone || sending) return;

    setSending(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Erro ao ler áudio'));
        reader.readAsDataURL(audioBlob);
      });

      const telefoneNormalizado = normalizePhoneBR(leadPhone)!;

      const { error: whatsappError } = await enviarWhatsApp({
        numero: telefoneNormalizado,
        mensagem: 'Áudio enviado',
        tipo_mensagem: 'audio',
        mediaBase64: base64,
        fileName: 'audio.ogg',
        mimeType: 'audio/ogg; codecs=opus',
        caption: '',
      });

      if (whatsappError) {
        throw whatsappError;
      }

      const companyId = await getCompanyId();
      await supabase.from("conversas").insert([
        {
          numero: telefoneNormalizado,
          telefone_formatado: telefoneNormalizado,
          mensagem: 'Áudio enviado',
          origem: "WhatsApp",
          status: "Enviada",
          tipo_mensagem: 'audio',
          nome_contato: leadName,
          company_id: companyId,
        },
      ]);

      const newMessage: Message = {
        id: Date.now().toString(),
        content: "Áudio enviado",
        type: "audio",
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        mediaUrl: URL.createObjectURL(audioBlob),
      };

      setMessages((prev) => [...prev, newMessage]);
      toast.success("Áudio enviado com sucesso!");

      emitGlobalEvent('onMessageSent', { numero: telefoneNormalizado, content: 'Áudio enviado', type: 'audio' });
    } catch (error) {
      console.error("Erro ao enviar áudio:", error);
      toast.error("Erro ao enviar áudio");
    } finally {
      setSending(false);
    }
  };

  // Agendar mensagem
  const scheduleMessage = async () => {
    if (!leadPhone || !scheduledContent.trim() || !scheduledDatetime) {
      toast.error('Preencha a mensagem e a data/hora');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Usuário não autenticado');
        return;
      }
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!userRole?.company_id) {
        toast.error('Empresa não encontrada');
        return;
      }
    const numero = normalizePhoneBR(leadPhone || "")!;
      const { error } = await supabase
        .from('scheduled_whatsapp_messages')
        .insert([{
          company_id: userRole.company_id,
          owner_id: session.user.id,
          conversation_id: numero,
          phone_number: numero,
          contact_name: leadName,
          message_content: scheduledContent,
          scheduled_datetime: new Date(scheduledDatetime).toISOString(),
          status: 'pending',
        }]);
      if (error) throw error;
      toast.success('Mensagem agendada com sucesso!');
      setScheduledContent("");
      setScheduledDatetime("");
      carregarMensagensAgendadas();
    } catch (err) {
      console.error('Erro ao agendar:', err);
      toast.error('Erro ao agendar mensagem');
    }
  };

  // Enviar ao pressionar Enter
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formattedPhone = leadPhone ? safeFormatPhoneNumber(leadPhone) || "N/A" : "N/A";            

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={avatarUrl || leadVinculado?.avatar_url} />
                <AvatarFallback>
                  {(leadName && leadName.length > 0) ? leadName.charAt(0).toUpperCase() : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-semibold text-lg">{leadName}</span>
                <span className="text-sm text-muted-foreground font-normal">
                  {formattedPhone}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Menu de ações do lead */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 p-0"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => {
                      if (!leadVinculado) {
                        toast.error('Salve o lead antes de editar');
                        return;
                      }
                      setEditLeadOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Editar lead
                  </DropdownMenuItem>
                  {!leadVinculado && (
                    <DropdownMenuItem onClick={salvarLeadRapido}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar lead no CRM
                    </DropdownMenuItem>
                  )}
                  {leadVinculado && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={excluirLead}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir lead
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                className={showInfoPanel ? "bg-primary/10 text-primary" : ""}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <ScrollArea className="flex-1 p-6 bg-[#e5ddd5]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
              <div className="space-y-2 min-h-[200px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4 mx-auto"></div>
                      <p className="text-muted-foreground">Carregando mensagens...</p>
                    </div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Nenhuma mensagem ainda. Inicie uma conversa!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageItem
                      key={msg.id}
                      message={msg}
                      allMessages={messages}
                      onReply={(id) => setReplyingTo(id)}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      onReact={() => {}}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="bg-background border-t border-border p-4 flex-shrink-0">
              {replyingTo && (
                <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Send className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 rotate-180" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                          Respondendo mensagem
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {messages.find(m => m.id === replyingTo)?.content || ''}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReplyingTo(null)}
                      className="flex-shrink-0 h-7 w-7 p-0"
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <MediaUpload onSendMedia={handleSendMedia} />
            {/* Mensagens Rápidas */}
            <Button variant="outline" size="sm" onClick={() => setQuickOpen(true)}>
              💡 Rápidas
            </Button>
            {/* Agendar Mensagem */}
            <Button variant="outline" size="sm" onClick={() => setScheduledOpen(true)}>
              <Clock className="h-4 w-4 mr-1" /> Agendar
            </Button>
            {/* Reunião e Tarefa */}
            <Button variant="outline" size="sm" onClick={() => setAgendaOpen(true)}>
              📅 Reunião
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTarefaOpen(true)}>
              ✅ Tarefa
            </Button>
                <Input
                  placeholder="Escreva sua mensagem..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={sending || !leadPhone}
                  className="flex-1"
                />
                <AudioRecorder onSendAudio={handleSendAudio} />
                <Button
                  onClick={() => handleSendMessage()}
                  size="icon"
                  className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                  disabled={!messageInput.trim() || sending || !leadPhone}
                >
                  {sending ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </div>
              {!leadPhone && (
                <p className="text-xs text-muted-foreground mt-2">
                  Este lead não possui telefone cadastrado.
                </p>
              )}
            </div>
          </div>

          {/* Info Panel */}
          {showInfoPanel && (
            <div className="w-[340px] bg-background border-l border-border overflow-y-auto flex-shrink-0">
              <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="text-center">
                  <Avatar className="w-20 h-20 mx-auto mb-3">
                    <AvatarImage src={leadVinculado?.avatar_url} />
                    <AvatarFallback>
                      <User className="h-10 w-10 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <h3 className="text-foreground font-medium text-lg">{leadName}</h3>
                  <p className="text-muted-foreground text-sm">WhatsApp</p>
                </div>

                {/* Informações do Lead */}
                <div>
                  <h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Informações do Lead
                  </h4>
                  
                  {leadVinculado ? (
                    <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-green-500/10 text-green-600 border-green-500/20 mb-3">
                      <span className="text-xs font-medium">Lead vinculado no CRM</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-amber-500/10 text-amber-600 border-amber-500/20 mb-3">
                      <span className="text-xs font-medium">Lead não cadastrado</span>
                    </Badge>
                  )}
                  
                  <EditarInformacoesLeadDialog
                    leadId={leadId}
                    telefone={leadPhone || ""}
                    nomeContato={leadName}
                    onLeadUpdated={() => {
                      carregarLead();
                      carregarMensagens();
                    }}
                  />
                  
                  {leadVinculado && (
                    <>
                      {leadVinculado.value && (
                        <p className="text-sm text-success font-medium mt-2">
                          <strong>Valor:</strong> R$ {Number(leadVinculado.value).toLocaleString("pt-BR")}
                        </p>
                      )}
                      {leadVinculado.company && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <strong>Empresa:</strong> {leadVinculado.company}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Responsáveis */}
                <ResponsaveisManager
                  leadId={leadId}
                  responsaveisAtuais={leadVinculado?.responsavel_id ? [leadVinculado.responsavel_id] : []}
                  onResponsaveisUpdated={() => {
                    carregarLead();
                  }}
                />

                {/* Tags */}
                <div>
                  <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                    <Tag className="h-4 w-4" /> Tags
                  </h4>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {leadVinculado?.tags?.map((tag: string, idx: number) => (
                      <Badge key={idx} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Funil de Vendas */}
                {leadVinculado && (
                  <div>
                    <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Funil de Vendas
                    </h4>
                    {leadVinculado.funil_id ? (
                      <Badge variant="outline" className="w-full justify-center py-2">
                        Lead no funil
                      </Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground mb-2">
                        Não está em nenhum funil
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      {/* Dialog: Mensagens Rápidas */}
      <UIDialog open={quickOpen} onOpenChange={setQuickOpen}>
        <UIDialogContent>
          <UIDialogHeader>
            <UIDialogTitle>Mensagens Rápidas</UIDialogTitle>
          </UIDialogHeader>
          <div className="grid gap-2">
            {[
              `Olá ${leadName && leadName.split(' ').length > 0 ? leadName.split(' ')[0] : 'cliente'}, tudo bem? Posso ajudar?`,
              'Estamos com uma condição especial hoje, posso te explicar?',
              'Consegue me enviar um áudio ou uma foto para entender melhor?'
            ].map((msg) => (
              <Button key={msg} variant="outline" className="justify-start" onClick={() => { handleSendMessage(msg); setQuickOpen(false); }}>
                {msg}
              </Button>
            ))}
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Dialog: Agendar Mensagem */}
      <UIDialog open={scheduledOpen} onOpenChange={(o) => { setScheduledOpen(o); if (o) carregarMensagensAgendadas(); }}>
        <UIDialogContent className="max-w-lg">
          <UIDialogHeader>
            <UIDialogTitle>Agendar Mensagem</UIDialogTitle>
          </UIDialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Mensagem</Label>
              <Input value={scheduledContent} onChange={(e) => setScheduledContent(e.target.value)} placeholder="Digite a mensagem..." />
            </div>
            <div>
              <Label>Data/Hora</Label>
              <Input type="datetime-local" value={scheduledDatetime} onChange={(e) => setScheduledDatetime(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={scheduleMessage} disabled={!scheduledContent.trim() || !scheduledDatetime}>Agendar</Button>
            </div>
            <div className="pt-2">
              <h4 className="text-sm font-medium mb-2">Agendadas</h4>
              <div className="space-y-2 max-h-48 overflow-auto">
                {scheduledList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem agendada</p>
                ) : scheduledList.map((m) => (
                  <div key={m.id} className="p-2 rounded border flex items-center justify-between">
                    <div className="text-sm pr-2 truncate">{m.message_content}</div>
                    <div className="text-xs text-muted-foreground">{new Date(m.scheduled_datetime).toLocaleString('pt-BR')}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </UIDialogContent>
      </UIDialog>

      {/* Dialog: Editar Lead (controle pelo menu do cabeçalho) */}
      {leadVinculado && (
        <EditarLeadDialog
          lead={{
            id: leadVinculado.id,
            nome: leadVinculado.name || leadName,
            telefone: leadVinculado.telefone || leadPhone || '',
            email: leadVinculado.email || '',
            cpf: leadVinculado.cpf || '',
            value: leadVinculado.value || 0,
            company: leadVinculado.company || '',
            source: leadVinculado.source || '',
            notes: leadVinculado.notes || '',
            tags: leadVinculado.tags || [],
            funil_id: leadVinculado.funil_id || undefined,
            etapa_id: leadVinculado.etapa_id || undefined,
          }}
          open={editLeadOpen}
          onOpenChange={(o) => setEditLeadOpen(o)}
          onLeadUpdated={() => {
            carregarLead();
            toast.success('Lead atualizado');
          }}
        />
      )}

      {/* Modais: Reunião e Tarefa */}
      <AgendaModal
        open={agendaOpen}
        onOpenChange={(o) => setAgendaOpen(o)}
        lead={{ id: leadId, nome: leadName, telefone: leadPhone }}
        onAgendamentoCriado={() => {
          toast.success('Reunião agendada');
          emitGlobalEvent('onMeetingScheduled', { lead_id: leadId });
        }}
      />
      <TarefaModal
        open={tarefaOpen}
        onOpenChange={(o) => setTarefaOpen(o)}
        lead={{ id: leadId, nome: leadName }}
        onTarefaCriada={() => {
          toast.success('Tarefa criada');
          emitGlobalEvent('onTaskCreated', { lead_id: leadId });
        }}
      />
      </DialogContent>
    </Dialog>
  );
}