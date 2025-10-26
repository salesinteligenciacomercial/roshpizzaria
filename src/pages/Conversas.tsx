import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, Instagram, Facebook, Send, Search, Bot, User, Paperclip, 
  Clock, Calendar, Zap, FileText, Tag, TrendingUp, ArrowRightLeft, Image as ImageIcon,
  Mic, FileUp, Check, CheckCheck, Phone, Video, Info, DollarSign, Users, Bell, Download, Volume2,
  RefreshCw, CheckCircle2, AlertCircle, Reply, CheckSquare, X
} from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ConversationHeader } from "@/components/conversas/ConversationHeader";
import { ConversationListItem } from "@/components/conversas/ConversationListItem";
import { MessageItem } from "@/components/conversas/MessageItem";
import { AudioRecorder } from "@/components/conversas/AudioRecorder";
import { MediaUpload } from "@/components/conversas/MediaUpload";
import { NovaConversaDialog } from "@/components/conversas/NovaConversaDialog";
import { EditarInformacoesLeadDialog } from "@/components/conversas/EditarInformacoesLeadDialog";
import { ResponsaveisManager } from "@/components/conversas/ResponsaveisManager";
import { formatPhoneNumber, safeFormatPhoneNumber } from "@/utils/phoneFormatter";
import { useLeadsSync } from "@/hooks/useLeadsSync";

interface Message {
  id: string;
  content: string;
  type: "text" | "image" | "audio" | "pdf" | "video" | "contact";
  sender: "user" | "contact";
  timestamp: Date;
  delivered: boolean;
  read?: boolean;
  mediaUrl?: string;
  fileName?: string;
  transcricao?: string;
  reaction?: string;
  replyTo?: string;
  edited?: boolean;
  sentBy?: string; // Nome do responsável que enviou
  contactData?: {
    name: string;
    phone: string;
  };
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
  avatarUrl?: string;
  phoneNumber?: string;
}

interface QuickMessage {
  id: string;
  title: string;
  content: string;
  category: string;
}

interface QuickMessageCategory {
  id: string;
  name: string;
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
const QUICK_CATEGORIES_KEY = "continuum_quick_categories";
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

function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting" | "answered" | "resolved">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [aiMode, setAiMode] = useState<Record<string, boolean>>({});
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [quickCategories, setQuickCategories] = useState<QuickMessageCategory[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [leadVinculado, setLeadVinculado] = useState<any>(null);
  const [verificandoLead, setVerificandoLead] = useState(false);
  const [mostrarBotaoCriarLead, setMostrarBotaoCriarLead] = useState(false);
  const [leadsVinculados, setLeadsVinculados] = useState<Record<string, string>>({}); // conversationId -> leadId
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null); // Company ID do usuário
  const [userName, setUserName] = useState<string>(""); // Nome do usuário logado
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Estados para modais de visualização
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; name?: string } | null>(null);
  const [transcrevendo, setTranscrevendo] = useState<string | null>(null);

  // Form states
  const [newQuickTitle, setNewQuickTitle] = useState("");
  const [newQuickContent, setNewQuickContent] = useState("");
  const [newQuickCategory, setNewQuickCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
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
  
  // Estados para tarefas do lead
  const [leadTasks, setLeadTasks] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("media");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");

  // Estados para funis e etapas do banco
  const [funis, setFunis] = useState<any[]>([]);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [selectedFunilId, setSelectedFunilId] = useState("");
  const [etapasFiltradas, setEtapasFiltradas] = useState<any[]>([]);

  const funnelStages = ["Novo", "Qualificado", "Em Negociação", "Fechado", "Perdido"];
  const usuarios = ["Você", "Ana Costa", "Pedro Lima", "Julia Santos", "Carlos Mendes"];

  // Carregar funis e etapas ao montar o componente
  useEffect(() => {
    carregarFunisEEtapas();
  }, []);

  // Filtrar etapas quando funil é selecionado
  useEffect(() => {
    if (selectedFunilId) {
      const filtered = etapas.filter(e => e.funil_id === selectedFunilId);
      setEtapasFiltradas(filtered);
    } else {
      setEtapasFiltradas([]);
    }
  }, [selectedFunilId, etapas]);

  const carregarFunisEEtapas = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      // Carregar funis
      const { data: funisData, error: funisError } = await supabase
        .from("funis")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("criado_em");

      if (!funisError && funisData) {
        console.log('📊 Funis carregados:', funisData.length);
        setFunis(funisData);
      }

      // Carregar etapas
      const { data: etapasData, error: etapasError } = await supabase
        .from("etapas")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("posicao");

      if (!etapasError && etapasData) {
        console.log('📍 Etapas carregadas:', etapasData.length);
        setEtapas(etapasData);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar funis e etapas:', error);
    }
  };

  const carregarTarefasDoLead = async (leadId: string) => {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar tarefas:', error);
        return;
      }

      console.log('📋 Tarefas carregadas:', tasks?.length || 0);
      setLeadTasks(tasks || []);
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
    }
  };

  // Sincronizar tarefas em tempo real quando o lead muda
  useEffect(() => {
    if (!leadVinculado?.id) {
      setLeadTasks([]);
      return;
    }

    // Carregar tarefas do lead
    carregarTarefasDoLead(leadVinculado.id);

    // Configurar subscrição em tempo real
    const channel = supabase
      .channel(`tasks-${leadVinculado.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `lead_id=eq.${leadVinculado.id}`,
        },
        (payload) => {
          console.log('📡 Atualização de tarefa em tempo real:', payload);
          
          if (payload.eventType === 'INSERT') {
            setLeadTasks(prev => [payload.new as any, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setLeadTasks(prev => prev.map(task => 
              task.id === payload.new.id ? payload.new as any : task
            ));
          } else if (payload.eventType === 'DELETE') {
            setLeadTasks(prev => prev.filter(task => task.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadVinculado?.id]);

  // Função para recarregar dados do lead vinculado
  const recarregarLeadVinculado = async (conversaId: string) => {
    try {
      const conversa = conversations.find(c => c.id === conversaId);
      if (!conversa) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const phoneToSearch = conversa.phoneNumber || conversa.id;
      
      const { data: leadData } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', userRole.company_id)
        .or(`phone.eq.${phoneToSearch},telefone.eq.${phoneToSearch}`)
        .maybeSingle();

      if (leadData) {
        console.log('🔄 Lead vinculado atualizado:', leadData);
        setLeadVinculado(leadData);
      }
    } catch (error) {
      console.error('❌ Erro ao recarregar lead:', error);
    }
  };

  // Integrar sincronização de leads em tempo real
  useLeadsSync({
    onUpdate: (updatedLead) => {
      console.log('📡 [Conversas] Lead atualizado via sync:', updatedLead);
      
      // Atualizar leadVinculado se for o mesmo lead
      if (leadVinculado && leadVinculado.id === updatedLead.id) {
        console.log('✅ Atualizando lead vinculado com novos dados');
        setLeadVinculado(updatedLead);
      }
      
      // Atualizar conversa correspondente se existir
      setConversations(prev => prev.map(conv => {
        // Buscar por telefone formatado
        const phoneMatch = conv.phoneNumber === updatedLead.phone || 
                          conv.phoneNumber === updatedLead.telefone ||
                          conv.id === updatedLead.phone ||
                          conv.id === updatedLead.telefone;
        
        if (phoneMatch) {
          // Mesclar dados preservando alterações locais
          return {
            ...conv,
            // Apenas atualizar campos que não estão sendo editados localmente
            contactName: updatedLead.name || conv.contactName,
            tags: updatedLead.tags?.length ? updatedLead.tags : conv.tags,
            funnelStage: updatedLead.stage || conv.funnelStage,
            produto: updatedLead.servico || conv.produto,
            valor: updatedLead.value ? `R$ ${Number(updatedLead.value).toLocaleString('pt-BR')}` : conv.valor,
            // Para anotações, preservar se o campo local foi modificado
            anotacoes: updatedLead.notes || conv.anotacoes,
          };
        }
        return conv;
      }));
      
      // Atualizar conversa selecionada apenas se não houver edições pendentes
      if (selectedConv) {
        const phoneMatch = selectedConv.phoneNumber === updatedLead.phone || 
                          selectedConv.phoneNumber === updatedLead.telefone ||
                          selectedConv.id === updatedLead.phone ||
                          selectedConv.id === updatedLead.telefone;
        
        if (phoneMatch) {
          // Verificar se há mudanças de outros usuários
          const hasExternalChanges = 
            (updatedLead.name && updatedLead.name !== selectedConv.contactName) ||
            (updatedLead.stage && updatedLead.stage !== selectedConv.funnelStage) ||
            (updatedLead.tags && JSON.stringify(updatedLead.tags) !== JSON.stringify(selectedConv.tags));
          
          if (hasExternalChanges) {
            setSyncStatus('syncing');
            setTimeout(() => setSyncStatus('synced'), 2000);
          }
          
          setSelectedConv(prev => prev ? {
            ...prev,
            contactName: updatedLead.name || prev.contactName,
            tags: updatedLead.tags?.length ? updatedLead.tags : prev.tags,
            funnelStage: updatedLead.stage || prev.funnelStage,
            produto: updatedLead.servico || prev.produto,
            valor: updatedLead.value ? `R$ ${Number(updatedLead.value).toLocaleString('pt-BR')}` : prev.valor,
            anotacoes: updatedLead.notes || prev.anotacoes,
          } : null);
        }
      }
    },
    showNotifications: false // Não mostrar notificações automáticas
  });

  useEffect(() => {
    console.log('🚀 Componente Conversas montado');
    // Carregar nome do usuário
    const carregarPerfilUsuario = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", session.user.id)
            .maybeSingle();
          
          if (profile) {
            setUserName(profile.full_name || profile.email);
            console.log('👤 Usuário logado:', profile.full_name || profile.email);
          }
        }
      } catch (error) {
        console.error('❌ Erro ao carregar perfil:', error);
      }
    };
    
    carregarPerfilUsuario();
    
    // Não carregar do localStorage - apenas Supabase
    loadQuickMessages();
    loadQuickCategories();
    loadReminders();
    loadScheduledMessages();
    loadMeetings();
    loadAiMode();
    
    // Carregar conversas do Supabase imediatamente
    console.log('🔄 Carregando conversas iniciais do Supabase...');
    loadSupabaseConversations();

    // Verificar se veio de um lead (query param)
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get('phone');
    const nameParam = urlParams.get('name');
    
    if (phoneParam) {
      // Formatar número com +55
      const formattedPhone = phoneParam.startsWith('55') ? phoneParam : '55' + phoneParam;
      
      // Buscar ou criar conversa com este número
      setTimeout(() => {
        const existingConv = conversations.find(c => c.id === formattedPhone || c.phoneNumber === formattedPhone);
        
        if (existingConv) {
          setSelectedConv(existingConv);
        } else {
          // Criar nova conversa
          const newConv: Conversation = {
            id: formattedPhone,
            contactName: nameParam || formattedPhone,
            channel: "whatsapp",
            status: "waiting",
            lastMessage: "Nova conversa",
            unread: 0,
            messages: [],
            tags: [],
            phoneNumber: formattedPhone,
          };
          setConversations(prev => [newConv, ...prev]);
          setSelectedConv(newConv);
        }
        
        // Limpar query params
        window.history.replaceState({}, '', '/conversas');
      }, 500);
    }

    // Subscrever para atualizações em tempo real
    const channel = supabase
      .channel('conversas_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversas'
        },
        async (payload) => {
          console.log('📩 Nova mensagem recebida via realtime:', payload);
          
          // Processar apenas a nova mensagem, sem recarregar tudo
          if (payload.eventType === 'INSERT' && payload.new) {
            const novaConversa = payload.new;
            
            // Buscar foto de perfil da nova mensagem
            let profilePic: string | undefined;
            try {
              const { data: picData } = await supabase.functions.invoke('get-profile-picture', {
                body: { numero: novaConversa.numero }
              });
              profilePic = picData?.profilePicUrl;
            } catch (error) {
              console.error('❌ Erro ao buscar foto:', error);
            }
            
            // Converter para formato do componente
            const novaConvFormatted: Conversation = {
              id: novaConversa.numero,
              contactName: novaConversa.nome_contato || novaConversa.numero,
              avatarUrl: profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(novaConversa.nome_contato || novaConversa.numero)}&background=10b981&color=fff`,
              channel: 'whatsapp' as const,
              status: 'waiting' as const,
              messages: [{
                id: novaConversa.id,
                content: novaConversa.mensagem,
                sender: 'contact',
                timestamp: new Date(novaConversa.created_at),
                delivered: true,
                type: novaConversa.tipo_mensagem === 'audio' ? 'audio' : novaConversa.tipo_mensagem === 'image' ? 'image' : 'text',
                mediaUrl: novaConversa.midia_url,
              }],
              lastMessage: novaConversa.mensagem,
              unread: 1,
              tags: [],
              valor: null,
              anotacoes: null,
            };
            
            // Atualizar ou adicionar conversa na lista
            setConversations(prev => {
              const existingIndex = prev.findIndex(c => c.id === novaConvFormatted.id);
              
              if (existingIndex >= 0) {
                // Conversa já existe - adicionar mensagem
                const updated = [...prev];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  messages: [...updated[existingIndex].messages, ...novaConvFormatted.messages],
                  lastMessage: novaConvFormatted.lastMessage,
                  unread: updated[existingIndex].unread + 1,
                };
                
                // Mover para o topo
                const [item] = updated.splice(existingIndex, 1);
                updated.unshift(item);
                
                console.log('🔄 Mensagem adicionada à conversa existente:', novaConvFormatted.contactName);
                return updated;
              } else {
                // Nova conversa - adicionar no topo
                console.log('➕ Nova conversa criada:', novaConvFormatted.contactName);
                return [novaConvFormatted, ...prev];
              }
            });
            
            // Se a conversa está selecionada, atualizar também
            if (selectedConv && selectedConv.id === novaConvFormatted.id) {
              setSelectedConv(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  messages: [...prev.messages, ...novaConvFormatted.messages],
                  lastMessage: novaConvFormatted.lastMessage,
                };
              });
            }
            
            // Notificar APENAS se for mensagem RECEBIDA do cliente (não quando o CRM envia)
            if (novaConversa.status === 'Recebida' && novaConversa.origem === 'WhatsApp') {
              toast.custom((t) => (
                <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-md animate-slide-in-right">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                      {novaConvFormatted.contactName.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">
                          Nova mensagem de {novaConvFormatted.contactName}
                        </p>
                        <button
                          onClick={() => toast.dismiss(t)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <p className="text-sm text-muted-foreground truncate mb-3">
                        {novaConversa.mensagem}
                      </p>
                      
                      <button
                        onClick={() => {
                          // Buscar a conversa completa com todo o histórico
                          setConversations(prev => {
                            const conversaCompleta = prev.find(c => c.id === novaConvFormatted.id);
                            if (conversaCompleta) {
                              setSelectedConv(conversaCompleta);
                            }
                            return prev;
                          });
                          toast.dismiss(t);
                        }}
                        className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        💬 Visualizar e Responder
                      </button>
                    </div>
                  </div>
                </div>
              ), {
                duration: 8000,
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Status do canal realtime:', status);
      });

    return () => {
      console.log('🔌 Desconectando canal realtime');
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
    // Não carregar do localStorage - dados vêm apenas do Supabase
    // Manter conversas iniciais apenas como fallback temporário
    setConversations(initialConversations);
  };

  const loadSupabaseConversations = async () => {
    try {
      console.log('🔄 [SUPABASE] Iniciando carregamento de conversas...');
      
      // Função para buscar foto do perfil via Edge Function (mais seguro)
      const getProfilePicture = async (numero: string): Promise<string | undefined> => {
        try {
          console.log('🔍 Buscando foto de perfil para:', numero);
          
          const { data, error } = await supabase.functions.invoke('get-profile-picture', {
            body: { number: numero }
          });

          if (error) {
            console.error('❌ Erro ao buscar foto:', error);
            return undefined;
          }

          if (data?.profilePictureUrl) {
            console.log('✅ Foto de perfil encontrada');
            return data.profilePictureUrl;
          }
          
          console.log('ℹ️ Nenhuma foto de perfil disponível');
          return undefined;
        } catch (error) {
          console.error('❌ Exceção ao buscar foto do perfil:', error);
          return undefined;
        }
      };
      
      // Buscar company_id do usuário autenticado
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!userRole?.company_id) {
        console.warn('⚠️ Usuário sem company_id');
        return;
      }

      // Salvar company_id no estado
      setUserCompanyId(userRole.company_id);
      console.log('🏢 Company ID do usuário:', userRole.company_id);
      
      // Buscar APENAS as 100 conversas mais recentes da company do usuário
      // Limitando para evitar timeout com muitas conversas
      const { data, error } = await supabase
        .from('conversas')
        .select('*')
        .eq('company_id', userRole.company_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ [SUPABASE] Erro ao carregar conversas:', error);
        toast.error(`Erro ao carregar conversas: ${error.message}`);
        return;
      }
      
      console.log('✅ [SUPABASE] Conversas carregadas:', {
        total: data?.length || 0,
        companyId: userRole.company_id,
        primeiraConversa: data?.[0],
        ultimasCinco: data?.slice(0, 5).map(d => ({ 
          numero: d.numero, 
          mensagem: d.mensagem, 
          status: d.status,
          created_at: d.created_at 
        }))
      });

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
        // Buscar todos os leads vinculados às conversas
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        const numeros = [...new Set(validData.map(conv => conv.numero))];
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, phone, telefone')
          .eq('company_id', userRole?.company_id)
          .in('phone', numeros.concat(numeros.map(n => safeFormatPhoneNumber(n))));

        // Criar mapeamento de número -> leadId
        const leadsMap: Record<string, string> = {};
        if (leadsData) {
          leadsData.forEach(lead => {
            const phone = lead.phone || lead.telefone;
            if (phone) {
              leadsMap[phone] = lead.id;
              // Também mapear versões formatadas
              const formatted = safeFormatPhoneNumber(phone);
              if (formatted) {
                leadsMap[formatted] = lead.id;
              }
            }
          });
        }
        setLeadsVinculados(leadsMap);

        // Agrupar mensagens por número
        const conversasAgrupadas = validData.reduce((acc: Record<string, any[]>, conv: any) => {
          if (!acc[conv.numero]) {
            acc[conv.numero] = [];
          }
          acc[conv.numero].push(conv);
          return acc;
        }, {});

        // Converter para formato local
        const novasConversas: Conversation[] = await Promise.all(
          Object.entries(conversasAgrupadas).map(async ([numero, mensagens]) => {
            const ultima = mensagens[0];
            
            // Buscar foto do perfil
            const avatarUrl = await getProfilePicture(numero);
            
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
                type: msgType as "text" | "image" | "audio" | "pdf" | "video",
                sender: m.status === 'Enviada' ? 'user' : 'contact' as "user" | "contact",
                timestamp: new Date(m.created_at),
                delivered: true,
                read: m.status === 'Lida',
                mediaUrl: m.midia_url || undefined,
                fileName: fileName,
                replyTo: m.replied_to_message || undefined,
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
              avatarUrl: avatarUrl,
            };
          })
        );

        console.log('📱 Novas conversas do Supabase:', novasConversas.length);
        novasConversas.forEach(conv => {
          console.log(`  - ${conv.contactName}: ${conv.messages.length} mensagens`);
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
              console.log(`🔄 Conversa atualizada: ${nova.contactName}`);
            } else {
              merged.push(nova);
              console.log(`➕ Nova conversa adicionada: ${nova.contactName}`);
            }
          });
          
          console.log(`📊 Total de conversas após merge: ${merged.length}`);
          
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
      setQuickMessages([]);
    }
  };

  const loadQuickCategories = () => {
    const saved = localStorage.getItem(QUICK_CATEGORIES_KEY);
    if (saved) {
      setQuickCategories(JSON.parse(saved));
    } else {
      const initialCategories = [
        { id: "1", name: "Atendimento" },
        { id: "2", name: "Suporte" },
        { id: "3", name: "Dúvidas" },
        { id: "4", name: "Objeções" },
        { id: "5", name: "Preços" },
        { id: "6", name: "PIX" },
      ];
      setQuickCategories(initialCategories);
      localStorage.setItem(QUICK_CATEGORIES_KEY, JSON.stringify(initialCategories));
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
    // Não salvar no localStorage para evitar QuotaExceededError
    // Os dados são persistidos no Supabase
    setConversations(updated);
  };

  const saveQuickMessages = (updated: QuickMessage[]) => {
    localStorage.setItem(QUICK_MESSAGES_KEY, JSON.stringify(updated));
    setQuickMessages(updated);
  };

  const saveQuickCategories = (updated: QuickMessageCategory[]) => {
    localStorage.setItem(QUICK_CATEGORIES_KEY, JSON.stringify(updated));
    setQuickCategories(updated);
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

  // Função auxiliar para download de mídias (data: URIs e URLs normais)
  const downloadMedia = (url: string, fileName: string) => {
    try {
      if (url.startsWith('data:')) {
        // Converter data: URI para blob e baixar
        const arr = url.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } else {
        // URL normal - abrir em nova aba
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Erro ao baixar mídia:', error);
      toast.error("Não foi possível baixar o arquivo");
    }
  };

  const transcreverAudio = async (messageId: string, audioUrl: string) => {
    try {
      setTranscrevendo(messageId);
      
      // Baixar o áudio
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();
      
      // Converter para base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result?.toString().split(',')[1];
        
        if (!base64Audio) {
          toast.error("Não foi possível processar o áudio");
          setTranscrevendo(null);
          return;
        }
        
        // Chamar a edge function
        const { data, error } = await supabase.functions.invoke('transcrever-audio', {
          body: { audio: base64Audio }
        });
        
        if (error) {
          console.error('Erro ao transcrever:', error);
          toast.error("Erro ao transcrever: " + (error.message || "Não foi possível transcrever o áudio"));
        } else {
          // Atualizar a mensagem com a transcrição
          setSelectedConv(prev => {
            if (!prev) return prev;
            
            const updatedMessages = prev.messages.map(msg => 
              msg.id === messageId 
                ? { ...msg, transcricao: data.text }
                : msg
            );
            
            return { ...prev, messages: updatedMessages };
          });
          
          // Atualizar também na lista de conversas
          setConversations(prevConvs => prevConvs.map(conv => {
            if (conv.id === selectedConv?.id) {
              return {
                ...conv,
                messages: conv.messages.map(msg => 
                  msg.id === messageId 
                    ? { ...msg, transcricao: data.text }
                    : msg
                )
              };
            }
            return conv;
          }));
          
          toast.success("Áudio transcrito com sucesso!");
        }
        
        setTranscrevendo(null);
      };
      
    } catch (error) {
      console.error('Erro ao transcrever áudio:', error);
      toast.error("Não foi possível transcrever o áudio");
      setTranscrevendo(null);
    }
  };

  // Funções de mensagem
  const handleReply = (messageId: string) => {
    const message = selectedConv?.messages.find(m => m.id === messageId);
    if (message) {
      setReplyingTo(messageId);
      toast.success("Digite sua resposta abaixo");
    }
  };

  const handleEdit = async (messageId: string, newContent: string) => {
    if (!selectedConv) return;
    
    const updated = conversations.map(conv => 
      conv.id === selectedConv.id ? {
        ...conv,
        messages: conv.messages.map(msg => 
          msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
        )
      } : conv
    );
    saveConversations(updated);
    setSelectedConv({
      ...selectedConv,
      messages: selectedConv.messages.map(msg => 
        msg.id === messageId ? { ...msg, content: newContent, edited: true } : msg
      )
    });
    
    // Enviar mensagem editada via WhatsApp
    try {
      const { error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          numero: selectedConv.id,
          mensagem: `✏️ *[Mensagem editada]*\n\n${newContent}`,
          tipo_mensagem: 'text',
          company_id: userCompanyId
        }
      });

      if (error) {
        console.error('Erro ao enviar edição para WhatsApp:', error);
        toast.error('Mensagem editada localmente, mas não enviada ao WhatsApp');
      } else {
        toast.success("Mensagem editada e enviada ao cliente!");
      }
    } catch (error) {
      console.error('Erro ao processar edição:', error);
      toast.error('Mensagem editada localmente');
    }
  };

  const handleDelete = (messageId: string, forEveryone: boolean) => {
    if (!selectedConv) return;
    const updated = conversations.map(conv => 
      conv.id === selectedConv.id ? {
        ...conv,
        messages: conv.messages.filter(msg => msg.id !== messageId)
      } : conv
    );
    saveConversations(updated);
    setSelectedConv({
      ...selectedConv,
      messages: selectedConv.messages.filter(msg => msg.id !== messageId)
    });
    toast.success(forEveryone ? "Mensagem excluída para todos" : "Mensagem excluída para você");
  };

  const handleReact = (messageId: string, emoji: string) => {
    if (!selectedConv) return;
    
    console.log('🎭 Reação adicionada:', emoji, 'Mensagem:', messageId);
    
    const updated = conversations.map(conv => 
      conv.id === selectedConv.id ? {
        ...conv,
        messages: conv.messages.map(msg => 
          msg.id === messageId ? { ...msg, reaction: emoji } : msg
        )
      } : conv
    );
    
    setConversations(updated);
    setSelectedConv({
      ...selectedConv,
      messages: selectedConv.messages.map(msg => 
        msg.id === messageId ? { ...msg, reaction: emoji } : msg
      )
    });
    
    toast.success(`Reação ${emoji} adicionada com sucesso!`);
  };

  const handleSendMedia = async (file: File, caption: string, type: string) => {
    if (!selectedConv) return;

    setSyncStatus('syncing');

    // Definir texto correto por tipo
    const tipoMensagem: { [key: string]: string } = {
      'image': 'Imagem enviada',
      'audio': 'Áudio enviado',
      'pdf': 'Documento enviado',
      'video': 'Vídeo enviado',
      'document': 'Documento enviado'
    };

    try {
      console.log('📤 Enviando mídia via edge function...');

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

      // Enviar via edge function (mais seguro)
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          numero: selectedConv.id,
          mensagem: caption || tipoMensagem[type],
          tipo_mensagem: type,
          mediaBase64: base64,
          fileName: file.name,
          mimeType: file.type,
          caption: caption || '',
          company_id: userCompanyId // IMPORTANTE: Adicionar company_id
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Mídia enviada com sucesso');

      const newMessage: Message = {
        id: Date.now().toString(),
        content: caption || tipoMensagem[type] || 'Arquivo enviado',
        type: type as "image" | "audio" | "pdf" | "video",
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        mediaUrl: URL.createObjectURL(file),
        fileName: file.name,
        sentBy: userName || "Você", // Adicionar quem enviou
      };

      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessage: tipoMensagem[type] || newMessage.content,
              status: "answered" as const,
              unread: 0,
            }
          : conv
      );

      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        messages: [...selectedConv.messages, newMessage],
      });

      // Salvar no Supabase
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      await supabase.from('conversas').insert([{
        numero: selectedConv.id,
        mensagem: caption || tipoMensagem[type],
        origem: 'WhatsApp',
        status: 'Enviada',
        tipo_mensagem: type,
        nome_contato: selectedConv.contactName,
        arquivo_nome: file.name,
        company_id: userRole?.company_id,
      }]);

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 4000);
      
      // Não mostrar notificação ao enviar mídia - apenas logs
      console.log('✅ Mídia enviada com sucesso');
    } catch (error) {
      console.error("❌ Erro ao enviar mídia:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
      toast.error("Erro ao enviar mídia");
    }
  };

  const handleSendAudio = async (audioBlob: Blob) => {
    if (!selectedConv) return;

    setSyncStatus('syncing');

    try {
      console.log('🎤 Enviando áudio via edge function...');

      // Converter áudio para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          resolve(base64String.split(',')[1]);
        };
        reader.onerror = () => reject(new Error('Erro ao ler áudio'));
        reader.readAsDataURL(audioBlob);
      });

      // Enviar via edge function (mais seguro)
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          numero: selectedConv.id,
          mensagem: 'Áudio enviado',
          tipo_mensagem: 'audio',
          mediaBase64: base64,
          fileName: 'audio.ogg',
          mimeType: 'audio/ogg; codecs=opus',
          caption: '',
          company_id: userCompanyId // IMPORTANTE: Adicionar company_id
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Áudio enviado com sucesso');

      const newMessage: Message = {
        id: Date.now().toString(),
        content: "Áudio enviado",
        type: "audio",
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        mediaUrl: URL.createObjectURL(audioBlob),
        sentBy: userName || "Você", // Adicionar quem enviou
      };

      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? {
              ...conv,
              messages: [...conv.messages, newMessage],
              lastMessage: "Áudio enviado",
              status: "answered" as const,
              unread: 0,
            }
          : conv
      );

      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        messages: [...selectedConv.messages, newMessage],
      });

      // Salvar no Supabase
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      await supabase.from('conversas').insert([{
        numero: selectedConv.id,
        mensagem: 'Áudio enviado',
        origem: 'WhatsApp',
        status: 'Enviada',
        tipo_mensagem: 'audio',
        nome_contato: selectedConv.contactName,
        arquivo_nome: 'audio.ogg',
        company_id: userRole?.company_id,
      }]);

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 4000);
      
      // Não mostrar notificação ao enviar áudio - apenas logs
      console.log('✅ Áudio enviado com sucesso');
    } catch (error) {
      console.error("❌ Erro ao enviar áudio:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
      toast.error("Erro ao enviar áudio");
    }
  };

  const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
    const messageContent = content || messageInput.trim();
    if (!messageContent || !selectedConv) return;

    // Validar e formatar número
    try {
      const formattedPhone = formatPhoneNumber(selectedConv.id);
    } catch (error: any) {
      toast.error(error.message);
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      type,
      sender: "user",
      timestamp: new Date(),
      delivered: true,
      replyTo: replyingTo || undefined,
      sentBy: userName || "Você", // Adicionar quem enviou a mensagem
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
    
    // Preparar dados para envio via WhatsApp
    const mensagemParaEnviar = replyingTo && selectedConv.messages.find(m => m.id === replyingTo)
      ? {
          mensagem: messageContent,
          quoted: {
            key: {
              id: replyingTo
            },
            message: {
              conversation: selectedConv.messages.find(m => m.id === replyingTo)?.content || ''
            }
          }
        }
      : { mensagem: messageContent };
    
    // Enviar mensagem via Evolution API
    try {
      const { data, error } = await supabase.functions.invoke('enviar-whatsapp', {
        body: {
          numero: selectedConv.id,
          ...mensagemParaEnviar,
          tipo_mensagem: type,
          company_id: userCompanyId
        }
      });

      if (error) {
        console.error('Erro ao enviar para WhatsApp:', error);
        toast.error('Erro ao enviar mensagem para WhatsApp');
        return;
      }

      console.log('✅ Resposta Evolution API:', data);
      
      // Não mostrar notificação ao enviar - apenas logs
      console.log('✅ Mensagem enviada para WhatsApp com sucesso');

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      // Salvar no Supabase após sucesso
      const repliedMessage = replyingTo ? selectedConv.messages.find(m => m.id === replyingTo)?.content : null;
      const { error: dbError } = await supabase.from('conversas').insert([{
        numero: selectedConv.id,
        mensagem: messageContent,
        origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : 
                selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
        status: 'Enviada',
        tipo_mensagem: type,
        nome_contato: selectedConv.contactName,
        company_id: userRole?.company_id, // IMPORTANTE: Adicionar company_id
        replied_to_message: repliedMessage || null,
      }]);

      if (dbError) {
        console.error('❌ Erro ao salvar mensagem no banco:', dbError);
        toast.error('Erro ao salvar mensagem no histórico');
      } else {
        console.log('✅ Mensagem salva no Supabase com company_id:', userRole?.company_id);
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
    if (!newQuickTitle || !newQuickContent || !newQuickCategory) {
      toast.error("Preencha todos os campos e selecione uma categoria");
      return;
    }
    const newMsg: QuickMessage = {
      id: Date.now().toString(),
      title: newQuickTitle,
      content: newQuickContent,
      category: newQuickCategory,
    };
    saveQuickMessages([...quickMessages, newMsg]);
    setNewQuickTitle("");
    setNewQuickContent("");
    setNewQuickCategory("");
    toast.success("Mensagem rápida criada!");
  };

  const addQuickCategory = () => {
    if (!newCategoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }
    const newCat: QuickMessageCategory = {
      id: Date.now().toString(),
      name: newCategoryName,
    };
    saveQuickCategories([...quickCategories, newCat]);
    setNewCategoryName("");
    toast.success("Categoria criada!");
  };

  const deleteQuickMessage = (id: string) => {
    saveQuickMessages(quickMessages.filter(m => m.id !== id));
    toast.success("Mensagem rápida removida!");
  };

  const deleteQuickCategory = (id: string) => {
    // Verificar se há mensagens usando esta categoria
    const messagesInCategory = quickMessages.filter(m => m.category === id);
    if (messagesInCategory.length > 0) {
      toast.error("Não é possível excluir categoria com mensagens vinculadas");
      return;
    }
    saveQuickCategories(quickCategories.filter(c => c.id !== id));
    toast.success("Categoria removida!");
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

  const addTag = async () => {
    if (!selectedConv || !newTag.trim()) {
      toast.error("Digite uma tag");
      return;
    }
    
    try {
      setSyncStatus('syncing');
      
      // Buscar ou criar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Atualizar tags no Supabase
        const updatedTags = [...(leadData.tags || []), newTag];
        const { error } = await supabase
          .from('leads')
          .update({ tags: updatedTags })
          .eq('id', leadData.id);
        
        if (error) {
          console.error('Erro ao atualizar tags no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao salvar tag');
          setTimeout(() => setSyncStatus('idle'), 5000);
          return;
        }
        
        console.log('✅ Tag adicionada no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
      
      // Atualizar localmente (será sincronizado via realtime)
      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? { ...conv, tags: [...(conv.tags || []), newTag] }
          : conv
      );
      saveConversations(updatedConversations);
      setSelectedConv({ ...selectedConv, tags: [...(selectedConv.tags || []), newTag] });
      setNewTag("");
      toast.success("Tag adicionada!");
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar tag');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const addToFunnel = async () => {
    if (!selectedConv || !selectedFunilId || !selectedFunnel) {
      toast.error("Selecione o funil e a etapa");
      return;
    }
    
    try {
      setSyncStatus('syncing');
      
      // Buscar ou criar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Atualizar funil e etapa no Supabase
        const { error } = await supabase
          .from('leads')
          .update({ 
            funil_id: selectedFunilId,
            etapa_id: selectedFunnel,
          })
          .eq('id', leadData.id);
        
        if (error) {
          console.error('Erro ao atualizar funil no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao salvar no funil');
          setTimeout(() => setSyncStatus('idle'), 5000);
          return;
        }
        
        console.log('✅ Lead adicionado ao funil no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
      
      // Buscar nome da etapa para exibição local
      const etapaSelecionada = etapas.find(e => e.id === selectedFunnel);
      const nomeEtapa = etapaSelecionada?.nome || "Adicionado";
      
      // Atualizar localmente (será sincronizado via realtime)
      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? { ...conv, funnelStage: nomeEtapa }
          : conv
      );
      saveConversations(updatedConversations);
      setSelectedConv({ ...selectedConv, funnelStage: nomeEtapa });
      setSelectedFunilId("");
      setSelectedFunnel("");
      
      // Recarregar dados do lead vinculado
      await recarregarLeadVinculado(selectedConv.id);
      
      toast.success(`Lead adicionado ao funil!`);
    } catch (error) {
      console.error('Erro ao adicionar ao funil:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar ao funil');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const updateResponsavel = async () => {
    if (!selectedConv || !newResponsavel) {
      toast.error("Selecione um responsável");
      return;
    }
    
    try {
      setSyncStatus('syncing');
      
      // Buscar ou criar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Por enquanto, salvamos o nome do responsável em notes ou company
        // Em produção, você pode ter uma tabela de usuários e usar responsavel_id
        const { error } = await supabase
          .from('leads')
          .update({ 
            notes: `Responsável: ${newResponsavel}${leadData.notes ? '\n' + leadData.notes : ''}`
          })
          .eq('id', leadData.id);
        
        if (error) {
          console.error('Erro ao atualizar responsável no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao salvar responsável');
          setTimeout(() => setSyncStatus('idle'), 5000);
          return;
        }
        
        console.log('✅ Responsável atualizado no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
      
      // Atualizar localmente
      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? { ...conv, responsavel: newResponsavel }
          : conv
      );
      saveConversations(updatedConversations);
      setSelectedConv({ ...selectedConv, responsavel: newResponsavel });
      setNewResponsavel("");
      toast.success("Responsável atualizado!");
    } catch (error) {
      console.error('Erro ao atualizar responsável:', error);
      setSyncStatus('error');
      toast.error('Erro ao atualizar responsável');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // Criar tarefa vinculada ao lead
  const criarTarefaDoLead = async () => {
    if (!selectedConv || !newTaskTitle.trim()) {
      toast.error("Digite o título da tarefa");
      return;
    }

    if (!leadVinculado?.id) {
      toast.error("Nenhum lead vinculado. Crie um lead primeiro.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }

      const taskData = {
        title: newTaskTitle,
        description: newTaskDescription || null,
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        status: 'pendente',
        lead_id: leadVinculado.id,
        company_id: userRole.company_id,
        owner_id: session.user.id,
      };

      const { error } = await supabase
        .from('tasks')
        .insert([taskData]);

      if (error) {
        console.error('❌ Erro ao criar tarefa:', error);
        toast.error('Erro ao criar tarefa');
        return;
      }

      console.log('✅ Tarefa criada com sucesso');
      toast.success('Tarefa criada!');
      
      // Limpar campos
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("media");
      setNewTaskDueDate("");
    } catch (error) {
      console.error('❌ Erro ao criar tarefa:', error);
      toast.error('Erro ao criar tarefa');
    }
  };

  const deletarTarefa = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        console.error('❌ Erro ao deletar tarefa:', error);
        toast.error('Erro ao deletar tarefa');
        return;
      }

      console.log('✅ Tarefa deletada');
    } catch (error) {
      console.error('❌ Erro ao deletar tarefa:', error);
      toast.error('Erro ao deletar tarefa');
    }
  };

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'concluida' ? 'pendente' : 'concluida';
      
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        console.error('❌ Erro ao atualizar status:', error);
        toast.error('Erro ao atualizar status');
        return;
      }

      console.log('✅ Status atualizado');
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const updateLeadInfo = async () => {
    if (!selectedConv) return;
    
    try {
      setSyncStatus('syncing');
      
      // Buscar ou criar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Preparar dados para atualização
        const updateData: any = {};
        
        if (newProduto) updateData.servico = newProduto;
        if (newValor) {
          // Extrair valor numérico
          const numericValue = parseFloat(newValor.replace(/[^\d,]/g, '').replace(',', '.'));
          if (!isNaN(numericValue)) {
            updateData.value = numericValue;
          }
        }
        if (newAnotacoes !== undefined && newAnotacoes !== '') {
          updateData.notes = newAnotacoes;
        }
        
        // Atualizar no Supabase
        const { error } = await supabase
          .from('leads')
          .update(updateData)
          .eq('id', leadData.id);
        
        if (error) {
          console.error('Erro ao atualizar informações no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao salvar informações');
          setTimeout(() => setSyncStatus('idle'), 5000);
          return;
        }
        
        console.log('✅ Informações atualizadas no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
      }
      
      // Atualizar localmente (será sincronizado via realtime)
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
    } catch (error) {
      console.error('Erro ao atualizar informações:', error);
      setSyncStatus('error');
      toast.error('Erro ao atualizar informações');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  // Função auxiliar para buscar ou criar lead no Supabase
  const findOrCreateLead = async (conversation: Conversation) => {
    try {
      console.log('🔍 Buscando/criando lead para conversa:', conversation.contactName);
      
      // Buscar user_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ Usuário não autenticado');
        return null;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        console.warn('⚠️ Usuário sem company_id');
        toast.error('Erro: Configuração de empresa não encontrada');
        return null;
      }

      const phoneToSearch = conversation.phoneNumber || conversation.id;
      console.log('📞 Buscando lead com telefone:', phoneToSearch);
      
      // Tentar buscar lead existente por telefone
      const { data: existingLead, error: searchError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', userRole.company_id)
        .or(`phone.eq.${phoneToSearch},telefone.eq.${phoneToSearch}`)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('❌ Erro ao buscar lead:', searchError);
        return null;
      }

      // Se encontrou, retornar
      if (existingLead) {
        console.log('✅ Lead encontrado:', existingLead.id);
        return existingLead;
      }

      // Se não encontrou, criar novo lead
      console.log('📝 Criando novo lead no Supabase...');
      
      // Preparar dados do novo lead
      const newLeadData = {
        name: conversation.contactName,
        phone: phoneToSearch,
        telefone: phoneToSearch,
        company_id: userRole.company_id,
        owner_id: user.id,
        status: 'novo',
        stage: conversation.funnelStage?.toLowerCase() || 'prospeccao',
        value: conversation.valor ? parseFloat(conversation.valor.replace(/[^\d,]/g, '').replace(',', '.')) : 0,
        tags: conversation.tags || [],
        notes: conversation.anotacoes || null,
        servico: conversation.produto || null,
        source: `Conversa ${conversation.channel}`,
      };

      console.log('📦 Dados do novo lead:', newLeadData);

      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert(newLeadData)
        .select()
        .single();

      if (createError) {
        console.error('❌ Erro ao criar lead:', createError);
        toast.error(`Erro ao criar lead: ${createError.message}`);
        return null;
      }

      console.log('✅ Novo lead criado com sucesso:', newLead.id);
      toast.success(`Lead "${conversation.contactName}" criado automaticamente!`);
      
      // O realtime vai propagar para Leads e Funil automaticamente
      return newLead;
    } catch (error) {
      console.error('❌ Erro em findOrCreateLead:', error);
      toast.error('Erro ao processar lead');
      return null;
    }
  };

  // Função para verificar se existe lead vinculado
  const verificarLeadVinculado = async (conversation: Conversation) => {
    try {
      setVerificandoLead(true);
      setMostrarBotaoCriarLead(false);
      
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        setVerificandoLead(false);
        return;
      }

      const phoneToSearch = conversation.phoneNumber || conversation.id;
      
      const { data: existingLead } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', userRole.company_id)
        .or(`phone.eq.${phoneToSearch},telefone.eq.${phoneToSearch}`)
        .maybeSingle();

      if (existingLead) {
        setLeadVinculado(existingLead);
        setMostrarBotaoCriarLead(false);
        console.log("✅ Lead vinculado encontrado:", existingLead);
      } else {
        setLeadVinculado(null);
        setMostrarBotaoCriarLead(true);
        console.log("ℹ️ Nenhum lead vinculado a este contato");
      }
    } catch (error) {
      console.error('Erro ao verificar lead:', error);
      setLeadVinculado(null);
      setMostrarBotaoCriarLead(false);
    } finally {
      setVerificandoLead(false);
    }
  };

  // Função para criar lead manualmente
  const criarLeadManualmente = async () => {
    if (!selectedConv) return;
    
    try {
      setSyncStatus('syncing');
      const lead = await findOrCreateLead(selectedConv);
      
      if (lead) {
        setLeadVinculado(true);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 5000);
      }
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
    }
  };

  const handleEditName = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const novoNome = prompt("Digite o novo nome do contato:", conv.contactName);
    if (!novoNome || novoNome.trim() === "") return;

    try {
      // Atualizar no Supabase
      const { error } = await supabase
        .from('conversas')
        .update({ nome_contato: novoNome.trim() })
        .eq('numero', conv.phoneNumber || conv.id);

      if (error) throw error;

      // Atualizar localmente
      const updated = conversations.map(c =>
        c.id === conversationId ? { ...c, contactName: novoNome.trim() } : c
      );
      setConversations(updated);
      if (selectedConv?.id === conversationId) {
        setSelectedConv({ ...selectedConv, contactName: novoNome.trim() });
      }
      saveConversations(updated);

      toast.success("Nome atualizado com sucesso!");
    } catch (error) {
      console.error('Erro ao editar nome:', error);
      toast.error("Erro ao atualizar nome");
    }
  };

  const handleCreateLead = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    try {
      setSyncStatus('syncing');
      
      // Selecionar a conversa antes de criar o lead
      setSelectedConv(conv);
      
      // Aguardar um pouco para o state atualizar
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const lead = await findOrCreateLead(conv);
      
      if (lead) {
        // Atualizar o mapeamento de leads vinculados
        const formatted = safeFormatPhoneNumber(conv.id);
        setLeadsVinculados(prev => ({
          ...prev,
          [conv.id]: lead.id,
          ...(formatted ? { [formatted]: lead.id } : {})
        }));
        
        setLeadVinculado(lead);
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 4000);
        toast.success(`Lead ${conv.contactName} criado com sucesso!`);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 5000);
        toast.error("Erro ao criar lead");
      }
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 5000);
      toast.error("Erro ao criar lead");
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const confirmar = window.confirm(`Tem certeza que deseja excluir a conversa com ${conv.contactName}?`);
    if (!confirmar) return;

    try {
      // Deletar no Supabase
      const { error } = await supabase
        .from('conversas')
        .delete()
        .eq('numero', conv.phoneNumber || conv.id);

      if (error) throw error;

      // Remover localmente
      const updated = conversations.filter(c => c.id !== conversationId);
      setConversations(updated);
      
      // Remover do mapeamento de leads vinculados
      setLeadsVinculados(prev => {
        const newMap = { ...prev };
        delete newMap[conv.id];
        const formatted = safeFormatPhoneNumber(conv.id);
        if (formatted) {
          delete newMap[formatted];
        }
        return newMap;
      });
      
      if (selectedConv?.id === conversationId) {
        setSelectedConv(null);
        setLeadVinculado(null);
      }
      saveConversations(updated);

      toast.success("Conversa excluída com sucesso!");
    } catch (error) {
      console.error('Erro ao excluir conversa:', error);
      toast.error("Erro ao excluir conversa");
    }
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
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Conversas</h1>
            <div className="flex gap-2 items-center">
              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                <MessageSquare className="h-3 w-3 mr-1" />
                {conversations.length} conversas
              </Badge>
              <NovaConversaDialog
                onNovaConversa={(nome, numero) => {
                  // Verificar se já existe conversa com esse número
                  const existente = conversations.find(c => c.id === numero || c.phoneNumber === numero);
                  
                  if (existente) {
                    setSelectedConv(existente);
                    toast.info("Conversa já existe!");
                    return;
                  }
                  
                  // Criar nova conversa
                  const novaConversa: Conversation = {
                    id: numero,
                    contactName: nome,
                    channel: "whatsapp",
                    status: "waiting",
                    lastMessage: "Nova conversa",
                    unread: 0,
                    messages: [],
                    tags: [],
                    phoneNumber: numero,
                  };
                  
                  const updated = [novaConversa, ...conversations];
                  setConversations(updated);
                  setSelectedConv(novaConversa);
                  saveConversations(updated);
                  
                  toast.success(`Contato ${nome} salvo!`);
                }}
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => {
                  console.log('🔄 Botão Recarregar clicado');
                  loadSupabaseConversations();
                  toast.success('Recarregando conversas...');
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </Button>
            </div>
          </div>
          
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
            <ConversationListItem
              key={conv.id}
              contactName={conv.contactName}
              channel={conv.channel}
              lastMessage={conv.lastMessage}
              timestamp={new Date(conv.messages[conv.messages.length - 1]?.timestamp)}
              unread={conv.unread}
              isSelected={selectedConv?.id === conv.id}
              avatarUrl={conv.avatarUrl}
              tags={conv.tags}
              responsavel={conv.responsavel}
              funnelStage={conv.funnelStage}
              valor={conv.valor}
              conversationId={conv.id}
              leadId={leadsVinculados[conv.id] || leadsVinculados[safeFormatPhoneNumber(conv.id)]}
              onEditName={() => handleEditName(conv.id)}
              onCreateLead={() => handleCreateLead(conv.id)}
              onDeleteConversation={() => handleDeleteConversation(conv.id)}
              onClick={() => {
                console.log('🔍 Conversa selecionada:', conv.id, 'Mensagens:', conv.messages.length);
                
                // Marcar mensagens como lidas e visualizadas
                const updatedConv = {
                  ...conv,
                  unread: 0,
                  messages: conv.messages.map(msg => ({
                    ...msg,
                    read: true
                  }))
                };
                
                setSelectedConv(updatedConv);
                
                // Verificar se existe lead vinculado
                verificarLeadVinculado(conv);
                
                // Atualizar no localStorage
                const updated = conversations.map(c => 
                  c.id === conv.id ? updatedConv : c
                );
                saveConversations(updated);
                
                // Mostrar toast de visualizado
                if (conv.unread > 0) {
                  toast.success('✔️ Mensagens visualizadas');
                }
              }}
            />
          ))}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <ConversationHeader
              contactName={selectedConv.contactName}
              channel={selectedConv.channel}
              avatarUrl={selectedConv.avatarUrl}
              produto={selectedConv.produto}
              valor={selectedConv.valor}
              responsavel={selectedConv.responsavel}
              tags={selectedConv.tags}
              funnelStage={selectedConv.funnelStage}
              showInfoPanel={showInfoPanel}
              onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
              syncStatus={syncStatus}
              leadVinculado={leadVinculado}
              verificandoLead={verificandoLead}
              mostrarBotaoCriarLead={mostrarBotaoCriarLead}
              onCriarLead={criarLeadManualmente}
            />

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
                      selectedConv.messages.map((msg) => (
                        <MessageItem
                          key={msg.id}
                          message={msg}
                          allMessages={selectedConv.messages}
                          onDownload={downloadMedia}
                          onTranscribe={transcreverAudio}
                          onImageClick={(url, name) => {
                            setSelectedMedia({ url, name });
                            setImageModalOpen(true);
                          }}
                          onPdfClick={(url, name) => {
                            setSelectedMedia({ url, name });
                            setPdfModalOpen(true);
                          }}
                          isTranscribing={transcrevendo === msg.id}
                          onReply={handleReply}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onReact={handleReact}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Input Area */}
                <div className="bg-background border-t border-border p-4">
                  {replyingTo && (
                    <div className="mb-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <Reply className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                              Respondendo mensagem
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {selectedConv?.messages.find(m => m.id === replyingTo)?.content || ''}
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
                    <Input
                      placeholder="Escreva sua mensagem..."
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                      className="flex-1"
                    />
                    <AudioRecorder onSendAudio={handleSendAudio} />
                    <Button 
                      onClick={() => {
                        handleSendMessage();
                        setReplyingTo(null);
                      }} 
                      size="icon"
                      className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                      disabled={!messageInput.trim()}
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
                      
                      {/* Status de vinculação com Lead */}
                      <div className="mb-3">
                        {verificandoLead ? (
                          <Badge variant="outline" className="w-full justify-center gap-2 py-2">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            <span className="text-xs">Verificando...</span>
                          </Badge>
                        ) : leadVinculado ? (
                          <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="h-3 w-3" />
                            <span className="text-xs font-medium">Lead vinculado no CRM</span>
                          </Badge>
                        ) : (
                          <div className="space-y-2">
                            <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-xs font-medium">Lead não cadastrado</span>
                            </Badge>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="w-full border-primary/50 hover:bg-primary/10"
                              onClick={criarLeadManualmente}
                            >
                              <User className="h-3 w-3 mr-2" />
                              Criar Lead no CRM
                            </Button>
                          </div>
                        )}
                      </div>
                      
                      <EditarInformacoesLeadDialog 
                        leadId={leadsVinculados[selectedConv.id] || leadsVinculados[safeFormatPhoneNumber(selectedConv.id)] || null}
                        telefone={selectedConv.phoneNumber || selectedConv.id}
                        nomeContato={selectedConv.contactName}
                        onLeadUpdated={() => {
                          // Recarregar dados da conversa após atualização
                          verificarLeadVinculado(selectedConv);
                          loadSupabaseConversations();
                        }}
                      />
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

                    {/* Responsáveis */}
                    <ResponsaveisManager 
                      leadId={leadsVinculados[selectedConv.id] || leadsVinculados[safeFormatPhoneNumber(selectedConv.id)] || null}
                      responsaveisAtuais={selectedConv.responsavel ? [selectedConv.responsavel] : []}
                      onResponsaveisUpdated={(responsaveis) => {
                        console.log('👥 Responsáveis atualizados:', responsaveis);
                        setConversations(prev => prev.map(conv => 
                          conv.id === selectedConv.id 
                            ? { ...conv, responsavel: responsaveis.join(', ') }
                            : conv
                        ));
                        setSelectedConv(prev => prev ? { ...prev, responsavel: responsaveis.join(', ') } : null);
                      }}
                    />

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
                        <TrendingUp className="h-4 w-4" /> Funil de Vendas
                      </h4>
                      {leadVinculado && leadVinculado.funil_id ? (
                        <div className="mb-2 p-2 bg-primary/5 rounded-md border border-primary/20">
                          <p className="text-xs text-muted-foreground">Lead no funil:</p>
                          <p className="text-sm font-medium">
                            {funis.find(f => f.id === leadVinculado.funil_id)?.nome || "Funil"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Etapa atual:</p>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ 
                                backgroundColor: etapas.find(e => e.id === leadVinculado.etapa_id)?.cor || '#3b82f6' 
                              }}
                            />
                            <p className="text-sm font-medium">
                              {etapas.find(e => e.id === leadVinculado.etapa_id)?.nome || "Não definida"}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mb-2">Não está em nenhum funil</p>
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full">
                            <TrendingUp className="h-3 w-3 mr-2" /> Adicionar ao Funil
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Adicionar ao Funil</DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              Selecione o funil de vendas e a etapa para adicionar este lead
                            </p>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="funil-select">Funil de Vendas *</Label>
                              <Select value={selectedFunilId} onValueChange={setSelectedFunilId}>
                                <SelectTrigger id="funil-select">
                                  <SelectValue placeholder={
                                    funis.length === 0 
                                      ? "Nenhum funil disponível" 
                                      : "Escolha um funil"
                                  } />
                                </SelectTrigger>
                                <SelectContent>
                                  {funis.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                      <p>Nenhum funil criado</p>
                                      <p className="text-xs mt-1">Crie um no menu Kanban</p>
                                    </div>
                                  ) : (
                                    funis.map((funil) => (
                                      <SelectItem key={funil.id} value={funil.id}>
                                        📊 {funil.nome}
                                        {funil.descricao && (
                                          <span className="text-xs text-muted-foreground ml-2">
                                            - {funil.descricao}
                                          </span>
                                        )}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              {funis.length === 0 && (
                                <p className="text-xs text-destructive mt-1">
                                  ⚠️ Crie um funil no menu Kanban
                                </p>
                              )}
                            </div>

                            <div>
                              <Label htmlFor="etapa-select">Etapa *</Label>
                              <Select 
                                value={selectedFunnel} 
                                onValueChange={setSelectedFunnel}
                                disabled={!selectedFunilId}
                              >
                                <SelectTrigger id="etapa-select">
                                  <SelectValue placeholder={
                                    !selectedFunilId 
                                      ? "Selecione um funil primeiro" 
                                      : "Escolha a etapa"
                                  } />
                                </SelectTrigger>
                                <SelectContent>
                                  {etapasFiltradas.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">
                                      Nenhuma etapa disponível neste funil
                                    </div>
                                  ) : (
                                    etapasFiltradas.map((etapa) => (
                                      <SelectItem key={etapa.id} value={etapa.id}>
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-3 h-3 rounded-full" 
                                            style={{ backgroundColor: etapa.cor || '#3b82f6' }}
                                          />
                                          {etapa.nome}
                                        </div>
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                              {!selectedFunilId && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  💡 Selecione um funil para ver as etapas
                                </p>
                              )}
                            </div>
                          </div>
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
                          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>💡 Mensagens Rápidas</DialogTitle>
                            </DialogHeader>
                            
                            <Tabs defaultValue="messages" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="messages">Mensagens</TabsTrigger>
                                <TabsTrigger value="categories">Categorias</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="messages" className="space-y-4">
                                {/* Criar nova mensagem */}
                                <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                                  <h4 className="text-sm font-semibold">Criar Nova Mensagem</h4>
                                  <div className="space-y-2">
                                    <Label>Categoria *</Label>
                                    <Select value={newQuickCategory} onValueChange={setNewQuickCategory}>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione a categoria" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {quickCategories.map((cat) => (
                                          <SelectItem key={cat.id} value={cat.id}>
                                            {cat.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Título *</Label>
                                    <Input
                                      value={newQuickTitle}
                                      onChange={(e) => setNewQuickTitle(e.target.value)}
                                      placeholder="Ex: Saudação"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Mensagem *</Label>
                                    <Textarea
                                      value={newQuickContent}
                                      onChange={(e) => setNewQuickContent(e.target.value)}
                                      placeholder="Digite a mensagem..."
                                      rows={3}
                                    />
                                  </div>
                                  <Button onClick={addQuickMessage} className="w-full">
                                    Criar Mensagem Rápida
                                  </Button>
                                </div>

                                {/* Mensagens organizadas por categoria */}
                                <div className="border-t pt-4">
                                  <h4 className="text-sm font-medium mb-3">Mensagens por Categoria:</h4>
                                  {quickCategories.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                      Crie categorias na aba "Categorias"
                                    </p>
                                  ) : (
                                    <Accordion type="single" collapsible className="w-full">
                                      {quickCategories.map((category) => {
                                        const categoryMessages = quickMessages.filter(
                                          (msg) => msg.category === category.id
                                        );
                                        return (
                                          <AccordionItem key={category.id} value={category.id}>
                                            <AccordionTrigger className="hover:no-underline">
                                              <div className="flex items-center justify-between w-full pr-4">
                                                <span className="font-medium">{category.name}</span>
                                                <Badge variant="secondary">{categoryMessages.length}</Badge>
                                              </div>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                              {categoryMessages.length === 0 ? (
                                                <p className="text-sm text-muted-foreground py-2 px-4">
                                                  Nenhuma mensagem nesta categoria
                                                </p>
                                              ) : (
                                                <div className="space-y-2">
                                                  {categoryMessages.map((qm) => (
                                                    <div
                                                      key={qm.id}
                                                      className="flex items-start justify-between p-3 bg-background rounded border"
                                                    >
                                                      <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium">{qm.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-1 break-words">
                                                          {qm.content}
                                                        </p>
                                                      </div>
                                                      <div className="flex gap-1 ml-2">
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
                                              )}
                                            </AccordionContent>
                                          </AccordionItem>
                                        );
                                      })}
                                    </Accordion>
                                  )}
                                </div>
                              </TabsContent>
                              
                              <TabsContent value="categories" className="space-y-4">
                                {/* Criar nova categoria */}
                                <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                                  <h4 className="text-sm font-semibold">Criar Nova Categoria</h4>
                                  <div className="flex gap-2">
                                    <Input
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      placeholder="Nome da categoria"
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          addQuickCategory();
                                        }
                                      }}
                                    />
                                    <Button onClick={addQuickCategory}>
                                      Criar
                                    </Button>
                                  </div>
                                </div>

                                {/* Lista de categorias */}
                                <div>
                                  <h4 className="text-sm font-medium mb-3">Categorias Criadas:</h4>
                                  <div className="space-y-2">
                                    {quickCategories.map((cat) => {
                                      const messageCount = quickMessages.filter(
                                        (msg) => msg.category === cat.id
                                      ).length;
                                      return (
                                        <div
                                          key={cat.id}
                                          className="flex items-center justify-between p-3 bg-muted rounded border"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className="font-medium">{cat.name}</span>
                                            <Badge variant="secondary">
                                              {messageCount} {messageCount === 1 ? "mensagem" : "mensagens"}
                                            </Badge>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => deleteQuickCategory(cat.id)}
                                            disabled={messageCount > 0}
                                          >
                                            Excluir
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </TabsContent>
                            </Tabs>
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

                        {/* Tarefas do Lead */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <CheckSquare className="h-4 w-4 mr-2" /> Tarefas do Lead
                              {leadTasks.length > 0 && (
                                <Badge variant="secondary" className="ml-auto">
                                  {leadTasks.filter(t => t.status !== 'concluida').length}
                                </Badge>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>📋 Tarefas do Lead</DialogTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                Gerencie as tarefas relacionadas a este lead
                              </p>
                            </DialogHeader>

                            {!leadVinculado?.id ? (
                              <div className="text-center py-8 text-muted-foreground">
                                <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p>Crie um lead primeiro para adicionar tarefas</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Criar nova tarefa */}
                                <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                                  <h4 className="text-sm font-semibold">Criar Nova Tarefa</h4>
                                  <div className="space-y-2">
                                    <Label>Título *</Label>
                                    <Input
                                      value={newTaskTitle}
                                      onChange={(e) => setNewTaskTitle(e.target.value)}
                                      placeholder="Ex: Enviar proposta comercial"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Descrição</Label>
                                    <Textarea
                                      value={newTaskDescription}
                                      onChange={(e) => setNewTaskDescription(e.target.value)}
                                      placeholder="Detalhes da tarefa..."
                                      rows={2}
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <Label>Prioridade</Label>
                                      <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="baixa">🟢 Baixa</SelectItem>
                                          <SelectItem value="media">🟡 Média</SelectItem>
                                          <SelectItem value="alta">🔴 Alta</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Data de Vencimento</Label>
                                      <Input
                                        type="date"
                                        value={newTaskDueDate}
                                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                                      />
                                    </div>
                                  </div>
                                  <Button onClick={criarTarefaDoLead} className="w-full">
                                    <CheckSquare className="h-4 w-4 mr-2" />
                                    Criar Tarefa
                                  </Button>
                                </div>

                                {/* Lista de tarefas */}
                                <div className="border-t pt-4">
                                  <h4 className="text-sm font-medium mb-3">
                                    Tarefas ({leadTasks.length})
                                  </h4>
                                  {leadTasks.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">
                                      Nenhuma tarefa criada ainda
                                    </p>
                                  ) : (
                                    <div className="space-y-2">
                                      {leadTasks.map((task) => (
                                        <div
                                          key={task.id}
                                          className={`p-3 border rounded-lg ${
                                            task.status === 'concluida' 
                                              ? 'bg-muted/50 opacity-60' 
                                              : 'bg-background'
                                          }`}
                                        >
                                          <div className="flex items-start gap-3">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 mt-0.5"
                                              onClick={() => toggleTaskStatus(task.id, task.status)}
                                            >
                                              {task.status === 'concluida' ? (
                                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                              ) : (
                                                <div className="h-5 w-5 border-2 rounded-full" />
                                              )}
                                            </Button>
                                            <div className="flex-1 min-w-0">
                                              <p className={`text-sm font-medium ${
                                                task.status === 'concluida' ? 'line-through' : ''
                                              }`}>
                                                {task.title}
                                              </p>
                                              {task.description && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                  {task.description}
                                                </p>
                                              )}
                                              <div className="flex items-center gap-2 mt-2">
                                                {task.priority === 'alta' && (
                                                  <Badge variant="destructive" className="text-xs">
                                                    🔴 Alta
                                                  </Badge>
                                                )}
                                                {task.priority === 'media' && (
                                                  <Badge variant="secondary" className="text-xs">
                                                    🟡 Média
                                                  </Badge>
                                                )}
                                                {task.priority === 'baixa' && (
                                                  <Badge variant="outline" className="text-xs">
                                                    🟢 Baixa
                                                  </Badge>
                                                )}
                                                {task.due_date && (
                                                  <span className="text-xs text-muted-foreground">
                                                    📅 {new Date(task.due_date).toLocaleDateString('pt-BR')}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8"
                                              onClick={() => deletarTarefa(task.id)}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
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
      
      {/* Modal de Visualização de Imagem */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="relative h-full">
            <img 
              src={selectedMedia?.url} 
              alt={selectedMedia?.name || "Imagem"}
              className="w-full h-full object-contain rounded-lg"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4"
              onClick={() => selectedMedia && downloadMedia(selectedMedia.url, `${selectedMedia.name}.jpg`)}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização de PDF */}
      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-2">
          <DialogHeader className="px-4 pt-2">
            <DialogTitle>{selectedMedia?.name || 'Documento PDF'}</DialogTitle>
          </DialogHeader>
          <div className="h-[75vh] w-full">
            <iframe 
              src={selectedMedia?.url} 
              className="w-full h-full border-0 rounded"
              title="PDF Viewer"
            />
          </div>
          <div className="px-4 pb-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => selectedMedia && downloadMedia(selectedMedia.url, selectedMedia.name || 'documento.pdf')}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Conversas;
