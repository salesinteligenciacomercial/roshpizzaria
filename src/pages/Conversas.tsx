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
  Mic, FileUp, Check, CheckCheck, MoreVertical, Phone, Video, Info
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  fileUrl?: string;
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

const CONVERSATIONS_KEY = "continuum_conversations";
const QUICK_MESSAGES_KEY = "continuum_quick_messages";
const REMINDERS_KEY = "continuum_reminders";
const SCHEDULED_MESSAGES_KEY = "continuum_scheduled_messages";
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
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Quick messages dialog states
  const [newQuickTitle, setNewQuickTitle] = useState("");
  const [newQuickContent, setNewQuickContent] = useState("");
  
  // Reminder dialog states
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDatetime, setReminderDatetime] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  
  // Scheduled message dialog states
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  
  // Tag dialog state
  const [newTag, setNewTag] = useState("");
  
  // Funnel dialog state
  const [selectedFunnel, setSelectedFunnel] = useState("");

  const funnelStages = ["Novo", "Qualificado", "Em Negociação", "Fechado", "Perdido"];

  useEffect(() => {
    loadConversations();
    loadQuickMessages();
    loadReminders();
    loadScheduledMessages();
    loadAiMode();
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

  const saveAiMode = (updated: Record<string, boolean>) => {
    localStorage.setItem(AI_MODE_KEY, JSON.stringify(updated));
    setAiMode(updated);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="h-3.5 w-3.5 text-green-500" />;
      case "instagram":
        return <Instagram className="h-3.5 w-3.5 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-3.5 w-3.5 text-blue-500" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5" />;
    }
  };

  const toggleAiMode = (convId: string) => {
    const updated = { ...aiMode, [convId]: !aiMode[convId] };
    saveAiMode(updated);
    toast.success(updated[convId] ? "IA ativada" : "IA desativada");
  };

  const handleSendMessage = (content?: string, type: Message["type"] = "text") => {
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
    toast.success("Mensagem enviada!");

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
    // Simulate file upload
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

  const filteredConversations = conversations
    .filter((conv) => filter === "all" || conv.status === filter)
    .filter((conv) => conv.contactName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="h-screen bg-[#1e1e1e] flex overflow-hidden">
      {/* Sidebar esquerda */}
      <div className="w-[380px] bg-[#2b2b2b] border-r border-[#3a3a3a] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#2b2b2b] border-b border-[#3a3a3a]">
          <h1 className="text-xl font-semibold text-white mb-4">Continuum Conversas</h1>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="🔍 Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#3a3a3a] border-[#5f5f5f] text-white placeholder:text-gray-400"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
              className={filter === "all" ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white" : "text-gray-300 hover:bg-[#3a3a3a]"}
            >
              Todos
            </Button>
            <Button
              variant={filter === "waiting" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("waiting")}
              className={filter === "waiting" ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white" : "text-gray-300 hover:bg-[#3a3a3a]"}
            >
              Aguardando
            </Button>
            <Button
              variant={filter === "answered" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("answered")}
              className={filter === "answered" ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white" : "text-gray-300 hover:bg-[#3a3a3a]"}
            >
              Respondidos
            </Button>
            <Button
              variant={filter === "resolved" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("resolved")}
              className={filter === "resolved" ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white" : "text-gray-300 hover:bg-[#3a3a3a]"}
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
              className={`p-4 border-b border-[#3a3a3a] cursor-pointer transition-colors hover:bg-[#3a3a3a] ${
                selectedConv?.id === conv.id ? "bg-[#3a3a3a]" : ""
              }`}
              onClick={() => setSelectedConv(conv)}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  {getChannelIcon(conv.channel)}
                  <span className="font-medium text-sm text-white">{conv.contactName}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-gray-400">
                    {new Date(conv.messages[conv.messages.length - 1]?.timestamp).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {conv.unread > 0 && (
                    <Badge className="bg-[#00a884] hover:bg-[#00a884] text-white text-xs h-5 min-w-5 rounded-full flex items-center justify-center">
                      {conv.unread}
                    </Badge>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-400 truncate">{conv.lastMessage}</p>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Chat Header */}
            <div className="h-[70px] bg-[#2b2b2b] border-b border-[#3a3a3a] flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#5f5f5f] flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-medium">{selectedConv.contactName}</h2>
                  <div className="flex items-center gap-2">
                    {getChannelIcon(selectedConv.channel)}
                    <span className="text-xs text-gray-400 capitalize">{selectedConv.channel}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#3a3a3a]">
                  <Phone className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#3a3a3a]">
                  <Video className="h-5 w-5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-gray-400 hover:text-white hover:bg-[#3a3a3a]"
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                >
                  <Info className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-6 bg-[#1e1e1e]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
                  <div className="space-y-3">
                    {selectedConv.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} animate-fade-in`}
                      >
                        <div
                          className={`max-w-[65%] rounded-lg px-4 py-2 shadow-md ${
                            msg.sender === "user"
                              ? "bg-[#005c4b] text-white"
                              : "bg-[#2b2b2b] text-white"
                          }`}
                        >
                          {msg.type === "text" && <p className="text-sm">{msg.content}</p>}
                          {msg.type === "image" && (
                            <div className="space-y-2">
                              <ImageIcon className="h-8 w-8" />
                              <p className="text-xs">Imagem anexada</p>
                            </div>
                          )}
                          {msg.type === "audio" && (
                            <div className="flex items-center gap-2">
                              <Mic className="h-4 w-4" />
                              <p className="text-xs">Áudio anexado</p>
                            </div>
                          )}
                          {msg.type === "pdf" && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <p className="text-xs">Documento PDF</p>
                            </div>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className="text-[10px] opacity-70">
                              {msg.timestamp.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {msg.sender === "user" && (
                              msg.delivered ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="bg-[#2b2b2b] border-t border-[#3a3a3a] p-4">
                  <div className="flex items-center gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-[#3a3a3a]">
                          <Paperclip className="h-5 w-5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white">
                        <DialogHeader>
                          <DialogTitle>Anexar arquivo</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2">
                          <Button 
                            onClick={() => handleFileAttach("image")} 
                            className="w-full justify-start bg-[#3a3a3a] hover:bg-[#5f5f5f] text-white"
                          >
                            <ImageIcon className="h-4 w-4 mr-2" /> Enviar imagem
                          </Button>
                          <Button 
                            onClick={() => handleFileAttach("audio")} 
                            className="w-full justify-start bg-[#3a3a3a] hover:bg-[#5f5f5f] text-white"
                          >
                            <Mic className="h-4 w-4 mr-2" /> Enviar áudio
                          </Button>
                          <Button 
                            onClick={() => handleFileAttach("pdf")} 
                            className="w-full justify-start bg-[#3a3a3a] hover:bg-[#5f5f5f] text-white"
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
                      className="flex-1 bg-[#3a3a3a] border-[#5f5f5f] text-white placeholder:text-gray-400"
                    />
                    <Button 
                      onClick={() => handleSendMessage()} 
                      size="icon"
                      className="bg-[#00a884] hover:bg-[#00a884]/90 text-white"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Info Panel */}
              {showInfoPanel && (
                <div className="w-[340px] bg-[#2b2b2b] border-l border-[#3a3a3a] overflow-y-auto">
                  <div className="p-6 space-y-6">
                    {/* Contact Info */}
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-[#5f5f5f] flex items-center justify-center mx-auto mb-3">
                        <User className="h-10 w-10 text-white" />
                      </div>
                      <h3 className="text-white font-medium text-lg">{selectedConv.contactName}</h3>
                      <p className="text-gray-400 text-sm capitalize">{selectedConv.channel}</p>
                    </div>

                    {/* Tags */}
                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Tags
                      </h4>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {selectedConv.tags?.map((tag, idx) => (
                          <Badge key={idx} className="bg-[#3a3a3a] text-white hover:bg-[#3a3a3a]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                            <Tag className="h-3 w-3 mr-2" /> Adicionar Tag
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white">
                          <DialogHeader>
                            <DialogTitle>Adicionar Tag</DialogTitle>
                          </DialogHeader>
                          <Input
                            placeholder="Nome da tag"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                          />
                          <Button onClick={addTag} className="bg-[#00a884] hover:bg-[#00a884]/90 text-white">
                            Adicionar
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Funnel Stage */}
                    <div>
                      <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Estágio do Funil
                      </h4>
                      <p className="text-sm text-gray-400 mb-2">{selectedConv.funnelStage || "Não definido"}</p>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                            <TrendingUp className="h-3 w-3 mr-2" /> Adicionar ao Funil
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white">
                          <DialogHeader>
                            <DialogTitle>Adicionar ao Funil</DialogTitle>
                          </DialogHeader>
                          <Select value={selectedFunnel} onValueChange={setSelectedFunnel}>
                            <SelectTrigger className="bg-[#3a3a3a] border-[#5f5f5f] text-white">
                              <SelectValue placeholder="Selecione o estágio" />
                            </SelectTrigger>
                            <SelectContent className="bg-[#2b2b2b] border-[#3a3a3a]">
                              {funnelStages.map((stage) => (
                                <SelectItem key={stage} value={stage} className="text-white focus:bg-[#3a3a3a]">
                                  {stage}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={addToFunnel} className="bg-[#00a884] hover:bg-[#00a884]/90 text-white">
                            Adicionar
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <h4 className="text-white font-medium mb-3">Ações Rápidas</h4>
                      <div className="space-y-2">
                        {/* AI Toggle */}
                        <Button
                          onClick={() => toggleAiMode(selectedConv.id)}
                          variant="outline"
                          className={`w-full justify-start ${
                            aiMode[selectedConv.id]
                              ? "bg-[#00a884] border-[#00a884] text-white hover:bg-[#00a884]/90"
                              : "border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]"
                          }`}
                        >
                          <Bot className="h-4 w-4 mr-2" />
                          {aiMode[selectedConv.id] ? "Desativar IA" : "Ativar IA"}
                        </Button>

                        {/* Quick Messages */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                              <Zap className="h-4 w-4 mr-2" /> Mensagens Rápidas
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white max-w-2xl">
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
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Mensagem</Label>
                                <Textarea
                                  value={newQuickContent}
                                  onChange={(e) => setNewQuickContent(e.target.value)}
                                  placeholder="Digite a mensagem..."
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <Button onClick={addQuickMessage} className="w-full bg-[#00a884] hover:bg-[#00a884]/90 text-white">
                                Criar Mensagem Rápida
                              </Button>
                              <div className="border-t border-[#3a3a3a] pt-4">
                                <h4 className="text-sm font-medium mb-2">Mensagens salvas:</h4>
                                <div className="space-y-2">
                                  {quickMessages.map((qm) => (
                                    <div key={qm.id} className="flex items-center justify-between p-2 bg-[#3a3a3a] rounded">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium">{qm.title}</p>
                                        <p className="text-xs text-gray-400 truncate">{qm.content}</p>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          onClick={() => sendQuickMessage(qm.content)}
                                          className="bg-[#00a884] hover:bg-[#00a884]/90 text-white"
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
                            <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                              <Clock className="h-4 w-4 mr-2" /> Agendar Mensagem
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white">
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
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <div>
                                <Label>Data e Hora</Label>
                                <Input
                                  type="datetime-local"
                                  value={scheduledDatetime}
                                  onChange={(e) => setScheduledDatetime(e.target.value)}
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <Button onClick={scheduleMessage} className="w-full bg-[#00a884] hover:bg-[#00a884]/90 text-white">
                                Agendar Envio
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Schedule Reminder */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                              <Calendar className="h-4 w-4 mr-2" /> Agendar Lembrete
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white">
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
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <div>
                                <Label>Data e Hora</Label>
                                <Input
                                  type="datetime-local"
                                  value={reminderDatetime}
                                  onChange={(e) => setReminderDatetime(e.target.value)}
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <div>
                                <Label>Observações</Label>
                                <Textarea
                                  value={reminderNotes}
                                  onChange={(e) => setReminderNotes(e.target.value)}
                                  placeholder="Notas adicionais..."
                                  className="bg-[#3a3a3a] border-[#5f5f5f] text-white"
                                />
                              </div>
                              <Button onClick={addReminder} className="w-full bg-[#00a884] hover:bg-[#00a884]/90 text-white">
                                Criar Lembrete
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Transfer */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Transferir Atendimento
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-[#2b2b2b] border-[#3a3a3a] text-white">
                            <DialogHeader>
                              <DialogTitle>Transferir Atendimento</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-2">
                              <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                                Agente 1
                              </Button>
                              <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                                Agente 2
                              </Button>
                              <Button variant="outline" className="w-full justify-start border-[#5f5f5f] text-gray-300 hover:bg-[#3a3a3a]">
                                Agente 3
                              </Button>
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
          <div className="flex-1 flex items-center justify-center bg-[#1e1e1e]">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
