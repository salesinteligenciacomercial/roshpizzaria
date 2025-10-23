import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, Instagram, Facebook, Send, Search, Bot, User, Paperclip, 
  Clock, Calendar, Zap, FileText, Tag, TrendingUp, ArrowRightLeft, Image as ImageIcon,
  Mic, FileUp, Check, CheckCheck, Phone, Video, Info, DollarSign, Users, Bell, Download, Volume2
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  mediaUrl?: string;
  fileName?: string;
}

interface Conversation {
  id: string;
  contactName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  status: "waiting" | "answered" | "resolved";
  lastMessage: string;
  unread: number;
  messages: Message[];
  tags: string[];
  funnelStage?: string;
  responsavel?: string;
  produto?: string;
  valor?: string;
  anotacoes?: string;
}

interface QuickMessage {
  id: string;
  title: string;
  content: string;
}

interface Reminder {
  id: string;
  conversationId: string;
  title: string;
  datetime: string;
  notes: string;
}

interface ScheduledMessage {
  id: string;
  conversationId: string;
  content: string;
  datetime: string;
}

interface Meeting {
  id: string;
  conversationId: string;
  title: string;
  datetime: string;
  notes: string;
}

const CONVERSATIONS_KEY = "continuum_conversations";
const QUICK_MESSAGES_KEY = "continuum_quick_messages";
const REMINDERS_KEY = "continuum_reminders";
const SCHEDULED_MESSAGES_KEY = "continuum_scheduled_messages";
const MEETINGS_KEY = "continuum_meetings";
const AI_MODE_KEY = "continuum_ai_mode";

const initialConversations: Conversation[] = [
  {
    id: "1",
    contactName: "João Silva",
    channel: "whatsapp",
    status: "waiting",
    lastMessage: "Gostaria de saber mais sobre o produto",
    unread: 2,
    tags: ["cliente", "interesse"],
    funnelStage: "Novo",
    responsavel: "Você",
    produto: "Sistema CRM Premium",
    valor: "R$ 5.000,00",
    anotacoes: "Cliente interessado em plano anual",
    messages: [
      { id: "1", content: "Olá! Gostaria de saber mais sobre o produto", type: "text", sender: "contact", timestamp: new Date(Date.now() - 300000), delivered: true },
      { id: "2", content: "Vocês têm disponibilidade para esta semana?", type: "text", sender: "contact", timestamp: new Date(Date.now() - 180000), delivered: true },
    ],
  },
  {
    id: "2",
    contactName: "Maria Santos",
    channel: "instagram",
    status: "answered",
    lastMessage: "Obrigada pelas informações!",
    unread: 0,
    tags: ["promoção"],
    funnelStage: "Qualificado",
    responsavel: "Ana Costa",
    produto: "Consultoria Digital",
    valor: "R$ 2.500,00",
    messages: [
      { id: "1", content: "Vi o post sobre promoção", type: "text", sender: "contact", timestamp: new Date(Date.now() - 7200000), delivered: true },
      { id: "2", content: "Olá Maria! Temos várias opções em promoção. Qual produto te interessa?", type: "text", sender: "user", timestamp: new Date(Date.now() - 7000000), delivered: true },
      { id: "3", content: "Obrigada pelas informações!", type: "text", sender: "contact", timestamp: new Date(Date.now() - 6800000), delivered: true },
    ],
  },
  {
    id: "3",
    contactName: "Carlos Oliveira",
    channel: "facebook",
    status: "resolved",
    lastMessage: "Fechado! Muito obrigado",
    unread: 0,
    tags: ["venda", "fechado"],
    funnelStage: "Fechado",
    responsavel: "Pedro Lima",
    produto: "Plano Enterprise",
    valor: "R$ 15.000,00",
    messages: [
      { id: "1", content: "Quero fazer uma compra", type: "text", sender: "contact", timestamp: new Date(Date.now() - 86400000), delivered: true },
      { id: "2", content: "Ótimo! Vou te passar os detalhes.", type: "text", sender: "user", timestamp: new Date(Date.now() - 86000000), delivered: true },
      { id: "3", content: "Fechado! Muito obrigado", type: "text", sender: "contact", timestamp: new Date(Date.now() - 85000000), delivered: true },
    ],
  },
];

export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "answered" | "resolved">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [aiMode, setAiMode] = useState<Record<string, boolean>>({});
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Form states
  const [newQuickTitle, setNewQuickTitle] = useState("");
  const [newQuickContent, setNewQuickContent] = useState("");
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDatetime, setReminderDatetime] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [newTag, setNewTag] = useState("");
  const [selectedFunnel, setSelectedFunnel] = useState("");
  const [newResponsavel, setNewResponsavel] = useState("");
  const [newProduto, setNewProduto] = useState("");
  const [newValor, setNewValor] = useState("");
  const [newAnotacoes, setNewAnotacoes] = useState("");

  const funnelStages = ["Novo", "Qualificado", "Em Negociação", "Fechado", "Perdido"];
  const usuarios = ["Você", "Ana Costa", "Pedro Lima", "Julia Santos", "Carlos Mendes"];

  useEffect(() => {
    loadConversations();
    loadQuickMessages();
    loadReminders();
    loadScheduledMessages();
    loadMeetings();
    loadAiMode();
    loadSupabaseConversations();

    // Subscrever para atualizações em tempo real
    const channel = supabase
      .channel('conversas_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversas'
        },
        (payload) => {
          console.log('📩 Nova mensagem recebida:', payload);
          loadSupabaseConversations();
          toast.success('Nova mensagem recebida do WhatsApp!');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConv?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = () => {
    const saved = localStorage.getItem(CONVERSATIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const withDates = parsed.map((conv: any) => ({
        ...conv,
        messages: conv.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }));
      setConversations(withDates);
    } else {
      setConversations(initialConversations);
      localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(initialConversations));
    }
  };

  const loadSupabaseConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversas')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar conversas:', error);
        return;
      }

      // Filtrar mensagens com variáveis N8n não substituídas ou dados inválidos
      const validData = data?.filter(conv => {
        const hasInvalidVariables = 
          conv.numero?.includes('{{') || conv.numero?.includes('$json') ||
          conv.mensagem?.includes('{{') || conv.mensagem?.includes('$json') ||
          conv.nome_contato?.includes('{{') || conv.nome_contato?.includes('$json');
        
        const hasInvalidData =
          !conv.numero || conv.numero === '=' || conv.numero.trim() === '' ||
          !conv.mensagem || conv.mensagem === '[object Object]' || conv.mensagem.trim() === '';
        
        if (hasInvalidVariables || hasInvalidData) {
          console.warn('⚠️ Mensagem inválida ignorada:', conv);
        }
        
        return !hasInvalidVariables && !hasInvalidData;
      }) || [];

      if (validData && validData.length > 0) {
        // Agrupar mensagens por número
        const conversasAgrupadas = validData.reduce((acc: Record<string, any[]>, conv: any) => {
          if (!acc[conv.numero]) {
            acc[conv.numero] = [];
          }
          acc[conv.numero].push(conv);
          return acc;
        }, {});

        // Converter para formato local
        const novasConversas: Conversation[] = Object.entries(conversasAgrupadas).map(([numero, mensagens]) => {
          const ultima = mensagens[0];
          
          const messagensFormatadas = [...mensagens].reverse().map(m => {
            const msgContent = m.mensagem || 'Sem conteúdo';
            let msgType = m.tipo_mensagem || 'text';
            
            // Normalizar tipos
            if (msgType === 'texto') msgType = 'text';
            if (msgType === 'document') msgType = 'pdf';
            
            // Extrair nome do arquivo de documentos
            let fileName: string | undefined;
            if (msgType === 'pdf' && msgContent.includes('[Documento:')) {
              fileName = msgContent.match(/\[Documento: (.+)\]/)?.[1];
            }
            
            return {
              id: m.id,
              content: msgContent,
              type: msgType as "text" | "image" | "audio" | "pdf",
              sender: m.status === 'Enviada' ? 'user' : 'contact' as "user" | "contact",
              timestamp: new Date(m.created_at),
              delivered: true,
              mediaUrl: m.midia_url || undefined,
              fileName: fileName,
            };
          });
          
          console.log('📦 Conversa formatada completa:', {
            numero,
            totalMensagens: messagensFormatadas.length,
            primeiroContent: messagensFormatadas[0]?.content,
            todasMensagens: messagensFormatadas.map(m => ({ id: m.id, content: m.content }))
          });
          
          return {
            id: numero,
            contactName: ultima.nome_contato || numero,
            channel: (ultima.origem.toLowerCase() === 'whatsapp' ? 'whatsapp' : 
                     ultima.origem.toLowerCase() === 'instagram' ? 'instagram' : 'facebook') as "whatsapp" | "instagram" | "facebook",
            lastMessage: ultima.mensagem || '',
            unread: mensagens.filter(m => m.status === 'Recebida').length,
            status: ultima.status === 'Recebida' ? 'waiting' : 'answered' as "waiting" | "answered" | "resolved",
            messages: messagensFormatadas,
            tags: [],
            funnelStage: "Novo",
          };
        });

        setConversations(prev => {
          // Mesclar com conversas existentes do localStorage
          const merged = [...prev];
          novasConversas.forEach(nova => {
            const existingIndex = merged.findIndex(c => c.id === nova.id);
            if (existingIndex >= 0) {
              // PRIORIZAR mensagens do Supabase, manter metadados do localStorage
              merged[existingIndex] = {
                ...nova, // DADOS DO SUPABASE (mensagens, lastMessage, etc)
                tags: merged[existingIndex].tags || nova.tags,
                funnelStage: merged[existingIndex].funnelStage || nova.funnelStage,
                responsavel: merged[existingIndex].responsavel,
                produto: merged[existingIndex].produto,
                valor: merged[existingIndex].valor,
                anotacoes: merged[existingIndex].anotacoes,
              };
            } else {
              merged.push(nova);
            }
          });
          
          // ATUALIZAR selectedConv se ela estiver aberta
          if (selectedConv) {
            const updated = merged.find(c => c.id === selectedConv.id);
            if (updated) {
              setSelectedConv(updated);
            }
          }
          
          return merged;
        });
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const loadQuickMessages = () => {
    const saved = localStorage.getItem(QUICK_MESSAGES_KEY);
    if (saved) {
      setQuickMessages(JSON.parse(saved));
    } else {
      const initial = [
        { id: "1", title: "Saudação", content: "Olá! Como posso ajudar você hoje?" },
        { id: "2", title: "Informações", content: "Gostaria de saber mais sobre o produto?" },
      ];
      setQuickMessages(initial);
      localStorage.setItem(QUICK_MESSAGES_KEY, JSON.stringify(initial));
    }
  };

  const loadReminders = () => {
    const saved = localStorage.getItem(REMINDERS_KEY);
    if (saved) setReminders(JSON.parse(saved));
  };

  const loadScheduledMessages = () => {
    const saved = localStorage.getItem(SCHEDULED_MESSAGES_KEY);
    if (saved) setScheduledMessages(JSON.parse(saved));
  };

  const loadMeetings = () => {
    const saved = localStorage.getItem(MEETINGS_KEY);
    if (saved) setMeetings(JSON.parse(saved));
  };

  const loadAiMode = () => {
    const saved = localStorage.getItem(AI_MODE_KEY);
    if (saved) setAiMode(JSON.parse(saved));
  };

  const saveConversations = (updated: Conversation[]) => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
    setConversations(updated);
  };

  const saveQuickMessages = (updated: QuickMessage[]) => {
    localStorage.setItem(QUICK_MESSAGES_KEY, JSON.stringify(updated));
    setQuickMessages(updated);
  };

  const saveReminders = (updated: Reminder[]) => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
    setReminders(updated);
  };

  const saveScheduledMessages = (updated: ScheduledMessage[]) => {
    localStorage.setItem(SCHEDULED_MESSAGES_KEY, JSON.stringify(updated));
    setScheduledMessages(updated);
  };

  const saveMeetings = (updated: Meeting[]) => {
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(updated));
    setMeetings(updated);
  };

  const saveAiMode = (updated: Record<string, boolean>) => {
    localStorage.setItem(AI_MODE_KEY, JSON.stringify(updated));
    setAiMode(updated);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="h-3.5 w-3.5 text-[#25D366]" />;
      case "instagram":
        return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-3.5 w-3.5 text-blue-600" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5" />;
    }
  };

  const toggleAiMode = (convId: string) => {
    const updated = { ...aiMode, [convId]: !aiMode[convId] };
    saveAiMode(updated);
    toast.success(updated[convId] ? "IA ativada" : "IA desativada");
  };

  const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
    const messageContent = content || messageInput.trim();
    if (!messageContent || !selectedConv) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      type,
      sender: "user",
      timestamp: new Date(),
      delivered: true,
    };

    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? {
            ...conv,
            messages: [...conv.messages, newMessage],
            lastMessage: type === "text" ? messageContent : `📎 ${type}`,
            status: "answered" as const,
            unread: 0,
          }
        : conv
    );

    saveConversations(updatedConversations);
    setSelectedConv({
      ...selectedConv,
      messages: [...selectedConv.messages, newMessage],
      lastMessage: type === "text" ? messageContent : `📎 ${type}`,
      status: "answered",
    });
    setMessageInput("");
    // Enviar mensagem via Evolution API
    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          numero: selectedConv.id,
          mensagem: messageContent,
          tipo_mensagem: type,
        }
      });

      if (error) {
        console.error('Erro ao enviar para WhatsApp:', error);
        toast.error('Erro ao enviar mensagem para WhatsApp');
        return;
      }

      console.log('✅ Resposta Evolution API:', data);
      toast.success("Mensagem enviada para WhatsApp!");

      // Salvar no Supabase após sucesso
      const { error: dbError } = await supabase.from('conversas').insert([{
        numero: selectedConv.id,
        mensagem: messageContent,
        origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : 
                selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
        status: 'Enviada',
        tipo_mensagem: type,
        nome_contato: selectedConv.contactName,
      }]);

      if (dbError) {
        console.error('Erro ao salvar mensagem no banco:', dbError);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao processar envio');
    }

    // Simulate contact response if AI is active
    if (aiMode[selectedConv.id]) {
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: "Resposta automática da IA: entendi sua mensagem!",
          type: "text",
          sender: "contact",
          timestamp: new Date(),
          delivered: true,
        };
        
        const withAiResponse = updatedConversations.map((conv) =>
          conv.id === selectedConv.id
            ? { ...conv, messages: [...conv.messages, newMessage, aiResponse], unread: conv.unread + 1 }
            : conv
        );
        
        saveConversations(withAiResponse);
        if (selectedConv.id === selectedConv.id) {
          setSelectedConv((prev) =>
            prev ? { ...prev, messages: [...prev.messages, aiResponse] } : prev
          );
        }
      }, 2000);
    }
  };

  const handleFileAttach = (type: "image" | "audio" | "pdf") => {
    toast.info(`Anexando ${type}...`);
    setTimeout(() => {
      handleSendMessage(`Arquivo ${type} anexado`, type);
    }, 1000);
  };

  const addQuickMessage = () => {
    if (!newQuickTitle.trim() || !newQuickContent.trim()) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    const newMsg: QuickMessage = {
      id: Date.now().toString(),
      title: newQuickTitle,
      content: newQuickContent,
    };
    saveQuickMessages([...quickMessages, newMsg]);
    setNewQuickTitle("");
    setNewQuickContent("");
    toast.success("Mensagem rápida criada!");
  };

  const deleteQuickMessage = (id: string) => {
    saveQuickMessages(quickMessages.filter(m => m.id !== id));
    toast.success("Mensagem rápida removida!");
  };

  const sendQuickMessage = (content: string) => {
    handleSendMessage(content);
  };

  const addReminder = () => {
    if (!selectedConv || !reminderTitle.trim() || !reminderDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }
    const newReminder: Reminder = {
      id: Date.now().toString(),
      conversationId: selectedConv.id,
      title: reminderTitle,
      datetime: reminderDatetime,
      notes: reminderNotes,
    };
    saveReminders([...reminders, newReminder]);
    setReminderTitle("");
    setReminderDatetime("");
    setReminderNotes("");
    toast.success("Lembrete agendado!");
  };

  const scheduleMessage = () => {
    if (!selectedConv || !scheduledContent.trim() || !scheduledDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }
    const newScheduled: ScheduledMessage = {
      id: Date.now().toString(),
      conversationId: selectedConv.id,
      content: scheduledContent,
      datetime: scheduledDatetime,
    };
    saveScheduledMessages([...scheduledMessages, newScheduled]);
    setScheduledContent("");
    setScheduledDatetime("");
    toast.success("Mensagem agendada!");
  };

  const scheduleMeeting = () => {
    if (!selectedConv || !meetingTitle.trim() || !meetingDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }
    const newMeeting: Meeting = {
      id: Date.now().toString(),
      conversationId: selectedConv.id,
      title: meetingTitle,
      datetime: meetingDatetime,
      notes: meetingNotes,
    };
    saveMeetings([...meetings, newMeeting]);
    setMeetingTitle("");
    setMeetingDatetime("");
    setMeetingNotes("");
    toast.success("Reunião agendada!");
  };

  const addTag = () => {
    if (!selectedConv || !newTag.trim()) {
      toast.error("Digite uma tag");
      return;
    }
    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? { ...conv, tags: [...(conv.tags || []), newTag] }
        : conv
    );
    saveConversations(updatedConversations);
    setSelectedConv({ ...selectedConv, tags: [...(selectedConv.tags || []), newTag] });
    setNewTag("");
    toast.success("Tag adicionada!");
  };

  const addToFunnel = () => {
    if (!selectedConv || !selectedFunnel) {
      toast.error("Selecione um estágio");
      return;
    }
    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? { ...conv, funnelStage: selectedFunnel }
        : conv
    );
    saveConversations(updatedConversations);
    setSelectedConv({ ...selectedConv, funnelStage: selectedFunnel });
    setSelectedFunnel("");
    toast.success("Adicionado ao funil!");
  };

  const updateResponsavel = () => {
    if (!selectedConv || !newResponsavel) {
      toast.error("Selecione um responsável");
      return;
    }
    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? { ...conv, responsavel: newResponsavel }
        : conv
    );
    saveConversations(updatedConversations);
    setSelectedConv({ ...selectedConv, responsavel: newResponsavel });
    setNewResponsavel("");
    toast.success("Responsável atualizado!");
  };

  const updateLeadInfo = () => {
    if (!selectedConv) return;
    
    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? { 
            ...conv, 
            produto: newProduto || conv.produto,
            valor: newValor || conv.valor,
            anotacoes: newAnotacoes !== undefined ? newAnotacoes : conv.anotacoes
          }
        : conv
    );
    saveConversations(updatedConversations);
    setSelectedConv({ 
      ...selectedConv, 
      produto: newProduto || selectedConv.produto,
      valor: newValor || selectedConv.valor,
      anotacoes: newAnotacoes !== undefined ? newAnotacoes : selectedConv.anotacoes
    });
    setNewProduto("");
    setNewValor("");
    setNewAnotacoes("");
    toast.success("Informações atualizadas!");
  };

  const filteredConversations = conversations
    .filter((conv) => filter === "all" || conv.status === filter)
    .filter((conv) => conv.contactName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar esquerda - tema cinza claro */}
      <div className="w-[380px] bg-muted/30 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 bg-background border-b border-border">
          <h1 className="text-xl font-semibold text-foreground mb-4">Conversas</h1>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="🔍 Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={filter === "waiting" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("waiting")}
            >
              Aguardando
            </Button>
            <Button
              variant={filter === "answered" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("answered")}
            >
              Respondidos
            </Button>
            <Button
              variant={filter === "resolved" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("resolved")}
            >
              Resolvidos
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {filteredConversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-4 border-b border-border cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedConv?.id === conv.id ? "bg-muted/70" : ""
              }`}
              onClick={() => {
                console.log('🔍 Conversa selecionada:', conv.id, 'Mensagens:', conv.messages.length);
                setSelectedConv(conv);
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getChannelIcon(conv.channel)}
                  <span className="font-medium text-sm text-foreground">{conv.contactName}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(conv.messages[conv.messages.length - 1]?.timestamp).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {conv.unread > 0 && (
                    <Badge className="bg-[#25D366] hover:bg-[#25D366] text-white text-xs h-5 min-w-5 rounded-full flex items-center justify-center">
                      {conv.unread}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Chat Header com info do lead */}
            <div className="bg-background border-b border-border px-6 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-medium">{selectedConv.contactName}</h2>
                    <div className="flex items-center gap-2">
                      {getChannelIcon(selectedConv.channel)}
                      <span className="text-xs text-muted-foreground capitalize">{selectedConv.channel}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Phone className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Video className="h-5 w-5" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowInfoPanel(!showInfoPanel)}
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                </div>
              </div>
              {/* Informações do Lead */}
              <div className="flex items-center gap-4 text-sm">
                {selectedConv.produto && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{selectedConv.produto}</span>
                  </div>
                )}
                {selectedConv.valor && (
                  <div className="flex items-center gap-1 text-success font-medium">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>{selectedConv.valor}</span>
                  </div>
                )}
                {selectedConv.responsavel && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>{selectedConv.responsavel}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-6 bg-[#e5ddd5]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
                  <div className="space-y-2 min-h-[200px]">
                     {selectedConv.messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem ainda
                      </div>
                     ) : (
                      selectedConv.messages.map((msg) => {
                        return (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                        >
                          <div
                            className={`max-w-[65%] rounded-lg px-3 py-2 shadow-sm ${
                              msg.sender === "user"
                                ? "bg-[#d9fdd3] text-foreground"
                                : "bg-white text-foreground"
                            }`}
                          >
                            {msg.type === "text" && (
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                            
                            {msg.type === "image" && msg.mediaUrl && (
                              <div className="space-y-2">
                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Imagem"
                                    className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{ maxHeight: '400px', maxWidth: '300px' }}
                                    onError={(e) => {
                                      console.error('Erro ao carregar imagem:', msg.mediaUrl);
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      const parent = (e.target as HTMLElement).parentElement?.parentElement;
                                      if (parent) {
                                        parent.innerHTML = '<div class="flex items-center gap-2 text-muted-foreground"><svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg><span class="text-xs">Imagem não disponível</span></div>';
                                      }
                                    }}
                                  />
                                </a>
                                {msg.content && !msg.content.includes('[Imagem]') && (
                                  <p className="text-sm">{msg.content}</p>
                                )}
                                <a 
                                  href={msg.mediaUrl} 
                                  download={`imagem-${msg.id}.jpg`}
                                  className="text-xs underline opacity-70 hover:opacity-100 flex items-center gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Baixar imagem
                                </a>
                              </div>
                            )}
                            
                            {msg.type === "audio" && msg.mediaUrl && (
                              <div className="space-y-2 min-w-[250px]">
                                <div className="flex items-center gap-2">
                                  <Volume2 className="h-4 w-4" />
                                  <span className="text-sm font-medium">Mensagem de áudio</span>
                                </div>
                                <audio controls className="w-full h-8" style={{ maxWidth: '300px' }}>
                                  <source src={msg.mediaUrl} />
                                  Seu navegador não suporta reprodução de áudio.
                                </audio>
                                <a 
                                  href={msg.mediaUrl} 
                                  download={`audio-${msg.id}.ogg`}
                                  className="text-xs underline opacity-70 hover:opacity-100 flex items-center gap-1"
                                >
                                  <Download className="h-3 w-3" />
                                  Baixar áudio
                                </a>
                              </div>
                            )}
                            
                            {msg.type === "pdf" && msg.mediaUrl && (
                              <div className="space-y-2 min-w-[200px]">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-5 w-5" />
                                  <span className="text-sm font-medium">
                                    {msg.fileName || 'Documento'}
                                  </span>
                                </div>
                                <a 
                                  href={msg.mediaUrl} 
                                  download={msg.fileName || 'documento.pdf'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs bg-background/50 hover:bg-background px-3 py-2 rounded border transition-colors"
                                >
                                  <Download className="h-3 w-3" />
                                  Baixar arquivo
                                </a>
                              </div>
                            )}

                            {/* Fallback para mídias sem URL */}
                            {msg.type === "image" && !msg.mediaUrl && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <ImageIcon className="h-8 w-8" />
                                <span className="text-xs">Imagem anexada</span>
                              </div>
                            )}
                            {msg.type === "audio" && !msg.mediaUrl && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mic className="h-4 w-4" />
                                <span className="text-xs">Áudio anexado</span>
                              </div>
                            )}
                            {msg.type === "pdf" && !msg.mediaUrl && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span className="text-xs">Documento PDF</span>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-1 mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {msg.timestamp.toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {msg.sender === "user" && (
                                msg.delivered ? <CheckCheck className="h-3 w-3 text-[#53bdeb]" /> : <Check className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="bg-background border-t border-border p-4">
                  <div className="flex items-center gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Paperclip className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Anexar arquivo</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Button 
                            onClick={() => handleFileAttach("image")} 
                            className="w-full justify-start"
                            variant="outline"
                          >
                            <ImageIcon className="h-4 w-4 mr-2" /> Enviar imagem
                          </Button>
                          <Button 
                            onClick={() => handleFileAttach("audio")} 
                            className="w-full justify-start"
                            variant="outline"
                          >
                            <Mic className="h-4 w-4 mr-2" /> Enviar áudio
                          </Button>
                          <Button 
                            onClick={() => handleFileAttach("pdf")} 
                            className="w-full justify-start"
                            variant="outline"
                          >
                            <FileUp className="h-4 w-4 mr-2" /> Enviar documento (PDF)
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Input
                      placeholder="Escreva sua mensagem..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => handleSendMessage()} 
                      size="icon"
                      className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Info Panel */}
              {showInfoPanel && (
                <div className="w-[340px] bg-background border-l border-border overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {/* Contact Info */}
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <User className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-foreground font-medium text-lg">{selectedConv.contactName}</h3>
                      <p className="text-muted-foreground text-sm capitalize">{selectedConv.channel}</p>
                    </div>

                    {/* Informações do Lead */}
                    <div>
                      <h4 className="text-foreground font-medium mb-3 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" /> Informações do Lead
                      </h4>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full mb-2">
                            <FileText className="h-3 w-3 mr-2" /> Editar Informações
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Informações do Lead</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Produto de Interesse</Label>
                              <Input
                                placeholder={selectedConv.produto || "Ex: Sistema CRM"}
                                value={newProduto}
                                onChange={(e) => setNewProduto(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Valor da Negociação</Label>
                              <Input
                                placeholder={selectedConv.valor || "Ex: R$ 5.000,00"}
                                value={newValor}
                                onChange={(e) => setNewValor(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Anotações Internas</Label>
                              <Textarea
                                placeholder={selectedConv.anotacoes || "Observações sobre o lead..."}
                                value={newAnotacoes}
                                onChange={(e) => setNewAnotacoes(e.target.value)}
                                rows={4}
                              />
                            </div>
                            <Button onClick={updateLeadInfo} className="w-full">
                              Salvar Informações
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      {selectedConv.produto && (
                        <p className="text-sm text-muted-foreground mb-1">
                          <strong>Produto:</strong> {selectedConv.produto}
                        </p>
                      )}
                      {selectedConv.valor && (
                        <p className="text-sm text-success font-medium mb-1">
                          <strong>Valor:</strong> {selectedConv.valor}
                        </p>
                      )}
                      {selectedConv.anotacoes && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <strong>Anotações:</strong> {selectedConv.anotacoes}
                        </div>
                      )}
                    </div>

                    {/* Responsável */}
                    <div>
                      <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" /> Responsável
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">{selectedConv.responsavel || "Não definido"}</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full">
                            <User className="h-3 w-3 mr-2" /> Atribuir Responsável
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Atribuir Responsável</DialogTitle>
                          </DialogHeader>
                          <Select value={newResponsavel} onValueChange={setNewResponsavel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o responsável" />
                            </SelectTrigger>
                            <SelectContent>
                              {usuarios.map((user) => (
                                <SelectItem key={user} value={user}>
                                  {user}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={updateResponsavel}>
                            Atribuir
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Tags */}
                    <div>
                      <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Tags
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedConv.tags?.map((tag, idx) => (
                          <Badge key={idx} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full">
                            <Tag className="h-3 w-3 mr-2" /> Adicionar Tag
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adicionar Tag</DialogTitle>
                          </DialogHeader>
                          <Input
                            placeholder="Nome da tag"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                          />
                          <Button onClick={addTag}>
                            Adicionar
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Funnel Stage */}
                    <div>
                      <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Estágio do Funil
                      </h4>
                      <p className="text-sm text-muted-foreground mb-2">{selectedConv.funnelStage || "Não definido"}</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full">
                            <TrendingUp className="h-3 w-3 mr-2" /> Adicionar ao Funil
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adicionar ao Funil</DialogTitle>
                          </DialogHeader>
                          <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o estágio" />
                            </SelectTrigger>
                            <SelectContent>
                              {funnelStages.map((stage) => (
                                <SelectItem key={stage} value={stage}>
                                  {stage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={addToFunnel}>
                            Adicionar
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <h4 className="text-foreground font-medium mb-3">Ações Rápidas</h4>
                      <div className="space-y-2">
                        {/* AI Toggle */}
                        <Button
                          onClick={() => toggleAiMode(selectedConv.id)}
                          variant={aiMode[selectedConv.id] ? "default" : "outline"}
                          className="w-full justify-start"
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          {aiMode[selectedConv.id] ? "Desativar IA" : "Ativar IA"}
                        </Button>

                        {/* Quick Messages */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Zap className="h-4 w-4 mr-2" /> Mensagens Rápidas
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>💡 Mensagens Rápidas</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label>Título</Label>
                                <Input
                                  value={newQuickTitle}
                                  onChange={(e) => setNewQuickTitle(e.target.value)}
                                  placeholder="Ex: Saudação"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Mensagem</Label>
                                <Textarea
                                  value={newQuickContent}
                                  onChange={(e) => setNewQuickContent(e.target.value)}
                                  placeholder="Digite a mensagem..."
                                />
                              </div>
                              <Button onClick={addQuickMessage} className="w-full">
                                Criar Mensagem Rápida
                              </Button>
                              <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-2">Mensagens salvas:</h4>
                                <div className="space-y-2">
                                  {quickMessages.map((qm) => (
                                    <div key={qm.id} className="flex items-center justify-between p-2 bg-muted rounded">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{qm.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{qm.content}</p>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          onClick={() => sendQuickMessage(qm.content)}
                                        >
                                          Enviar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => deleteQuickMessage(qm.id)}
                                        >
                                          ×
                                        </Button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Schedule Message */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Clock className="h-4 w-4 mr-2" /> Agendar Mensagem
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agendar Mensagem</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Mensagem</Label>
                                <Textarea
                                  value={scheduledContent}
                                  onChange={(e) => setScheduledContent(e.target.value)}
                                  placeholder="Digite a mensagem..."
                                />
                              </div>
                              <div>
                                <Label>Data e Hora</Label>
                                <Input
                                  type="datetime-local"
                                  value={scheduledDatetime}
                                  onChange={(e) => setScheduledDatetime(e.target.value)}
                                />
                              </div>
                              <Button onClick={scheduleMessage} className="w-full">
                                Agendar Envio
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Schedule Reminder */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Bell className="h-4 w-4 mr-2" /> Agendar Lembrete
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agendar Lembrete</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Título do Lembrete</Label>
                                <Input
                                  value={reminderTitle}
                                  onChange={(e) => setReminderTitle(e.target.value)}
                                  placeholder="Ex: Ligar para cliente"
                                />
                              </div>
                              <div>
                                <Label>Data e Hora</Label>
                                <Input
                                  type="datetime-local"
                                  value={reminderDatetime}
                                  onChange={(e) => setReminderDatetime(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>Observações</Label>
                                <Textarea
                                  value={reminderNotes}
                                  onChange={(e) => setReminderNotes(e.target.value)}
                                  placeholder="Notas adicionais..."
                                />
                              </div>
                              <Button onClick={addReminder} className="w-full">
                                Criar Lembrete
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Schedule Meeting */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Calendar className="h-4 w-4 mr-2" /> Agendar Reunião
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agendar Reunião</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Título da Reunião</Label>
                                <Input
                                  value={meetingTitle}
                                  onChange={(e) => setMeetingTitle(e.target.value)}
                                  placeholder="Ex: Apresentação de proposta"
                                />
                              </div>
                              <div>
                                <Label>Data e Hora</Label>
                                <Input
                                  type="datetime-local"
                                  value={meetingDatetime}
                                  onChange={(e) => setMeetingDatetime(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>Observações</Label>
                                <Textarea
                                  value={meetingNotes}
                                  onChange={(e) => setMeetingNotes(e.target.value)}
                                  placeholder="Pauta, participantes, etc..."
                                />
                              </div>
                              <Button onClick={scheduleMeeting} className="w-full">
                                Agendar Reunião
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Transfer */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferir Atendimento
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Transferir Atendimento</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2">
                              {usuarios.filter(u => u !== selectedConv.responsavel).map((user) => (
                                <Button 
                                  key={user}
                                  variant="outline" 
                                  className="w-full justify-start"
                                  onClick={() => {
                                    setNewResponsavel(user);
                                    updateResponsavel();
                                  }}
                                >
                                  {user}
                                </Button>
                              ))}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}