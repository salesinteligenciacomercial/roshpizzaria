import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Instagram, Facebook, Send, Search, Bot, User, Paperclip } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  sender: "user" | "ai" | "agent";
  timestamp: Date;
  delivered: boolean;
}

interface Conversation {
  id: string;
  leadName: string;
  channel: "whatsapp" | "instagram" | "facebook";
  status: "waiting" | "answered" | "resolved";
  lastMessage: string;
  unread: number;
  messages: Message[];
}

const CONVERSATIONS_KEY = "crm_conversations";

const initialConversations: Conversation[] = [
  {
    id: "1",
    leadName: "João Silva",
    channel: "whatsapp",
    status: "waiting",
    lastMessage: "Gostaria de saber mais sobre o produto",
    unread: 2,
    messages: [
      { id: "1", content: "Olá! Gostaria de saber mais sobre o produto", sender: "user", timestamp: new Date(Date.now() - 300000), delivered: true },
      { id: "2", content: "Vocês têm disponibilidade para esta semana?", sender: "user", timestamp: new Date(Date.now() - 180000), delivered: true },
    ],
  },
  {
    id: "2",
    leadName: "Maria Santos",
    channel: "instagram",
    status: "answered",
    lastMessage: "Obrigada pelas informações!",
    unread: 0,
    messages: [
      { id: "1", content: "Vi o post sobre promoção", sender: "user", timestamp: new Date(Date.now() - 7200000), delivered: true },
      { id: "2", content: "Olá Maria! Temos várias opções em promoção. Qual produto te interessa?", sender: "ai", timestamp: new Date(Date.now() - 7000000), delivered: true },
      { id: "3", content: "Obrigada pelas informações!", sender: "user", timestamp: new Date(Date.now() - 6800000), delivered: true },
    ],
  },
  {
    id: "3",
    leadName: "Carlos Oliveira",
    channel: "facebook",
    status: "resolved",
    lastMessage: "Fechado! Muito obrigado",
    unread: 0,
    messages: [
      { id: "1", content: "Quero fazer uma compra", sender: "user", timestamp: new Date(Date.now() - 86400000), delivered: true },
      { id: "2", content: "Ótimo! Vou te passar os detalhes.", sender: "agent", timestamp: new Date(Date.now() - 86000000), delivered: true },
      { id: "3", content: "Fechado! Muito obrigado", sender: "user", timestamp: new Date(Date.now() - 85000000), delivered: true },
    ],
  },
];

export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "answered" | "resolved">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [aiMode, setAiMode] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

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

  const saveConversations = (updated: Conversation[]) => {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(updated));
    setConversations(updated);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsapp":
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "instagram":
        return <Instagram className="h-4 w-4 text-pink-500" />;
      case "facebook":
        return <Facebook className="h-4 w-4 text-blue-600" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      waiting: "bg-yellow-500",
      answered: "bg-blue-500",
      resolved: "bg-green-500",
    };
    const labels: Record<string, string> = {
      waiting: "Aguardando",
      answered: "Respondido",
      resolved: "Resolvido",
    };
    return <Badge className={`${variants[status]} text-white`}>{labels[status]}</Badge>;
  };

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConv) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageInput,
      sender: aiMode ? "ai" : "agent",
      timestamp: new Date(),
      delivered: true,
    };

    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? {
            ...conv,
            messages: [...conv.messages, newMessage],
            lastMessage: messageInput,
            status: "answered" as const,
          }
        : conv
    );

    saveConversations(updatedConversations);
    setSelectedConv({
      ...selectedConv,
      messages: [...selectedConv.messages, newMessage],
      lastMessage: messageInput,
      status: "answered",
    });
    setMessageInput("");
    toast.success("Mensagem enviada!");

    // Simular resposta automática em modo IA
    if (aiMode) {
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: "Obrigado pela mensagem! Como posso ajudar?",
          sender: "ai",
          timestamp: new Date(),
          delivered: true,
        };
        const withAiResponse = updatedConversations.map((conv) =>
          conv.id === selectedConv.id
            ? { ...conv, messages: [...conv.messages, newMessage, aiResponse] }
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

  const filteredConversations = conversations
    .filter((conv) => filter === "all" || conv.status === filter)
    .filter((conv) => conv.leadName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Central de Conversas</h1>
        <p className="text-muted-foreground">Chat unificado multicanal</p>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Todos
        </Button>
        <Button
          variant={filter === "waiting" ? "default" : "outline"}
          onClick={() => setFilter("waiting")}
        >
          Aguardando
        </Button>
        <Button
          variant={filter === "answered" ? "default" : "outline"}
          onClick={() => setFilter("answered")}
        >
          Respondidos
        </Button>
        <Button
          variant={filter === "resolved" ? "default" : "outline"}
          onClick={() => setFilter("resolved")}
        >
          Resolvidos
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 h-[600px]">
        {/* Lista de conversas */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[480px]">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-4 border-b cursor-pointer hover:bg-accent transition-colors ${
                    selectedConv?.id === conv.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedConv(conv)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getChannelIcon(conv.channel)}
                      <span className="font-semibold text-sm">{conv.leadName}</span>
                    </div>
                    {conv.unread > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {conv.unread}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {conv.lastMessage}
                  </p>
                  {getStatusBadge(conv.status)}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de chat */}
        <Card className="md:col-span-2">
          {selectedConv ? (
            <>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getChannelIcon(selectedConv.channel)}
                    <div>
                      <CardTitle className="text-lg">{selectedConv.leadName}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">
                        {selectedConv.channel}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={aiMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAiMode(!aiMode)}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    IA {aiMode ? "Ativa" : "Inativa"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ScrollArea className="h-[400px] mb-4">
                  <div className="space-y-4">
                    {selectedConv.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender === "user" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg p-3 ${
                            msg.sender === "user"
                              ? "bg-muted"
                              : msg.sender === "ai"
                              ? "bg-blue-600 text-white"
                              : "bg-primary text-primary-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {msg.sender === "user" ? (
                              <User className="h-3 w-3" />
                            ) : (
                              <Bot className="h-3 w-3" />
                            )}
                            <span className="text-xs opacity-70">
                              {msg.timestamp.toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Digite sua mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <Button onClick={handleSendMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                Selecione uma conversa para começar
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
