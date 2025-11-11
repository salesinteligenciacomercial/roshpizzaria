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
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageSquare, Instagram, Facebook, Send, Search, Bot, User, Paperclip, 
  Clock, Calendar, Zap, FileText, Tag, TrendingUp, ArrowRightLeft, Image as ImageIcon,
  Mic, FileUp, Check, CheckCheck, Phone, Video, Info, DollarSign, Users, Bell, Download, Volume2,
  RefreshCw, CheckCircle2, AlertCircle, Reply, CheckSquare, X, Plus, Trash2, Wifi, WifiOff, Loader2
} from "lucide-react";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CountdownTimer } from "@/components/conversas/CountdownTimer";
import { ConversationHeader } from "@/components/conversas/ConversationHeader";
import { ConversationListItem } from "@/components/conversas/ConversationListItem";
import { MessageItem } from "@/components/conversas/MessageItem";
import { AudioRecorder } from "@/components/conversas/AudioRecorder";
import { MediaUpload } from "@/components/conversas/MediaUpload";
import { NovaConversaDialog } from "@/components/conversas/NovaConversaDialog";
import { ResponsaveisManager } from "@/components/conversas/ResponsaveisManager";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { formatPhoneNumber, safeFormatPhoneNumber } from "@/utils/phoneFormatter";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import * as evolutionAPI from "@/services/evolutionApi";

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
  transcricao?: string;
  transcriptionStatus?: "pending" | "processing" | "completed" | "error"; // Status da transcrição
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
  isGroup?: boolean;
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
  compromisso_id: string;
  canal: string;
  status_envio: string;
  mensagem?: string;
  horas_antecedencia: number;
  data_envio?: string;
  created_at: string;
  destinatario?: string;
  telefone_responsavel?: string;
  compromisso?: {
    data_hora_inicio: string;
    tipo_servico: string;
    lead_id?: string;
  };
}

interface ScheduledMessage {
  id: string;
  conversationId: string;
  content: string;
  datetime: string;
}

interface Meeting {
  id: string;
  lead_id?: string;
  usuario_responsavel_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  observacoes?: string;
  custo_estimado?: number;
  lembrete_enviado: boolean;
  created_at: string;
  company_id?: string;
  lead?: {
    name: string;
    phone?: string;
  };
}

const CONVERSATIONS_KEY = "continuum_conversations";
const CONVERSATIONS_CACHE_KEY = "continuum_conversations_cache"; // Cache para carregamento instantâneo
const CONVERSATIONS_CACHE_TIMESTAMP_KEY = "continuum_conversations_cache_timestamp";
const QUICK_MESSAGES_KEY = "continuum_quick_messages";
const QUICK_CATEGORIES_KEY = "continuum_quick_categories";
const REMINDERS_KEY = "continuum_reminders";
const SCHEDULED_MESSAGES_KEY = "continuum_scheduled_messages";
const MEETINGS_KEY = "continuum_meetings";
const AI_MODE_KEY = "continuum_ai_mode";
const CACHE_MAX_AGE = 5 * 60 * 1000; // Cache válido por 5 minutos

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
  const [filter, setFilter] = useState<"all" | "waiting" | "answered" | "resolved" | "group">("all");
  const [searchTerm, setSearchTerm] = useState("");
  // MELHORIA: Estado para busca debounced (otimização de performance)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  // MELHORIA: Estados para paginação e cache
  const [conversationsLimit, setConversationsLimit] = useState(30); // ⚡ Limitar conversas iniciais para 30
  const [conversationsOffset, setConversationsOffset] = useState(0); // Offset para paginação
  const [hasMoreConversations, setHasMoreConversations] = useState(true); // Flag se há mais conversas
  const [loadingMore, setLoadingMore] = useState(false); // Loading state para "carregar mais"
  const [messagesLimit, setMessagesLimit] = useState(50); // Limite de mensagens exibidas
  const conversationsCacheRef = useRef<Map<string, Conversation>>(new Map()); // Cache de conversas abertas
  const messagesCacheRef = useRef<Map<string, Message[]>>(new Map()); // Cache de mensagens carregadas
  const [messageInput, setMessageInput] = useState("");
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const inflightAvatarPromisesRef = useRef<Map<string, Promise<string | undefined>>>(new Map());
  const initialLoadRef = useRef<boolean>(false);
  const [aiMode, setAiMode] = useState<Record<string, boolean>>({});
  const [quickMessages, setQuickMessages] = useState<QuickMessage[]>([]);
  const [quickCategories, setQuickCategories] = useState<QuickMessageCategory[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>('idle');
  const [leadVinculado, setLeadVinculado] = useState<any>(null);
  const [mostrarBotaoCriarLead, setMostrarBotaoCriarLead] = useState(false);
  const [leadsVinculados, setLeadsVinculados] = useState<Record<string, string>>({}); // conversationId -> leadId
  const [onlineStatus, setOnlineStatus] = useState<Record<string, 'online' | 'offline' | 'unknown'>>({}); // telefone -> status
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null); // Company ID do usuário
  const [userName, setUserName] = useState<string>(""); // Nome do usuário logado
  const [companyMetrics, setCompanyMetrics] = useState<{
    totalConversas: number;
    conversasAtivas: number;
    mensagensHoje: number;
    whatsappConnections: number;
    whatsappConnected: number;
  }>({
    totalConversas: 0,
    conversasAtivas: 0,
    mensagensHoje: 0,
    whatsappConnections: 0,
    whatsappConnected: 0,
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [historyStats, setHistoryStats] = useState<Record<string, { total: number; loaded: number }>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConvRef = useRef<Conversation | null>(null);
  const userCompanyIdRef = useRef<string | null>(null);
  
  // 🔊 Ref para som de notificação
  const notificationSound = useRef<HTMLAudioElement | null>(null);
  
  const location = useLocation();
  
  // Estados para modais de visualização
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; name?: string } | null>(null);
  // MELHORIA: Gerenciar status de transcrição por mensagem
  const [transcriptionStatuses, setTranscriptionStatuses] = useState<Record<string, "pending" | "processing" | "completed" | "error">>({});
  const transcriptionPollingRefs = useRef<Record<string, { interval?: NodeJS.Timeout; timeout?: NodeJS.Timeout }>>({});
  
  // Estados para controle dos modais
  const [tarefasDialogOpen, setTarefasDialogOpen] = useState(false);
  const [tarefasTabValue, setTarefasTabValue] = useState("criar");
  const [reunioesDialogOpen, setReunioesDialogOpen] = useState(false);
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const [tarefaModalOpen, setTarefaModalOpen] = useState(false);
  
  // CORREÇÃO: Estados para quadro e etapa (igual ao Funil de Vendas) - DEVE VIR ANTES DOS useEffects
  const [taskBoards, setTaskBoards] = useState<any[]>([]);
  const [taskColumns, setTaskColumns] = useState<any[]>([]);
  const [selectedTaskBoardId, setSelectedTaskBoardId] = useState<string>("");
  const [selectedTaskColumnId, setSelectedTaskColumnId] = useState<string>("");
  
  // Estados para sincronização WhatsApp e restauração de conversas
  const [isContactInactive, setIsContactInactive] = useState(false);
  const [restoringConversation, setRestoringConversation] = useState(false);
  
  // MELHORIA: Estados para sincronização realtime
  const [realtimeConnectionStatus, setRealtimeConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');
  const [realtimeReconnectAttempts, setRealtimeReconnectAttempts] = useState(0);
  const realtimeChannelRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectingRef = useRef<boolean>(false);

  // MELHORIA: Função auxiliar para chamar Edge Functions com retry, timeout e fallback
  const callEdgeFunctionWithRetry = async <T = any>(
    functionName: string,
    body: any,
    options: {
      maxRetries?: number;
      timeout?: number;
      fallback?: () => T | Promise<T>;
      onError?: (error: any, attempt: number) => void;
    } = {}
  ): Promise<T | null> => {
    const {
      maxRetries = 3,
      timeout = 10000, // 10 segundos
      fallback,
      onError
    } = options;

    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [EDGE-FUNCTION] Chamando ${functionName} (tentativa ${attempt}/${maxRetries})...`);

        // Criar promise com timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Timeout após ${timeout}ms`));
          }, timeout);
        });

        // Promise da edge function
        const functionPromise = supabase.functions.invoke(functionName, { body });

        // Race entre função e timeout
        const result = await Promise.race([functionPromise, timeoutPromise]);

        // Validar resposta
        if (!result || !result.data) {
          throw new Error('Resposta inválida da edge function');
        }

        // Verificar se há erro na resposta
        if (result.error) {
          throw new Error(result.error.message || 'Erro na edge function');
        }

        console.log(`✅ [EDGE-FUNCTION] ${functionName} executada com sucesso (tentativa ${attempt})`);
        return result.data as T;

      } catch (error: any) {
        lastError = error;
        const errorMessage = error?.message || String(error);
        
        console.error(`❌ [EDGE-FUNCTION] Erro ao chamar ${functionName} (tentativa ${attempt}/${maxRetries}):`, {
          error: errorMessage,
          attempt,
          functionName,
          body: typeof body === 'object' ? JSON.stringify(body).substring(0, 100) : body
        });

        // Logar erro completo para monitoramento
        if (onError) {
          onError(error, attempt);
        }

        // Se não for a última tentativa, esperar antes de tentar novamente (backoff exponencial)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5s
          console.log(`⏳ [EDGE-FUNCTION] Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Se todas as tentativas falharam, usar fallback se disponível
    console.error(`❌ [EDGE-FUNCTION] Todas as tentativas falharam para ${functionName}. Último erro:`, lastError);
    
    if (fallback) {
      console.log(`🔄 [EDGE-FUNCTION] Usando fallback para ${functionName}`);
      try {
        return await fallback();
      } catch (fallbackError) {
        console.error(`❌ [EDGE-FUNCTION] Erro no fallback para ${functionName}:`, fallbackError);
      }
    }

    return null;
  };

  // MELHORIA: Avatar com cache + fallback
  const getProfilePictureWithFallback = async (number: string, companyId: string, contactName: string): Promise<string | undefined> => {
    if (!number) return undefined;
    
    const isGroup = /@g\.us$/.test(String(number));
    const normalized = isGroup ? number : normalizePhoneForWA(number);
    const cacheKey = `${companyId || 'no-company'}:${normalized}`;
    const cached = avatarCacheRef.current.get(cacheKey);
    if (cached) return cached;

    const inflight = inflightAvatarPromisesRef.current.get(cacheKey);
    if (inflight) return await inflight;

    const promise = (async () => {
      const result = await callEdgeFunctionWithRetry<{ profilePictureUrl?: string }>(
      'get-profile-picture',
        { number: normalized, company_id: companyId },
      {
          maxRetries: 2,
          timeout: 8000,
        fallback: () => {
          // Fallback diferente para grupos e contatos individuais
          const fallbackUrl = isGroup
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || 'Grupo')}&background=10b981&color=fff`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || normalized)}&background=0ea5e9&color=fff`;
          return Promise.resolve({ profilePictureUrl: fallbackUrl });
        },
          onError: (error) => {
            console.error('❌ [PROFILE-PICTURE] In-flight erro:', error);
          }
        }
      );
      const url = result?.profilePictureUrl || (isGroup 
        ? `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || 'Grupo')}&background=10b981&color=fff`
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName || normalized)}&background=0ea5e9&color=fff`);
      avatarCacheRef.current.set(cacheKey, url);
      inflightAvatarPromisesRef.current.delete(cacheKey);
      return url;
    })();
    inflightAvatarPromisesRef.current.set(cacheKey, promise);
    return await promise;
  };

  // MELHORIA: Wrapper enviar-whatsapp com retries e mapeamento de erros → toast
  const sendWhatsAppWithRetry = async (body: { company_id: string } & Record<string, any>): Promise<{ success: boolean; errorCode?: string; httpStatus?: number; message?: string; details?: any }> => {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res: any = await supabase.functions.invoke('enviar-whatsapp', { body });
        const data = res?.data;
        const err = res?.error;
        // Tratar erros retornados como data
        if (data && (data.error || data.code) && !data.success) {
          const code = data.code || data.error || 'UNKNOWN_ERROR';
          const msg = data.error || data.message || 'Falha no envio';
          const status = res?.status || undefined;
          const details = data.details || data;
          showWhatsAppErrorToast(code, status, details);
          console.debug('❌ [WHATSAPP] Erro detalhado:', { attempt, status, code, msg: data?.error || data?.message, details });
          return { success: false, errorCode: code, httpStatus: status, message: msg, details };
        }
        if (err) {
          let code: string | undefined;
          let httpStatus: number | undefined = (err as any)?.status || (err as any)?.context?.status;
          // Tentar extrair code do message (JSON) ou string
          const raw = err?.message || '';
          try {
            const parsed = JSON.parse(raw);
            code = parsed?.code || parsed?.error?.code || parsed?.error;
          } catch {
            if (/NO_API_KEY/.test(raw)) code = 'NO_API_KEY';
            else if (/NO_WHATSAPP_CONNECTION/.test(raw)) code = 'NO_WHATSAPP_CONNECTION';
            else if (/EXTERNAL_API_ERROR/.test(raw)) code = 'EXTERNAL_API_ERROR';
            else if (/CONFIG_ERROR/.test(raw)) code = 'CONFIG_ERROR';
          }
          showWhatsAppErrorToast(code, httpStatus, raw);
          console.debug('❌ [WHATSAPP] Erro detalhado:', { attempt, httpStatus, code, raw: (err?.message || '').slice(0, 200) });
          return { success: false, errorCode: code, httpStatus, message: String(raw).slice(0, 200), details: raw };
        }
        if (data?.success) return { success: true };
        // Falha desconhecida
        toast.error('Falha desconhecida ao enviar mensagem.');
        return { success: false };
      } catch (err: any) {
        console.error(`❌ [WHATSAPP] Exceção na tentativa ${attempt}:`, err);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 5000)));
          continue;
        }
        toast.error('Erro de rede ao enviar mensagem. Verifique sua conexão.');
        return { success: false };
      }
    }
    return { success: false };
  };

  const showWhatsAppErrorToast = (code?: string, httpStatus?: number, details?: any) => {
    const prefix = code ? `[${code}] ` : '';
    const description = details ? (typeof details === 'string' ? details.slice(0, 240) : JSON.stringify(details).slice(0, 240)) : undefined;
    const opts = description ? { description } as any : undefined;
    if (httpStatus === 401 || httpStatus === 403) {
      toast.error(`${prefix}Sem autorização. Faça login novamente ou verifique permissões.`, opts);
    } else if (httpStatus === 404 || code === 'NO_WHATSAPP_CONNECTION') {
      toast.error(`${prefix}Conexão/instância não encontrada. Verifique suas conexões WhatsApp.`, opts);
    } else if (httpStatus && httpStatus >= 500) {
      toast.error(`${prefix}Erro no servidor. Tente novamente em instantes.`, opts);
    } else if (code === 'NO_API_KEY') {
      toast.error(`${prefix}API key ausente. Configure EVOLUTION_API_KEY ou a conexão da empresa.`, opts);
    } else if (code === 'EXTERNAL_API_ERROR') {
      toast.error(`${prefix}Falha na Evolution API. Verifique instância e payload.`, opts);
    } else if (code === 'CONFIG_ERROR') {
      toast.error(`${prefix}Configuração incompleta da Evolution API.`, opts);
    } else {
      toast.error(`${prefix}Falha ao enviar. Verifique os dados e tente novamente.`, opts);
    }
  };

  // MELHORIA: Wrapper específico para transcrever-audio com fallback de "transcrição pendente"
  const transcribeAudioWithRetry = async (body: {
    audioUrl: string;
    audioBase64?: string;
    company_id: string;
  }): Promise<{ transcription?: string; status: string }> => {
    return await callEdgeFunctionWithRetry<{ transcription?: string; status: string }>(
      'transcrever-audio',
      body,
      {
        maxRetries: 3,
        timeout: 10000,
        fallback: () => {
          console.warn('⚠️ [TRANSCRIBE] Transcrição falhou - marcando como pendente');
          return Promise.resolve({
            transcription: '[Transcrição pendente - erro ao processar áudio]',
            status: 'pending'
          });
        },
        onError: (error, attempt) => {
          console.error(`❌ [TRANSCRIBE] Erro na tentativa ${attempt}:`, {
            error: error?.message || String(error),
            audioUrl: body.audioUrl?.substring(0, 100)
          });
        }
      }
    ) || { transcription: '[Transcrição pendente - erro ao processar áudio]', status: 'pending' };
  };
  
  // MELHORIA: Debounce mais agressivo na busca (500ms) - otimização de performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500); // 500ms de delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Contador de conversas aguardando resposta
  const waitingCount = useMemo(() => {
    return conversations.filter(
      (conv) => conv.status === "waiting" && conv.isGroup !== true
    ).length;
  }, [conversations]);

  // MELHORIA: useMemo para filtros e buscas - otimização de performance
  const filteredConversations = useMemo(() => {
    console.log('🔍 [DEBUG] Filtrando conversas:', {
      total: conversations.length,
      filtro: filter,
      busca: debouncedSearchTerm
    });
    
    let filtered = conversations;

    // ⚡ CORREÇÃO: Aplicar filtro de status corretamente
    if (filter === "all") {
      // No filtro "Todos", mostrar TODAS as conversas INDIVIDUAIS (excluir grupos)
      filtered = filtered.filter((conv) => conv.isGroup !== true);
    } else if (filter === "group") {
      // No filtro "Grupos", mostrar APENAS grupos (não aparecem em outros filtros)
      filtered = filtered.filter((conv) => conv.isGroup === true);
    } else if (filter === "waiting") {
      // Filtro "Aguardando": mensagens recebidas recentemente (não respondidas)
      // Última mensagem deve ser do contato (não do usuário)
      filtered = filtered.filter((conv) => {
        if (conv.isGroup === true) return false; // Excluir grupos
        if (conv.status === 'resolved') return false; // Excluir finalizadas
        
        // Verificar se a última mensagem é do contato (não respondida)
        const lastMessage = conv.messages?.[conv.messages.length - 1];
        if (!lastMessage) return false;
        
        // Se última mensagem é do contato = aguardando resposta
        return lastMessage.sender === 'contact';
      });
    } else if (filter === "answered") {
      // Filtro "Respondidos": conversas que foram respondidas
      // Última mensagem deve ser do usuário OU status é answered
      filtered = filtered.filter((conv) => {
        if (conv.isGroup === true) return false; // Excluir grupos
        if (conv.status === 'resolved') return false; // Excluir finalizadas
        
        // Verificar se a última mensagem é do usuário (respondida)
        const lastMessage = conv.messages?.[conv.messages.length - 1];
        if (!lastMessage) return false;
        
        // Se última mensagem é do usuário = foi respondida
        return lastMessage.sender === 'user' || conv.status === 'answered';
      });
    } else if (filter === "resolved") {
      // Filtro "Finalizados": conversas que foram finalizadas
      filtered = filtered.filter((conv) => {
        if (conv.isGroup === true) return false; // Excluir grupos
        return conv.status === 'resolved';
      });
    }

    console.log('📊 [DEBUG] Após filtro de status:', filtered.length);

    // Aplicar busca debounced (mais agressivo)
    if (debouncedSearchTerm.trim()) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter((conv) =>
        conv.contactName.toLowerCase().includes(searchLower) ||
        conv.lastMessage?.toLowerCase().includes(searchLower) ||
        conv.phoneNumber?.includes(searchLower)
      );
    }

    console.log('📊 [DEBUG] Após busca:', filtered.length);

    // Ordenar por última mensagem (mais recentes primeiro)
    filtered = filtered.sort((a, b) => {
      // ⚡ CORREÇÃO: Garantir que timestamp seja Date antes de chamar getTime()
      const aLastMsg = a.messages?.[a.messages.length - 1];
      const bLastMsg = b.messages?.[b.messages.length - 1];
      const aTimestamp = aLastMsg?.timestamp instanceof Date 
        ? aLastMsg.timestamp 
        : (aLastMsg?.timestamp ? new Date(aLastMsg.timestamp) : null);
      const bTimestamp = bLastMsg?.timestamp instanceof Date 
        ? bLastMsg.timestamp 
        : (bLastMsg?.timestamp ? new Date(bLastMsg.timestamp) : null);
      const aTime = aTimestamp?.getTime() || 0;
      const bTime = bTimestamp?.getTime() || 0;
      return bTime - aTime;
    });

    // Limitar quantidade após aplicar filtros
    return filtered.slice(0, conversationsLimit);
  }, [conversations, filter, debouncedSearchTerm, conversationsLimit]);

  // Mensagens exibidas: sempre refletir state atual da conversa selecionada (evitar cache obsoleto)
  const displayedMessages = useMemo(() => {
    if (!selectedConv) return [];
    const messages = selectedConv.messages || [];
    return messages.slice(-messagesLimit);
  }, [selectedConv?.id, selectedConv?.messages, messagesLimit]);

  // MELHORIA: Função para carregar mais mensagens (lazy loading)
  const loadMoreMessages = useCallback(async () => {
    if (!selectedConv) return;
    
    const currentLimit = messagesLimit;
    const newLimit = currentLimit + 50; // Carregar mais 50 mensagens
    
    setMessagesLimit(newLimit);
    
    // Se precisar buscar do servidor, fazer aqui
    // Por enquanto, apenas aumentamos o limite do cache
    
    console.log(`📦 [PERFORMANCE] Carregando mais mensagens: ${currentLimit} -> ${newLimit}`);
  }, [selectedConv, messagesLimit]);

  // MELHORIA: Função para atualizar cache de conversas abertas - otimização de performance
  const updateConversationCache = useCallback((conversation: Conversation) => {
    conversationsCacheRef.current.set(conversation.id, conversation);
    
    // Salvar mensagens no cache separadamente
    if (conversation.messages && conversation.messages.length > 0) {
      messagesCacheRef.current.set(conversation.id, conversation.messages);
    }
    
    // Limitar tamanho do cache (manter apenas últimas 100 conversas)
    if (conversationsCacheRef.current.size > 100) {
      const firstKey = conversationsCacheRef.current.keys().next().value;
      conversationsCacheRef.current.delete(firstKey);
      messagesCacheRef.current.delete(firstKey);
    }
    
    console.log(`💾 [PERFORMANCE] Cache atualizado para conversa: ${conversation.id}`);
  }, []);

  // MELHORIA: Função para recuperar conversa do cache - otimização de performance
  const getConversationFromCache = useCallback((conversationId: string): Conversation | null => {
    const cached = conversationsCacheRef.current.get(conversationId);
    if (cached) {
      console.log(`💾 [PERFORMANCE] Conversa recuperada do cache: ${conversationId}`);
      return cached;
    }
    return null;
  }, []);

  // MELHORIA: Limitar quantidade de conversas carregadas inicialmente - otimização de performance
  const loadInitialConversations = useCallback(async () => {
    try {
      // Carregar apenas as primeiras 50 conversas
      const { data, error } = await supabase
        .from('conversas')
        .select('*')
        .eq('company_id', userCompanyId || '')
        .order('created_at', { ascending: false })
        .limit(50); // Limitar quantidade inicial

      if (error) throw error;

      // Processar e cachear conversas
      if (data && data.length > 0) {
        // Processar dados e atualizar cache
        console.log(`📦 [PERFORMANCE] Carregadas ${data.length} conversas iniciais`);
      }
    } catch (error) {
      console.error('❌ [PERFORMANCE] Erro ao carregar conversas iniciais:', error);
    }
  }, [userCompanyId]);

  // CORREÇÃO: Carregar tarefas quando o modal de tarefas abrir e tiver lead vinculado
  useEffect(() => {
    if (tarefasDialogOpen && leadVinculado?.id) {
      console.log('📋 [TAREFAS] Modal aberto, carregando tarefas para lead:', leadVinculado.id);
      carregarTarefasDoLead(leadVinculado.id);
      // Resetar aba para "criar" quando abrir o modal
      setTarefasTabValue("criar");
    } else if (tarefasDialogOpen && !leadVinculado?.id) {
      // Se abrir sem lead, limpar lista
      setLeadTasks([]);
    }
  }, [tarefasDialogOpen, leadVinculado?.id]);

  // CORREÇÃO: Carregar boards e columns quando o modal de tarefas abrir (igual ao Funil de Vendas)
  useEffect(() => {
    if (tarefasDialogOpen) {
      carregarBoardsEColumns();
    }
  }, [tarefasDialogOpen]);

  // CORREÇÃO: Selecionar primeira coluna quando mudar o quadro
  useEffect(() => {
    if (selectedTaskBoardId && taskColumns.length > 0) {
      const columnsDoBoard = taskColumns.filter(c => c.board_id === selectedTaskBoardId);
      if (columnsDoBoard.length > 0 && !columnsDoBoard.find(c => c.id === selectedTaskColumnId)) {
        setSelectedTaskColumnId(columnsDoBoard[0].id);
      }
    }
  }, [selectedTaskBoardId, taskColumns]);
  
  // CORREÇÃO: Carregar reuniões quando o modal de reuniões abrir e tiver lead vinculado
  useEffect(() => {
    if (reunioesDialogOpen && leadVinculado?.id) {
      loadMeetings();
    }
  }, [reunioesDialogOpen, leadVinculado?.id]);

  // Manter referência atualizada da conversa selecionada para uso em handlers de realtime
  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  useEffect(() => {
    userCompanyIdRef.current = userCompanyId;
  }, [userCompanyId]);

  // Sistema de eventos globais para comunicação entre módulos
  const { emitGlobalEvent } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: (data) => {
        console.log('🌍 [Conversas] Lead atualizado via evento global:', data);
        // Atualizar lead vinculado se for o mesmo
        if (leadVinculado && leadVinculado.id === data.id) {
          setLeadVinculado(data);
        }
        // Atualizar conversa correspondente se existir
        setConversations(prev => prev.map(conv => {
          const phoneMatch = conv.phoneNumber === data.phone || conv.phoneNumber === data.telefone;
          if (phoneMatch) {
            return {
              ...conv,
              contactName: data.name || conv.contactName,
              tags: data.tags?.length ? data.tags : conv.tags,
              funnelStage: data.stage || conv.funnelStage,
              produto: data.servico || conv.produto,
              valor: data.value ? `R$ ${Number(data.value).toLocaleString('pt-BR')}` : conv.valor,
              anotacoes: data.notes || conv.anotacoes,
            };
          }
          return conv;
        }));
      },
      onTaskCreated: (data) => {
        console.log('🌍 [Conversas] Nova tarefa criada, verificar se vinculada ao lead:', data);
        // Se uma tarefa foi criada vinculada ao lead atual, podemos mostrar notificação
        if (leadVinculado && data.lead_id === leadVinculado.id) {
          // Opcional: mostrar indicador de tarefa criada
        }
      },
      onMeetingScheduled: (data) => {
        console.log('🌍 [Conversas] Reunião agendada, verificar se vinculada ao lead:', data);
        // Se uma reunião foi agendada vinculada ao lead atual, podemos mostrar notificação
        if (leadVinculado && data.lead_id === leadVinculado.id) {
          // Opcional: mostrar indicador de reunião agendada
        }
      },
      onFunnelStageChanged: (data) => {
        console.log('🌍 [Conversas] Lead movido no funil:', data);
        // Atualizar conversa se o lead mudou de etapa
        setConversations(prev => prev.map(conv => {
          if (leadVinculado && leadVinculado.id === data.leadId) {
            return {
              ...conv,
              funnelStage: data.newStage
            };
          }
          return conv;
        }));
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });

  // Carregar métricas quando a empresa for identificada
  useEffect(() => {
    if (userCompanyId) {
      loadCompanyMetrics();
    }
  }, [userCompanyId]);

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
  
  // Usuários da empresa (para Transferir Atendimento / Responsáveis)
  const [companyUsers, setCompanyUsers] = useState<{ id: string; name: string }[]>([]);
  // Filas de atendimento
  const [queues, setQueues] = useState<any[]>([]);
  // Fila selecionada e seus membros
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [queueMembers, setQueueMembers] = useState<{ id: string; name: string }[]>([]);
  
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

  // Carregar funis e etapas ao montar o componente
  useEffect(() => {
    carregarFunisEEtapas();
  }, []);

  // Carregar usuários da empresa e assinar atualizações quando o painel estiver aberto
  useEffect(() => {
    if (!showInfoPanel) return;
    let channel: any;

    const loadCompanyUsers = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Buscar company_id do usuário atual
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!userRole?.company_id) return;

        // Buscar todos os usuários (ids) da empresa
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('company_id', userRole.company_id);

        const ids = (userRoles || []).map((ur: any) => ur.user_id);
        if (ids.length === 0) {
          setCompanyUsers([]);
          return;
        }

        // Buscar perfis para nomes
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids);

        const users = (profiles || []).map(p => ({ id: p.id, name: (p.full_name || p.email) as string })).filter(u => !!u.name);
        setCompanyUsers(users);
      } catch (e) {
        console.error('Erro ao carregar usuários da empresa:', e);
      }
    };

    loadCompanyUsers();

    // Assinatura realtime: alterações em user_roles da empresa → recarregar lista
    channel = supabase
      .channel(`company-users-realtime`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles' },
        () => loadCompanyUsers()
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showInfoPanel]);

  // Assinar compromissos (agenda) em tempo real quando o painel estiver aberto
  useEffect(() => {
    if (!showInfoPanel || !leadVinculado?.id) return;

    const channel = supabase
      .channel(`compromissos-${leadVinculado.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'compromissos', filter: `lead_id=eq.${leadVinculado.id}` },
        () => {
          // Recarregar reuniões do lead
          loadMeetings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showInfoPanel, leadVinculado?.id]);

  // Carregar filas da empresa e assinar realtime quando o painel estiver aberto
  useEffect(() => {
    if (!showInfoPanel) return;
    let channel: any;

    const loadQueues = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!userRole?.company_id) return;

        const { data } = await supabase
          .from('support_queues')
          .select('*')
          .eq('company_id', userRole.company_id)
          .eq('is_active', true)
          .order('name', { ascending: true });
        setQueues(data || []);
      } catch (e) {
        console.error('Erro ao carregar filas:', e);
      }
    };

    loadQueues();

    channel = supabase
      .channel('support-queues-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_queues' }, () => loadQueues())
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showInfoPanel]);

  // Carregar membros da fila selecionada e assinar realtime
  useEffect(() => {
    if (!showInfoPanel || !selectedQueueId) return;
    let channel: any;

    const loadQueueMembers = async () => {
      try {
        // Buscar membros (user_id) da fila
        const { data: members } = await supabase
          .from('support_queue_members')
          .select('user_id')
          .eq('queue_id', selectedQueueId);

        const ids = (members || []).map((m: any) => m.user_id);
        if (ids.length === 0) {
          setQueueMembers([]);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ids);

        const users = (profiles || []).map(p => ({ id: p.id, name: (p.full_name || p.email) as string })).filter(u => !!u.name);
        setQueueMembers(users);
      } catch (e) {
        console.error('Erro ao carregar membros da fila:', e);
      }
    };

    loadQueueMembers();

    channel = supabase
      .channel(`queue-members-${selectedQueueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_queue_members', filter: `queue_id=eq.${selectedQueueId}` }, () => loadQueueMembers())
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [showInfoPanel, selectedQueueId]);

  // Assinar atribuição da conversa atual (responsável/fila) para refletir transferências em tempo real
  useEffect(() => {
    if (!showInfoPanel || !selectedConv || !userCompanyId) return;

    const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
    const channel = supabase
      .channel(`conv-assign-${telefone}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_assignments', filter: `telefone_formatado=eq.${telefone}` },
        async () => {
          // Buscar assignment atual
          const { data } = await supabase
            .from('conversation_assignments')
            .select('*')
            .eq('company_id', userCompanyId)
            .eq('telefone_formatado', telefone)
            .maybeSingle();

          if (!data) return;

          // Se houver fila, mostrar "Fila: <nome>", se houver usuário, mostrar o nome do usuário
          if (data.queue_id) {
            const q = queues.find(q => q.id === data.queue_id);
            if (q) {
              setSelectedConv(prev => prev ? { ...prev, responsavel: `Fila: ${q.name}` } : prev);
            }
          } else if (data.assigned_user_id) {
            // Buscar nome do usuário
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', data.assigned_user_id)
              .maybeSingle();
            const display = profile?.full_name || profile?.email || 'Agente';
            setSelectedConv(prev => prev ? { ...prev, responsavel: display } : prev);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showInfoPanel, selectedConv?.id, userCompanyId, queues]);

  const assignConversationToUser = async (userId: string, displayName: string) => {
    if (!selectedConv || !userCompanyId) return;
    const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
    try {
      await supabase
        .from('conversation_assignments')
        .upsert({
          company_id: userCompanyId,
          telefone_formatado: telefone,
          assigned_user_id: userId,
          queue_id: null,
        }, { onConflict: 'company_id,telefone_formatado' });

      // Atualizar localmente
      setSelectedConv({ ...selectedConv, responsavel: displayName });
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, responsavel: displayName } : c));
      toast.success(`Atendimento transferido para ${displayName}`);
    } catch (e) {
      console.error('Erro ao atribuir conversa ao usuário:', e);
      toast.error('Erro ao transferir atendimento');
    }
  };

  const assignConversationToQueue = async (queueId: string, queueName: string) => {
    if (!selectedConv || !userCompanyId) return;
    const telefone = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
    try {
      await supabase
        .from('conversation_assignments')
        .upsert({
          company_id: userCompanyId,
          telefone_formatado: telefone,
          queue_id: queueId,
          assigned_user_id: null,
        }, { onConflict: 'company_id,telefone_formatado' });

      // Atualizar localmente
      const label = `Fila: ${queueName}`;
      setSelectedConv({ ...selectedConv, responsavel: label });
      setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, responsavel: label } : c));
      toast.success(`Atendimento enviado para a fila ${queueName}`);
    } catch (e) {
      console.error('Erro ao atribuir conversa à fila:', e);
      toast.error('Erro ao transferir para fila');
    }
  };

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
    if (!leadId) {
      console.warn('⚠️ [TAREFAS] leadId não fornecido');
      setLeadTasks([]);
      return;
    }

    try {
      console.log('📋 [TAREFAS] Carregando tarefas para lead:', leadId);
      
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao carregar tarefas:', error);
        toast.error('Erro ao carregar tarefas');
        return;
      }

      console.log('✅ [TAREFAS] Tarefas carregadas:', tasks?.length || 0, tasks);
      console.log('✅ [TAREFAS] Detalhes das tarefas:', tasks?.map(t => ({ id: t.id, title: t.title, lead_id: t.lead_id })));
      setLeadTasks(tasks || []);
      console.log('✅ [TAREFAS] Estado leadTasks atualizado com', tasks?.length || 0, 'tarefas');
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
      toast.error('Erro ao carregar tarefas');
    }
  };

  // CORREÇÃO: Carregar boards e columns (igual ao Funil de Vendas)
  const carregarBoardsEColumns = async () => {
    try {
      // Carregar boards
      const { data: boardsData, error: boardsError } = await supabase
        .from("task_boards")
        .select("*")
        .order("criado_em");

      if (boardsError) throw boardsError;
      setTaskBoards(boardsData || []);

      // Se houver boards, selecionar o primeiro por padrão
      if (boardsData && boardsData.length > 0 && !selectedTaskBoardId) {
        setSelectedTaskBoardId(boardsData[0].id);
      }

      // Carregar colunas
      const { data: columnsData, error: columnsError } = await supabase
        .from("task_columns")
        .select("*")
        .order("posicao");

      if (columnsError) throw columnsError;
      setTaskColumns(columnsData || []);
    } catch (error) {
      console.error("Erro ao carregar boards e colunas:", error);
      toast.error("Erro ao carregar quadros e etapas");
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
    onInsert: (newLead) => {
      try {
        // Vincular automaticamente quando um lead novo é criado em outro módulo
        const matchSelected = selectedConv && (
          selectedConv.phoneNumber === newLead.phone ||
          selectedConv.phoneNumber === newLead.telefone ||
          selectedConv.id === newLead.phone ||
          selectedConv.id === newLead.telefone
        );

        // Atualizar lista de conversas por telefone correspondente
        setConversations(prev => prev.map(conv => {
          const phoneMatch = conv.phoneNumber === newLead.phone ||
                             conv.phoneNumber === newLead.telefone ||
                             conv.id === newLead.phone ||
                             conv.id === newLead.telefone;
          if (phoneMatch) {
            return {
              ...conv,
              contactName: newLead.name || conv.contactName,
              tags: Array.isArray(newLead.tags) && newLead.tags.length ? newLead.tags : conv.tags,
              funnelStage: newLead.stage || conv.funnelStage,
              produto: newLead.servico || conv.produto,
              valor: newLead.value ? `R$ ${Number(newLead.value).toLocaleString('pt-BR')}` : conv.valor,
              anotacoes: newLead.notes || conv.anotacoes,
            };
          }
          return conv;
        }));

        if (matchSelected) {
          setLeadVinculado(newLead);
          setMostrarBotaoCriarLead(false);
          setLeadsVinculados(prev => ({
            ...prev,
            [selectedConv!.id]: newLead.id
          }));
          setSyncStatus('synced');
        }
      } catch (e) {
        console.error('❌ [Conversas] Erro no onInsert de useLeadsSync:', e);
        setSyncStatus('error');
      }
    },
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
            setTimeout(() => setSyncStatus('synced'), 500);
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
    showNotifications: false, // Não mostrar notificações automáticas
    companyId: userCompanyId // 🔒 ISOLAMENTO: Apenas leads da empresa atual
  });

  // Carregar métricas da empresa
  const loadCompanyMetrics = async () => {
    if (!userCompanyId) return;

    try {
      console.log('📊 Carregando métricas da empresa:', userCompanyId);

      // Buscar conversas da empresa
      const { data: conversas, error: convError } = await supabase
        .from('conversas')
        .select('id, status, created_at')
        .eq('company_id', userCompanyId);

      if (convError) throw convError;

      // Buscar conexões WhatsApp da empresa
      const { data: whatsappConnections, error: whatsappError } = await supabase
        .from('whatsapp_connections')
        .select('id, status')
        .eq('company_id', userCompanyId);

      if (whatsappError) throw whatsappError;

      // Calcular métricas
      const totalConversas = conversas?.length || 0;
      const conversasAtivas = conversas?.filter(c => c.status !== 'resolved').length || 0;

      // Mensagens de hoje (aproximado - conversas criadas hoje)
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const mensagensHoje = conversas?.filter(c => {
        const createdDate = new Date(c.created_at);
        createdDate.setHours(0, 0, 0, 0);
        return createdDate.getTime() === hoje.getTime();
      }).length || 0;

      const whatsappConnectionsCount = whatsappConnections?.length || 0;
      const whatsappConnectedCount = whatsappConnections?.filter(c => c.status === 'connected').length || 0;

      setCompanyMetrics({
        totalConversas,
        conversasAtivas,
        mensagensHoje,
        whatsappConnections: whatsappConnectionsCount,
        whatsappConnected: whatsappConnectedCount,
      });

      console.log('✅ Métricas carregadas:', {
        totalConversas,
        conversasAtivas,
        mensagensHoje,
        whatsappConnections: whatsappConnectionsCount,
        whatsappConnected: whatsappConnectedCount,
      });
    } catch (error) {
      console.error('❌ Erro ao carregar métricas:', error);
    }
  };

  // Carregar e sincronizar lembretes em tempo real
  useEffect(() => {
    if (!leadVinculado?.id) {
      setReminders([]);
      return;
    }

    loadReminders();

    // Subscrever para atualizações em tempo real de lembretes
    const lembretesChannel = supabase
      .channel('lembretes_conversas_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lembretes',
        },
        () => {
          loadReminders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lembretesChannel);
    };
  }, [leadVinculado?.id]);

  // 🔑 CRÍTICO: Carregar company_id PRIMEIRO antes de qualquer outra coisa
  useEffect(() => {
    console.log('🚀 Componente Conversas montado');
    
    const carregarDadosIniciais = async () => {
      try {
        // 1. Buscar sessão e company_id PRIMEIRO
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('❌ Usuário não autenticado');
          return;
        }
        
        // 2. Buscar company_id (funciona para conta principal e subcontas)
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.company_id) {
          console.error('❌ Erro: Usuário sem empresa associada');
          toast.error('Erro: Usuário sem empresa associada');
          return;
        }

        // 3. Definir company_id IMEDIATAMENTE
        console.log('🏢 Company ID carregado:', userRole.company_id);
        setUserCompanyId(userRole.company_id);
        userCompanyIdRef.current = userRole.company_id; // ⚡ ATUALIZAR REF IMEDIATAMENTE
        
        // 4. Buscar perfil do usuário
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile) {
          setUserName(profile.full_name || profile.email);
          console.log('👤 Usuário logado:', profile.full_name || profile.email);
        }
        
      } catch (error) {
        console.error('❌ Erro ao carregar dados iniciais:', error);
      }
    };
    
    carregarDadosIniciais();
    
    // 🔊 Inicializar som de notificação
    if (!notificationSound.current) {
      notificationSound.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTeI0fPTgjMGHm7A7+OZRQ0PVKzm7qxdFwtNpuPwtWEcBjiS1/PMeSsFJHjH79+QQQoVXrPp66lXFApGnt/yv24hBTeI0PLUgzMGH27A7+OZRg0PVKzl7qxdFwtNpuPwtWEcBjiS1/PMeSwFJHfH8N+QQAoVXrPp66hWFApHn+DyvmwhBTeI0fPTgjMGHm7A7+OZRg0PVKzl7qxdFwtNpuPxtWEcBjiS1/PMeSwFJHfH8d+PQAoVXrPq66hWFApHn+Dyv24hBTiI0fPTgjQGHm/A7eSaRg0PVKzl7atdFwtMpuPxtWMcBjiS1/LMeSwFJHfH8N+PQAoUXrTp66lWFApHn+DyvmwhBTeJ0fPTgzMGHm/B7+SZRg0PVKzl7axdFwtMpuPxtGMcBjiT2PPNeSsFI3fH79+QQAoUXrTp66hWFApHnt/yv24iBTiJ0fPUgjQGHm/B7+SZRg0PVKzl7axeFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQtMpuPxtWMcBjiT2PPNeSsFI3fH79+RQAoUXrPp66hXFApHnt/yv24iBTiJ0PPUgjQGHm/A7+SZRg0PVKzl7axfFQ==');
      notificationSound.current.volume = 0.5; // Volume de 50%
      console.log('🔊 Som de notificação inicializado');
    }
    
    // Não carregar do localStorage - apenas Supabase
    loadQuickMessages();
    loadQuickCategories();
    loadReminders();
    loadMeetings();
    loadAiMode();
  }, []); // ⚡ Executar apenas uma vez no mount

  // 📡 CRÍTICO: Configurar canal realtime APENAS quando userCompanyId estiver disponível
  useEffect(() => {
    if (!userCompanyId) {
      console.log('⏳ [REALTIME] Aguardando userCompanyId...');
      return;
    }

    console.log('📡 [REALTIME] userCompanyId disponível, configurando canal:', userCompanyId);
    
    // MELHORIA: Função auxiliar para validar dados recebidos via realtime
    const validateRealtimeData = (data: any): boolean => {
      try {
        if (!data || typeof data !== 'object') {
          console.warn('⚠️ [REALTIME] Dados inválidos: não é um objeto', data);
          return false;
        }
        if (!data.id || (!data.numero && !data.telefone_formatado)) {
          console.warn('⚠️ [REALTIME] Dados inválidos: faltam campos obrigatórios');
          return false;
        }
        const isGroup = Boolean((data as any)?.is_group) || /@g\.us$/.test(String(data.numero || ''));
        if (!isGroup) {
          const numeroPadrao = data.telefone_formatado || data.numero || '';
          const numeroE164 = normalizePhoneForWA(numeroPadrao);
          const somenteDigitos = numeroE164.replace(/[^0-9]/g, '');
          if (somenteDigitos.length < 12 || somenteDigitos.length > 13) {
            console.warn('⚠️ [REALTIME] Número de telefone inválido');
            return false;
          }
        }
        if (data.mensagem && (data.mensagem.includes('{{') || data.mensagem.includes('$json') || data.mensagem === '[object Object]')) {
          console.warn('⚠️ [REALTIME] Mensagem contém variáveis não substituídas');
          return false;
        }
        return true;
      } catch (error) {
        console.error('❌ [REALTIME] Erro ao validar dados:', error);
        return false;
      }
    };

    const debouncedUpdate = (updateFn: () => void | Promise<void>, delay: number = 300) => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(async () => {
        const now = Date.now();
        if (now - lastUpdateTimeRef.current < 100) {
          console.log('⏱️ [REALTIME] Atualização ignorada (muito frequente)');
          return;
        }
        lastUpdateTimeRef.current = now;
        await updateFn();
      }, delay);
    };

    const reconnectRealtime = async (attempt: number = 1, maxAttempts: number = 5) => {
      if (isReconnectingRef.current) return;
      isReconnectingRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (attempt > maxAttempts) {
        console.error('❌ [REALTIME] Máximo de tentativas de reconexão atingido');
        setRealtimeConnectionStatus('error');
        toast.error('Erro ao conectar com servidor em tempo real');
        isReconnectingRef.current = false;
        return;
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      console.log(`🔄 [REALTIME] Tentando reconectar (tentativa ${attempt}/${maxAttempts}) em ${delay}ms...`);
      setRealtimeConnectionStatus('connecting');
      setRealtimeReconnectAttempts(attempt);
      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          if (realtimeChannelRef.current) await supabase.removeChannel(realtimeChannelRef.current);
          await setupRealtimeChannel();
          console.log(`✅ [REALTIME] Reconectado com sucesso na tentativa ${attempt}`);
          setRealtimeConnectionStatus('connected');
          setRealtimeReconnectAttempts(0);
          toast.success('Conexão em tempo real restaurada');
          isReconnectingRef.current = false;
        } catch (error) {
          console.error(`❌ [REALTIME] Erro ao reconectar (tentativa ${attempt}):`, error);
          isReconnectingRef.current = false;
          reconnectRealtime(attempt + 1, maxAttempts);
        }
      }, delay);
    };

    const setupRealtimeChannel = async () => {
      if (!userCompanyIdRef.current) {
        console.error('❌ [REALTIME] ERRO: setupRealtimeChannel chamado sem userCompanyId!');
        return null;
      }
      console.log('🔌 [REALTIME] Configurando canal com company_id:', userCompanyIdRef.current);
      if (realtimeChannelRef.current) {
        try { await supabase.removeChannel(realtimeChannelRef.current); } catch {}
        realtimeChannelRef.current = null;
      }
      // ✅ CRITICAL: Escutar TODOS os eventos (INSERT e UPDATE) para sincronização total
      const channel = supabase.channel('conversas_realtime_full')
        .on('postgres_changes', {
          event: '*', // Escutar INSERT, UPDATE e DELETE
          schema: 'public', 
          table: 'conversas',
          filter: `company_id=eq.${userCompanyIdRef.current}`
        }, async (payload) => {
          try {
            const eventType = payload.eventType;
            const recordId = (payload.new as any)?.id || (payload.old as any)?.id;
            console.log(`📩 [REALTIME] Evento detectado: ${eventType}`, { 
              id: recordId,
              timestamp: new Date().toISOString() 
            });
            
            // Processar INSERT e UPDATE
            if (eventType === 'INSERT' || eventType === 'UPDATE') {
              if (!payload.new?.id) return;
              
              const { data: novaConversa, error } = await supabase.from('conversas')
                .select('id, numero, mensagem, nome_contato, status, tipo_mensagem, telefone_formatado, is_group, company_id, created_at, origem, fromme, midia_url, arquivo_nome')
                .eq('id', payload.new.id)
                .single();
              
              if (error) {
                console.error('❌ [REALTIME] Erro ao buscar conversa:', error);
                return;
              }
              
              if (!novaConversa || !validateRealtimeData(novaConversa)) {
                console.warn('⚠️ [REALTIME] Dados inválidos ignorados');
                return;
              }
              
              if (novaConversa.company_id && novaConversa.company_id !== userCompanyIdRef.current) {
                console.warn('⚠️ [REALTIME] Conversa de outra empresa ignorada');
                return;
              }
              
              // 🚫 CORREÇÃO: Ignorar mensagens enviadas por mim (já foram adicionadas localmente)
              if (novaConversa.fromme === true || novaConversa.status === 'Enviada') {
                console.log('⏭️ [REALTIME] Mensagem própria ignorada (já adicionada localmente)');
                return;
              }
              
              debouncedUpdate(async () => {
                const isGroup = Boolean((novaConversa as any)?.is_group) || /@g\.us$/.test(String(novaConversa.numero || ''));
                const telefoneNormalizado = isGroup 
                  ? String(novaConversa.numero) 
                  : (novaConversa.telefone_formatado || normalizePhoneForWA(novaConversa.numero));
                
                const { data: leadVinculadoRealtime } = await supabase.from('leads')
                  .select('name')
                  .or(`phone.eq.${telefoneNormalizado},telefone.eq.${telefoneNormalizado}`)
                  .maybeSingle();
                  
                const nomeValido = leadVinculadoRealtime?.name || (novaConversa.nome_contato && novaConversa.nome_contato.trim() !== '' && novaConversa.nome_contato !== novaConversa.numero ? novaConversa.nome_contato : novaConversa.numero);
                let profilePic: string | undefined;
                try { profilePic = await getProfilePictureWithFallback(novaConversa.numero, userCompanyIdRef.current || '', nomeValido || String(novaConversa.numero)); } catch {}
                const numeroLimpo = String(novaConversa.numero || '').replace(/\D/g, '');
                const isRealGroup = Boolean((novaConversa as any)?.is_group) || (numeroLimpo.length >= 17 && /@g\.us$/.test(String(novaConversa.numero || '')));
                const novaConvFormatted: Conversation = {
                  id: telefoneNormalizado, contactName: nomeValido,
                  avatarUrl: profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeValido)}&background=10b981&color=fff`,
                  channel: 'whatsapp' as const, status: 'waiting' as const, isGroup: isRealGroup,
                  messages: [{
                    id: novaConversa.id, content: novaConversa.mensagem,
                    sender: (novaConversa.fromme === true || novaConversa.status === 'Enviada') ? 'user' : 'contact',
                    timestamp: new Date(novaConversa.created_at), delivered: true,
                    type: (novaConversa.tipo_mensagem === 'audio' ? 'audio' : novaConversa.tipo_mensagem === 'image' ? 'image' : novaConversa.tipo_mensagem === 'video' ? 'video' : novaConversa.tipo_mensagem === 'pdf' || (novaConversa.tipo_mensagem === 'document' && novaConversa.mensagem?.includes('[Documento:')) ? 'pdf' : novaConversa.tipo_mensagem === 'document' ? 'document' : 'text') as Message["type"],
                    mediaUrl: novaConversa.midia_url, fileName: novaConversa.arquivo_nome
                  }],
                  lastMessage: novaConversa.mensagem,
                  unread: (novaConversa.fromme === true || novaConversa.status === 'Enviada') ? 0 : 1,
                  tags: [], phoneNumber: telefoneNormalizado
                };
                setConversations(prev => {
                  const exists = prev.find(c => c.id === telefoneNormalizado);
                  if (exists) {
                    // Verificar se mensagem já existe antes de adicionar
                    const messageExists = exists.messages.some(m => m.id === novaConvFormatted.messages[0].id);
                    if (messageExists) {
                      console.log('⏭️ [REALTIME] Mensagem já existe, pulando duplicação');
                      return prev;
                    }
                    return prev.map(c => c.id === telefoneNormalizado ? { ...c, messages: [...c.messages, novaConvFormatted.messages[0]], lastMessage: novaConvFormatted.lastMessage, unread: c.unread + novaConvFormatted.unread } : c);
                  }
                  return [novaConvFormatted, ...prev];
                });
                if (novaConvFormatted.unread > 0) {
                  try { notificationSound.current?.play().catch(() => {}); } catch {}
                  toast.success(`Nova mensagem de ${nomeValido}`, { duration: 4000 });
                }
              });
            }
          } catch (err) { 
            console.error('❌ [REALTIME] Erro ao processar:', err); 
          }
      }).subscribe((status) => {
        console.log('📡 [REALTIME] Status:', status);
        if (status === 'SUBSCRIBED') { console.log('✅ [REALTIME] Conectado!'); setRealtimeConnectionStatus('connected'); }
        else if (status === 'CHANNEL_ERROR') { console.error('❌ [REALTIME] Erro no canal'); setRealtimeConnectionStatus('error'); if (!isReconnectingRef.current) reconnectRealtime(); }
        else if (status === 'TIMED_OUT' || status === 'CLOSED') { console.warn('⚠️ [REALTIME] Desconectado'); setRealtimeConnectionStatus('disconnected'); if (!isReconnectingRef.current) reconnectRealtime(); }
      });
      realtimeChannelRef.current = channel;
      return channel;
    };

    setupRealtimeChannel().catch((error) => {
      console.error('❌ [REALTIME] Erro ao configurar canal inicial:', error);
      setRealtimeConnectionStatus('error');
      toast.error('Erro ao conectar com servidor em tempo real');
      setTimeout(() => reconnectRealtime(), 5000);
    });

    return () => {
      console.log('🔌 [REALTIME] Desconectando canal');
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingTimeoutRef.current) clearTimeout(pollingTimeoutRef.current);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      if (realtimeChannelRef.current) { supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; }
      setRealtimeConnectionStatus('disconnected');
    };
  }, [userCompanyId]);

  // Verificar se veio de um lead (via state do navigate)
  useEffect(() => {
    const handleLeadRedirect = async () => {
      const state = location.state as { leadId?: string } | null;
      
      if (state?.leadId) {
        console.log('🔍 Lead ID recebido via state:', state.leadId);
        
        try {
          // Buscar o lead no Supabase
          const { data: leadData, error } = await supabase
            .from('leads')
            .select('*')
            .eq('id', state.leadId)
            .maybeSingle();
          
          if (error || !leadData) {
            console.error('❌ Erro ao buscar lead:', error);
            toast.error('Lead não encontrado');
            return;
          }
          
          console.log('✅ Lead encontrado:', leadData);
          
          // Pegar o telefone do lead (pode estar em 'phone' ou 'telefone')
          const leadPhone = leadData.phone || leadData.telefone;
          
          if (!leadPhone) {
            toast.error('Lead não possui telefone cadastrado');
            return;
          }
          
          // Formatar o telefone removendo caracteres especiais
          const phoneFormatted = leadPhone.replace(/\D/g, '');
          
          // Buscar conversa existente no Supabase (ISOLADO POR EMPRESA)
          const { data: conversasData } = await supabase
            .from('conversas')
            .select('*')
            .eq('company_id', userCompanyId)
            .eq('telefone_formatado', phoneFormatted)
            .order('created_at', { ascending: false });
          
          if (conversasData && conversasData.length > 0) {
            // Encontrou conversas, carregar todas e selecionar a primeira
            console.log(`📱 ${conversasData.length} conversa(s) encontrada(s) para o lead`);
            
            // Agrupar mensagens por número
            const conversationsMap = new Map<string, Conversation>();
            
            for (const msg of conversasData) {
              const convId = msg.telefone_formatado || msg.numero;
              
              if (!conversationsMap.has(convId)) {
                const numeroLimpo = String(msg.numero || '').replace(/\D/g, '');
                const isRealGroup = Boolean((msg as any)?.is_group) || (numeroLimpo.length >= 17 && /@g\.us$/.test(String(msg.numero || '')));
                
                conversationsMap.set(convId, {
                  id: convId,
                  contactName: leadData.name || msg.nome_contato || 'Desconhecido', // PRIORIZAR NOME DO LEAD
                  channel: msg.origem?.toLowerCase() === 'whatsapp' ? 'whatsapp' : 
                          msg.origem?.toLowerCase() === 'instagram' ? 'instagram' : 'facebook',
                  status: msg.status === 'Enviada' ? 'answered' : 'waiting',
                  lastMessage: msg.mensagem || '',
                  unread: 0,
                  isGroup: isRealGroup,
                  messages: [],
                  tags: leadData.tags || [],
                  funnelStage: leadData.stage,
                  responsavel: leadData.responsavel_id,
                  produto: leadData.servico,
                  valor: leadData.value ? `R$ ${Number(leadData.value).toLocaleString('pt-BR')}` : undefined,
                  phoneNumber: convId,
                });
              }
              
              const conv = conversationsMap.get(convId)!;
              
              // Adicionar mensagem
              const message: Message = {
                id: msg.id,
                content: msg.mensagem || '',
                type: msg.tipo_mensagem === 'image' ? 'image' :
                      msg.tipo_mensagem === 'audio' ? 'audio' :
                      msg.tipo_mensagem === 'video' ? 'video' :
                      msg.tipo_mensagem === 'document' ? 'pdf' : 'text',
                // CORREÇÃO: fromme = true OU status = 'Enviada' = mensagem do usuário
                sender: (msg.fromme === true || msg.status === 'Enviada') ? 'user' : 'contact',
                timestamp: new Date(msg.created_at),
                delivered: msg.status === 'Enviada',
                read: msg.status === 'Lida',
                mediaUrl: msg.midia_url,
                fileName: msg.arquivo_nome,
              };
              
              conv.messages.push(message);
              
              // Atualizar última mensagem
              if (new Date(msg.created_at) > new Date(conv.lastMessage)) {
                conv.lastMessage = msg.mensagem || '';
              }
            }
            
            // Converter para array e ordenar mensagens
            const loadedConversations = Array.from(conversationsMap.values()).map(conv => ({
              ...conv,
              messages: conv.messages.sort((a, b) => {
                // ⚡ CORREÇÃO: Garantir que timestamp seja Date antes de chamar getTime()
                const aTimestamp = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
                const bTimestamp = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
                return aTimestamp.getTime() - bTimestamp.getTime();
              })
            }));
            
            // Adicionar ou atualizar no estado
            setConversations(prev => {
              const updated = [...prev];
              for (const newConv of loadedConversations) {
                const existingIndex = updated.findIndex(c => c.id === newConv.id);
                if (existingIndex >= 0) {
                  updated[existingIndex] = newConv;
                } else {
                  updated.unshift(newConv);
                }
              }
              return updated;
            });
            
            // Selecionar a primeira conversa
            const conversationToSelect = loadedConversations[0];
            setSelectedConv(conversationToSelect);
            setLeadVinculado(leadData);
            
            toast.success(`Conversa de ${leadData.name} aberta`);
          } else {
            // Não encontrou conversa, criar uma nova
            console.log('📝 Nenhuma conversa encontrada, criando nova...');
            
            const newConv: Conversation = {
              id: phoneFormatted,
              contactName: leadData.name,
              channel: "whatsapp",
              status: "waiting",
              lastMessage: "Nova conversa",
              unread: 0,
              messages: [],
              tags: leadData.tags || [],
              funnelStage: leadData.stage,
              responsavel: leadData.responsavel_id,
              produto: leadData.servico,
              valor: leadData.value ? `R$ ${Number(leadData.value).toLocaleString('pt-BR')}` : undefined,
              phoneNumber: phoneFormatted,
            };
            
            setConversations(prev => [newConv, ...prev]);
            setSelectedConv(newConv);
            setLeadVinculado(leadData);
            
            toast.success(`Nova conversa com ${leadData.name} iniciada`);
          }
          
          // Limpar o state após processar
          window.history.replaceState({}, '', '/conversas');
        } catch (error) {
          console.error('❌ Erro ao processar redirecionamento do lead:', error);
          toast.error('Erro ao abrir conversa do lead');
        }
      }
    };
    
    // Executar após carregar conversas
    setTimeout(() => {
      handleLeadRedirect();
    }, 1000);
    
    // Verificar se veio de um lead (query param - manter compatibilidade)
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

    // MELHORIA: Função auxiliar para validar dados recebidos via realtime
    const validateRealtimeData = (data: any): boolean => {
      try {
        // Validar estrutura básica
        if (!data || typeof data !== 'object') {
          console.warn('⚠️ [REALTIME] Dados inválidos: não é um objeto', data);
          return false;
        }

        // Validar campos obrigatórios mínimos (aceitar numero OU telefone_formatado)
        if (!data.id || (!data.numero && !data.telefone_formatado)) {
          console.warn('⚠️ [REALTIME] Dados inválidos: faltam campos obrigatórios', {
            id: data.id,
            numero: data.numero,
            telefone_formatado: data.telefone_formatado
          });
          return false;
        }

        // Validar telefone apenas para CONTATOS (não aplicar a grupos)
        const isGroup = Boolean((data as any)?.is_group) || /@g\.us$/.test(String(data.numero || ''));
        if (!isGroup) {
          const numeroPadrao = data.telefone_formatado || data.numero || '';
          const numeroE164 = normalizePhoneForWA(numeroPadrao);
          const somenteDigitos = numeroE164.replace(/[^0-9]/g, '');
          if (somenteDigitos.length < 12 || somenteDigitos.length > 13) {
          console.warn('⚠️ [REALTIME] Número de telefone inválido:', {
            numero: data.numero,
            telefone_formatado: data.telefone_formatado,
              numeroE164,
              tamanho: somenteDigitos.length
          });
          return false;
          }
        }

        // Validar mensagem não contém variáveis N8n não substituídas
        if (data.mensagem && (
          data.mensagem.includes('{{') || 
          data.mensagem.includes('$json') ||
          data.mensagem === '[object Object]'
        )) {
          console.warn('⚠️ [REALTIME] Mensagem contém variáveis não substituídas:', data.mensagem);
          return false;
        }

        // company_id pode não vir de integrações externas; não bloquear validação

        return true;
      } catch (error) {
        console.error('❌ [REALTIME] Erro ao validar dados:', error);
        return false;
      }
    };

    // MELHORIA: Função de debounce para atualizações (evitar spam)
    // Aceita callbacks async para permitir uso de await dentro
    const debouncedUpdate = (updateFn: () => void | Promise<void>, delay: number = 300) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      debounceTimeoutRef.current = setTimeout(async () => {
        const now = Date.now();
        // Evitar atualizações muito frequentes (mínimo 100ms entre atualizações)
        if (now - lastUpdateTimeRef.current < 100) {
          console.log('⏱️ [REALTIME] Atualização ignorada (muito frequente)');
          return;
        }
        lastUpdateTimeRef.current = now;
        await updateFn();
      }, delay);
    };

    // MELHORIA: Função para reconectar automaticamente
    const reconnectRealtime = async (attempt: number = 1, maxAttempts: number = 5) => {
      if (isReconnectingRef.current) {
        return;
      }
      isReconnectingRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
      if (attempt > maxAttempts) {
        console.error('❌ [REALTIME] Máximo de tentativas de reconexão atingido');
        setRealtimeConnectionStatus('error');
        toast.error('Erro ao conectar com servidor em tempo real');
        isReconnectingRef.current = false;
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Backoff exponencial, max 30s
      
      console.log(`🔄 [REALTIME] Tentando reconectar (tentativa ${attempt}/${maxAttempts}) em ${delay}ms...`);
      setRealtimeConnectionStatus('connecting');
      setRealtimeReconnectAttempts(attempt);

      reconnectTimeoutRef.current = setTimeout(async () => {
        try {
          // Remover canal antigo se existir
          if (realtimeChannelRef.current) {
            await supabase.removeChannel(realtimeChannelRef.current);
          }

          // Criar novo canal
          await setupRealtimeChannel();
          
          console.log(`✅ [REALTIME] Reconectado com sucesso na tentativa ${attempt}`);
          setRealtimeConnectionStatus('connected');
          setRealtimeReconnectAttempts(0);
          toast.success('Conexão em tempo real restaurada');
          isReconnectingRef.current = false;
        } catch (error) {
          console.error(`❌ [REALTIME] Erro ao reconectar (tentativa ${attempt}):`, error);
          isReconnectingRef.current = false;
          reconnectRealtime(attempt + 1, maxAttempts);
        }
      }, delay);
    };

    // MELHORIA: Função para configurar canal realtime
    const setupRealtimeChannel = async () => {
      // ⚡ CRÍTICO: Se userCompanyId não estiver disponível, o useEffect não deve ter sido executado
      if (!userCompanyIdRef.current) {
        console.error('❌ [REALTIME] ERRO: setupRealtimeChannel chamado sem userCompanyId!');
        return null;
      }

      console.log('🔌 [REALTIME] Configurando canal com company_id:', userCompanyIdRef.current);
      console.log('🔌 [REALTIME] Status anterior:', realtimeConnectionStatus);

      // Evitar múltiplas assinaturas: sempre remover canal anterior antes de criar
      if (realtimeChannelRef.current) {
        try {
          await supabase.removeChannel(realtimeChannelRef.current);
        } catch {}
        realtimeChannelRef.current = null;
      }
      // Subscrever para atualizações em tempo real (INSERT e UPDATE)
      const channel = supabase
        .channel('conversas_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversas',
          filter: `company_id=eq.${userCompanyIdRef.current}` // ⚡ FILTRO OBRIGATÓRIO
        },
        async (payload) => {
          try {
            console.log('📩 [REALTIME] Nova mensagem recebida (INSERT):', {
              id: payload.new?.id,
              timestamp: new Date().toISOString()
            });
            
            // ⚡ CORREÇÃO CRÍTICA: Não usar payload.new diretamente (pode ter mídia grande = erro 413)
            // Buscar apenas os campos necessários do banco
            if (!payload.new?.id) {
              console.warn('⚠️ [REALTIME] ID não encontrado no payload');
              return;
            }

            // Buscar a mensagem do banco SEM campos de mídia muito grande (base64)
            const { data: novaConversa, error: fetchError } = await supabase
              .from('conversas')
              .select('id, numero, mensagem, nome_contato, status, tipo_mensagem, telefone_formatado, is_group, company_id, created_at, origem, fromme, midia_url, arquivo_nome, replied_to_message')
              .eq('id', payload.new.id)
              .single();

            if (fetchError || !novaConversa) {
              console.error('❌ [REALTIME] Erro ao buscar mensagem do banco:', fetchError);
              return;
            }

            console.log('📩 [REALTIME] Mensagem carregada do banco:', {
              id: novaConversa.id,
              numero: novaConversa.numero,
              mensagem: novaConversa.mensagem?.substring(0, 50),
              status: novaConversa.status,
              company_id: novaConversa.company_id
            });
            
            // MELHORIA: Validar dados recebidos antes de processar
            if (!validateRealtimeData(novaConversa)) {
              console.warn('⚠️ [REALTIME] Dados inválidos ignorados');
              return;
            }

              // 🔒 SEGURANÇA: Filtrar por empresa quando informado; permitir sem company_id (integração externa)
              if (novaConversa.company_id && novaConversa.company_id !== userCompanyIdRef.current) {
                console.log('🚫 [REALTIME] Mensagem ignorada - empresa diferente:', {
                  msgCompanyId: novaConversa.company_id,
                  userCompanyId: userCompanyIdRef.current
                });
                return;
              }

              // MELHORIA: Usar debounce para evitar spam de atualizações
              debouncedUpdate(async () => {
              // Normalizar destino (E.164 para contatos; JID completo para grupos)
              const isGroup = Boolean((novaConversa as any)?.is_group) || /@g\.us$/.test(String(novaConversa.numero || ''));
              const telefoneNormalizado = isGroup
                ? String(novaConversa.numero)
                : (novaConversa.telefone_formatado || normalizePhoneForWA(novaConversa.numero));
                
                console.log('📩 Processando nova mensagem realtime:', {
                  numeroOriginal: novaConversa.numero,
                  telefoneNormalizado,
                  mensagem: novaConversa.mensagem,
                  nomeContato: novaConversa.nome_contato,
                  status: novaConversa.status,
                  tipo: novaConversa.tipo_mensagem
                });
                
                // Buscar se existe lead vinculado para usar o nome correto
                const telefoneFormatado = telefoneNormalizado;
                const { data: leadVinculadoRealtime } = await supabase
                  .from('leads')
                  .select('name')
                  .or(`phone.eq.${telefoneFormatado},telefone.eq.${telefoneFormatado}`)
                  .maybeSingle();
                
                // PRIORIZAR NOME DO LEAD, depois nome da mensagem, depois número
                const nomeValido = leadVinculadoRealtime?.name || 
                                  (novaConversa.nome_contato && 
                                   novaConversa.nome_contato.trim() !== '' && 
                                   novaConversa.nome_contato !== novaConversa.numero
                                    ? novaConversa.nome_contato 
                                    : novaConversa.numero);
                
                // Buscar foto de perfil da nova mensagem
                let profilePic: string | undefined;
                try {
                  profilePic = await getProfilePictureWithFallback(
                    novaConversa.numero,
                    userCompanyIdRef.current || '',
                    nomeValido || String(novaConversa.numero)
                  );
                } catch (error) {
                  console.error('❌ Erro ao buscar foto:', error);
                }
                
                // Converter para formato do componente
                const numeroLimpoRealtime = String(novaConversa.numero || '').replace(/\D/g, '');
                const isRealGroupRealtime = Boolean((novaConversa as any)?.is_group) || (numeroLimpoRealtime.length >= 17 && /@g\.us$/.test(String(novaConversa.numero || '')));
                
                console.log('🔍 [DEBUG] Classificando conversa:', {
                  numero: novaConversa.numero,
                  numeroLimpo: numeroLimpoRealtime,
                  tamanho: numeroLimpoRealtime.length,
                  is_group_db: (novaConversa as any)?.is_group,
                  isRealGroup: isRealGroupRealtime,
                  nome: nomeValido
                });
                
                const novaConvFormatted: Conversation = {
                  id: telefoneNormalizado,
                  contactName: nomeValido,
                  avatarUrl: profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeValido)}&background=10b981&color=fff`,
                  channel: 'whatsapp' as const,
                  status: 'waiting' as const,
                  isGroup: isRealGroupRealtime,
                  messages: [{
                    id: novaConversa.id,
                    content: novaConversa.mensagem,
                    // CORREÇÃO: fromme = true OU status = 'Enviada' = mensagem do usuário
                    sender: (novaConversa.fromme === true || novaConversa.status === 'Enviada') ? 'user' : 'contact',
                    timestamp: new Date(novaConversa.created_at),
                    delivered: true,
                    type: (novaConversa.tipo_mensagem === 'audio' ? 'audio' : 
                          novaConversa.tipo_mensagem === 'image' ? 'image' :
                          novaConversa.tipo_mensagem === 'video' ? 'video' :
                          novaConversa.tipo_mensagem === 'pdf' || (novaConversa.tipo_mensagem === 'document' && novaConversa.mensagem?.includes('[Documento:')) ? 'pdf' :
                          novaConversa.tipo_mensagem === 'document' ? 'document' : 'text') as Message["type"],
                    mediaUrl: novaConversa.midia_url,
                    fileName: novaConversa.arquivo_nome || (novaConversa.mensagem?.match(/\[Documento: (.+)\]/)?.[1]),
                    mimeType: novaConversa.midia_url ? (novaConversa.midia_url.match(/data:([^;]+)/)?.[1] || undefined) : undefined,
                    replyTo: undefined,
                  }],
                  lastMessage: novaConversa.mensagem,
                  // CORREÇÃO: Só marcar como não lida se for mensagem do contato
                  unread: (novaConversa.fromme === true || novaConversa.status === 'Enviada') ? 0 : 1,
                  tags: [],
                  valor: null,
                  anotacoes: null,
                };
                
                // Atualizar ou adicionar conversa na lista
                let conversaAtualizada: Conversation | null = null;
                const isOpen = !!(selectedConvRef.current && (
                  selectedConvRef.current.id === telefoneNormalizado ||
                  selectedConvRef.current.phoneNumber === telefoneNormalizado
                ));
                
                setConversations(prev => {
                  // Buscar conversa existente usando telefone normalizado
                  const existingIndex = prev.findIndex(c => 
                    c.id === telefoneNormalizado || 
                    c.phoneNumber === telefoneNormalizado
                  );
                  
                  if (existingIndex >= 0) {
                    // Conversa já existe - adicionar mensagem ao histórico
                    const updated = [...prev];
                    const conversaExistente = updated[existingIndex];
                    
                    // Verificar se a mensagem já não existe (evitar duplicatas)
                    // CORREÇÃO: Verificar também por conteúdo e timestamp para evitar duplicatas de mensagens enviadas localmente
                    const novaMensagem = novaConvFormatted.messages[0];
                    const mensagemJaExiste = conversaExistente.messages.some(m => {
                      // Verificar por ID (mensagens do banco)
                      if (m.id === novaMensagem.id) return true;
                      
                      // Verificar por conteúdo + timestamp próximo (mensagens enviadas localmente)
                      // Se for mensagem do usuário com mesmo conteúdo nos últimos 5 segundos, é duplicata
                      if (m.sender === 'user' && novaMensagem.sender === 'user' && m.content === novaMensagem.content) {
                        const diffMs = Math.abs(new Date(m.timestamp).getTime() - new Date(novaMensagem.timestamp).getTime());
                        if (diffMs < 5000) return true; // 5 segundos de margem
                      }
                      
                      return false;
                    });
                    
                    if (!mensagemJaExiste) {
                      // Resolver replyTo por conteúdo citado (melhor esforço)
                      if (novaConversa.replied_to_message) {
                        const target = conversaExistente.messages.find(msg => msg.content === novaConversa.replied_to_message);
                        if (target) {
                          novaConvFormatted.messages[0] = { ...novaConvFormatted.messages[0], replyTo: target.id };
                        }
                      }
                      // CORREÇÃO: Se a conversa existente tem apenas o número como nome 
                      // e a nova mensagem traz um nome válido, atualizar o nome
                      const nomeExistenteEhNumero = /^\d+$/.test(conversaExistente.contactName);
                      const novoNomeValido = novaConvFormatted.contactName && 
                                            novaConvFormatted.contactName.trim() !== '' && 
                                            !/^\d+$/.test(novaConvFormatted.contactName);
                      
                      const nomeAtualizado = (nomeExistenteEhNumero && novoNomeValido) 
                        ? novaConvFormatted.contactName 
                        : conversaExistente.contactName;
                      
                      updated[existingIndex] = {
                        ...conversaExistente,
                        contactName: nomeAtualizado, // Usar nome atualizado
                        messages: [...conversaExistente.messages, ...novaConvFormatted.messages],
                        lastMessage: novaConvFormatted.lastMessage,
                        // CORREÇÃO: Só aumentar unread se for mensagem recebida do contato (não enviada pelo usuário)
                        unread: isOpen ? 0 : ((novaConversa.fromme === true || novaConversa.status === 'Enviada') ? conversaExistente.unread : conversaExistente.unread + 1),
                        avatarUrl: novoNomeValido ? novaConvFormatted.avatarUrl : conversaExistente.avatarUrl, // Atualizar avatar se nome foi atualizado
                      };
                      
                      // Salvar referência da conversa atualizada
                      conversaAtualizada = updated[existingIndex];
                      
                      // Mover para o topo
                      const [item] = updated.splice(existingIndex, 1);
                      updated.unshift(item);
                      
                      console.log('✅ Mensagem adicionada à conversa existente:', {
                        contato: nomeAtualizado,
                        totalMensagens: updated[0].messages.length,
                        nomeAtualizado: nomeExistenteEhNumero && novoNomeValido
                      });
                    } else {
                      console.log('⚠️ Mensagem duplicada ignorada');
                    }
                    
                    return updated;
                  } else {
                    // Nova conversa - adicionar no topo
                  console.log('➕ Nova conversa criada:', novaConvFormatted.contactName);
                  console.log('📞 [DEBUG] Telefone:', telefoneNormalizado);
                  console.log('💬 [DEBUG] Mensagem:', novaConversa.mensagem?.substring(0, 100));
                    conversaAtualizada = novaConvFormatted;
                    return [novaConvFormatted, ...prev];
                  }
                });
                
                // CRÍTICO: Se a conversa recebida é a que está aberta, atualizar selectedConv IMEDIATAMENTE
                if (isOpen && conversaAtualizada) {
                  console.log('🔄 Atualizando conversa selecionada com nova mensagem em tempo real');
                  setSelectedConv(conversaAtualizada);
                  // Marcar a mensagem recebida como lida imediatamente no Supabase
                  if (novaConversa.status === 'Recebida') {
                    try {
                      await supabase
                        .from('conversas')
                        .update({ status: 'Lida' })
                        .eq('id', novaConversa.id);
                      console.log('✅ Mensagem marcada como lida');
                    } catch (e: any) {
                      console.error('Erro ao marcar mensagem como lida (realtime):', e);
                    }
                  }
                }
                
                // 🔊 Notificar APENAS se for mensagem RECEBIDA do cliente (não quando o CRM envia) e a conversa não estiver aberta
                if (!isOpen && novaConversa.status === 'Recebida' && novaConversa.origem === 'WhatsApp') {
                  // Tocar som de notificação
                  try {
                    notificationSound.current?.play().catch(err => 
                      console.warn('⚠️ Não foi possível tocar som:', err)
                    );
                  } catch (error) {
                    console.warn('⚠️ Erro ao tocar som:', error);
                  }
                  
                  // Toast visual personalizado
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
              }, 300); // Delay de 300ms para debounce
          } catch (error) {
            console.error('❌ [REALTIME] Erro ao processar mensagem INSERT:', error);
            // Logar erro completo para debug
            console.error('📋 [REALTIME] Detalhes do erro:', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              payload: payload
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversas',
          filter: `company_id=eq.${userCompanyIdRef.current}` // ⚡ FILTRO OBRIGATÓRIO
        },
        async (payload) => {
          try {
            console.log('🔄 [REALTIME] Mensagem atualizada (UPDATE):', payload);
            
            // MELHORIA: Validar dados recebidos antes de processar
            if (!payload.new || !validateRealtimeData(payload.new)) {
              console.warn('⚠️ [REALTIME] Dados inválidos ignorados (UPDATE)');
              return;
            }
            
            // Processar atualizações de mensagens (ex: status de leitura, mensagens enviadas via WhatsApp)
            if (payload.eventType === 'UPDATE' && payload.new) {
              const conversaAtualizada = payload.new;

              // 🔒 SEGURANÇA: Filtrar por empresa quando informado; permitir sem company_id
              if (conversaAtualizada.company_id && conversaAtualizada.company_id !== userCompanyIdRef.current) {
                return;
              }

              // ATUALIZAÇÃO: Detectar mudança de status para sincronizar contador em tempo real
              const conversaAntiga = payload.old as any;
              if (conversaAntiga?.status !== conversaAtualizada?.status) {
                console.log('📊 Mudança de status detectada:', {
                  de: conversaAntiga?.status,
                  para: conversaAtualizada?.status,
                  telefone: conversaAtualizada?.telefone_formatado
                });

                // Atualizar status na conversa correspondente
                setConversations((prevConvs) =>
                  prevConvs.map((conv) => {
                    const convPhone = conv.phoneNumber?.replace(/[^0-9]/g, '');
                    const msgPhone = conversaAtualizada?.telefone_formatado?.replace(/[^0-9]/g, '');
                    
                    if (convPhone === msgPhone) {
                      const newStatus = conversaAtualizada?.status === 'Enviada' ? 'answered' : 
                                       conversaAtualizada?.status === 'Recebida' ? 'waiting' : 
                                       conversaAtualizada?.status === 'Resolvida' ? 'resolved' : conv.status;
                      
                      console.log('🔄 Atualizando status da conversa:', {
                        telefone: convPhone,
                        statusAntigo: conv.status,
                        statusNovo: newStatus
                      });
                      
                      return { ...conv, status: newStatus };
                    }
                    return conv;
                  })
                );
              }

              // MELHORIA: Usar debounce para evitar spam de atualizações
              debouncedUpdate(() => {
                // Normalizar destino (E.164 para contatos; JID completo para grupos)
                const isGroup = Boolean((conversaAtualizada as any)?.is_group) || /@g\.us$/.test(String(conversaAtualizada.numero || ''));
                const telefoneNormalizado = isGroup
                  ? String(conversaAtualizada.numero)
                  : (conversaAtualizada.telefone_formatado || normalizePhoneForWA(conversaAtualizada.numero));
                
                const isOpen = !!(selectedConvRef.current && (
                  selectedConvRef.current.id === telefoneNormalizado ||
                  selectedConvRef.current.phoneNumber === telefoneNormalizado
                ));
                
                // Atualizar mensagem na conversa se ela existir
                setConversations(prev => {
                  const existingIndex = prev.findIndex(c => 
                    c.id === telefoneNormalizado || 
                    c.phoneNumber === telefoneNormalizado
                  );
                  
                  if (existingIndex >= 0) {
                    const updated = [...prev];
                    const conversaExistente = updated[existingIndex];
                    
                    // Atualizar mensagem existente ou adicionar se for nova (enviada via WhatsApp)
                    const msgIndex = conversaExistente.messages.findIndex(m => m.id === conversaAtualizada.id);
                    
                    if (msgIndex >= 0) {
                      // Atualizar mensagem existente (ex: status de leitura)
                      updated[existingIndex] = {
                        ...conversaExistente,
                        messages: conversaExistente.messages.map((msg, idx) => 
                          idx === msgIndex ? {
                            ...msg,
                            read: conversaAtualizada.status === 'Lida',
                            delivered: true
                          } : msg
                        )
                      };
                    } else {
                      // Nova mensagem enviada via WhatsApp - adicionar à conversa
                      const novaMsg = {
                        id: conversaAtualizada.id,
                        content: conversaAtualizada.mensagem || '',
                        type: (conversaAtualizada.tipo_mensagem === 'audio' ? 'audio' :
                              conversaAtualizada.tipo_mensagem === 'image' ? 'image' :
                              conversaAtualizada.tipo_mensagem === 'video' ? 'video' :
                              conversaAtualizada.tipo_mensagem === 'pdf' || (conversaAtualizada.tipo_mensagem === 'document' && conversaAtualizada.mensagem?.includes('[Documento:')) ? 'pdf' :
                              conversaAtualizada.tipo_mensagem === 'document' ? 'document' : 'text') as Message["type"],
                        // CORREÇÃO: fromme = true OU status = 'Enviada' = mensagem do usuário
                        sender: (conversaAtualizada.fromme === true || conversaAtualizada.status === 'Enviada') ? 'user' as const : 'contact' as const,
                        timestamp: new Date(conversaAtualizada.created_at || conversaAtualizada.updated_at),
                        delivered: true,
                        read: conversaAtualizada.status === 'Lida',
                        mediaUrl: conversaAtualizada.midia_url || undefined,
                        fileName: conversaAtualizada.arquivo_nome || undefined,
                        mimeType: conversaAtualizada.midia_url ? (conversaAtualizada.midia_url.match(/data:([^;]+)/)?.[1] || undefined) : undefined,
                        replyTo: conversaAtualizada.replied_to_message || undefined,
                      };
                      
                      updated[existingIndex] = {
                        ...conversaExistente,
                        messages: [...conversaExistente.messages, novaMsg],
                        lastMessage: conversaAtualizada.mensagem || conversaExistente.lastMessage,
                        unread: isOpen ? 0 : conversaExistente.unread,
                      };
                      
                      // Se a conversa está aberta, atualizar selectedConv
                      if (isOpen) {
                        setSelectedConv(updated[existingIndex]);
                      }
                      
                      // Mover para o topo
                      const [item] = updated.splice(existingIndex, 1);
                      updated.unshift(item);
                    }
                    
                    return updated;
                  }
                  
                  return prev;
                });
              }, 300); // Delay de 300ms para debounce
            }
          } catch (error) {
            console.error('❌ [REALTIME] Erro ao processar mensagem UPDATE:', error);
            // Logar erro completo para debug
            console.error('📋 [REALTIME] Detalhes do erro:', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              payload: payload
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [REALTIME] Status do canal:', status);
        console.log('📡 [REALTIME] Timestamp:', new Date().toISOString());
        
        // MELHORIA: Detectar desconexão e reconectar automaticamente
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Canal conectado com sucesso');
          setRealtimeConnectionStatus('connected');
          setRealtimeReconnectAttempts(0);
          // Se havia timeout pendente, limpar; também liberar flag de reconexão
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
          isReconnectingRef.current = false;
          // Cancelar polling de fallback, se ativo
          if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
          }
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ [REALTIME] Erro no canal - tentando reconectar...');
          setRealtimeConnectionStatus('error');   
          if (!isReconnectingRef.current) reconnectRealtime();
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn('⚠️ [REALTIME] Canal desconectado - tentando reconectar...');
          setRealtimeConnectionStatus('disconnected');                                              
          if (!isReconnectingRef.current) reconnectRealtime();
        }
      });

      // Salvar referência do canal
      realtimeChannelRef.current = channel;
      
      return channel;
    };

    // Configurar canal realtime inicialmente
    setupRealtimeChannel().catch((error) => {
      console.error('❌ [REALTIME] Erro ao configurar canal inicial:', error);
      setRealtimeConnectionStatus('error');
      toast.error('Erro ao conectar com servidor em tempo real');
      
      // Tentar reconectar após 5 segundos
      setTimeout(() => {
        reconnectRealtime();
      }, 5000);
    });

    return () => {
      console.log('🔌 [REALTIME] Desconectando canal');
      
      // Limpar timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      
      // Remover canal
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      
      setRealtimeConnectionStatus('disconnected');
      
      // MELHORIA: Limpar polling de transcrição
      Object.keys(transcriptionPollingRefs.current).forEach(messageId => {
        const refs = transcriptionPollingRefs.current[messageId];
        if (refs) {
          if (refs.interval) clearInterval(refs.interval);
          if (refs.timeout) clearTimeout(refs.timeout);
          delete transcriptionPollingRefs.current[messageId];
        }
      });
    };
  }, [userCompanyId]); // ⚡ DEPENDÊNCIA CRÍTICA: Reconfigurar quando company_id mudar
  
  // 📡 Carregar conversas quando userCompanyId estiver disponível - INSTANTÂNEO
  useEffect(() => {
    if (!userCompanyId || initialLoadRef.current) return;
    
    initialLoadRef.current = true;
    
    // ⚡ INSTANTÂNEO: Carregar do cache primeiro (tempo 0)
    const loadFromCache = () => {
      try {
        const cachedData = sessionStorage.getItem(CONVERSATIONS_CACHE_KEY);
        const cacheTimestamp = sessionStorage.getItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);
        
        if (cachedData && cacheTimestamp) {
          const age = Date.now() - parseInt(cacheTimestamp, 10);
          if (age < CACHE_MAX_AGE) {
            const cachedConversations = JSON.parse(cachedData);
            
            // ⚡ CORREÇÃO: Converter strings de data de volta para objetos Date
            const restoredConversations = cachedConversations.map((conv: any) => ({
              ...conv,
              messages: (conv.messages || []).map((msg: any) => ({
                ...msg,
                timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
              }))
            }));
            
            console.log(`⚡ [CACHE] Carregando ${restoredConversations.length} conversas do cache (${age}ms atrás)`);
            setConversations(restoredConversations);
            return true; // Cache válido
          } else {
            console.log('⏰ [CACHE] Cache expirado, recarregando...');
            sessionStorage.removeItem(CONVERSATIONS_CACHE_KEY);
            sessionStorage.removeItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);
          }
        }
      } catch (error) {
        console.error('❌ [CACHE] Erro ao carregar cache:', error);
      }
      return false; // Cache inválido ou não existe
    };
    
    // Carregar do cache instantaneamente
    const hasCache = loadFromCache();
    
    // Carregar do Supabase em background (atualizar cache)
    console.log('🔄 [LOAD] Carregando conversas do Supabase em background...');
    loadSupabaseConversations(false).then(() => {
      console.log('✅ [LOAD] Conversas atualizadas do Supabase');
    }).catch((err) => {
      console.error('❌ [LOAD] Erro ao carregar conversas:', err);
    });
  }, [userCompanyId]); // ⚡ Carregar quando company_id estiver disponível

  // Fallback: polling com jitter enquanto desconectado
  useEffect(() => {
    if (realtimeConnectionStatus === 'connected') return;
    const schedule = () => {
      const jitter = 8000 + Math.floor(Math.random() * 4000); // 8-12s
      pollingTimeoutRef.current = setTimeout(async () => {
        try {
          console.log('⏱️ [FALLBACK] Polling de conversas (jitter) por desconexão do realtime');
          await loadSupabaseConversations();
        } finally {
          if (realtimeConnectionStatus === 'disconnected' || realtimeConnectionStatus === 'error') schedule();
        }
      }, jitter);
    };
    schedule();
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
    };
  }, [realtimeConnectionStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConv?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ⚡ HELPER: Atualizar conversas e cache simultaneamente
  const updateConversationsWithCache = useCallback((updater: (prev: Conversation[]) => Conversation[]) => {
    setConversations(prev => {
      const updated = updater(prev);
      // Salvar no cache imediatamente
      try {
        sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(updated));
        sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
      } catch (e) {
        // Ignorar erros de cache (pode estar cheio)
      }
      return updated;
    });
  }, []);

  const loadConversations = () => {
    // Não carregar do localStorage - dados vêm apenas do Supabase
    // Manter conversas iniciais apenas como fallback temporário
    setConversations(initialConversations);
  };

  // 🆕 RESTAURAR CONVERSA ANTIGA
  const handleRestoreConversation = async () => {
    if (!selectedConv?.phoneNumber || !userCompanyId) {
      toast.error("Número de telefone ou empresa inválidos");
      return;
    }

    try {
      setRestoringConversation(true);
      
      const instanceName = await evolutionAPI.getInstanceName(userCompanyId);
      if (!instanceName) {
        toast.error("Instância WhatsApp não configurada");
        return;
      }

      console.log("🔄 Restaurando conversa de:", selectedConv.phoneNumber);
      
      const messages = await evolutionAPI.getMessages(
        instanceName,
        selectedConv.phoneNumber,
        15
      );

      if (messages.length === 0) {
        toast.info("Nenhuma mensagem encontrada no WhatsApp");
        return;
      }

      await evolutionAPI.saveMessagesToDatabase(
        messages,
        userCompanyId,
        leadVinculado?.id
      );

      toast.success(`${messages.length} mensagens restauradas com sucesso!`);
      
      // Recarregar conversas
      await loadSupabaseConversations();
      setIsContactInactive(false);
      
    } catch (error) {
      console.error("❌ Erro ao restaurar conversa:", error);
      toast.error("Erro ao restaurar conversa");
    } finally {
      setRestoringConversation(false);
    }
  };

  // 🆕 VERIFICAR SE CONTATO ESTÁ INATIVO (30+ DIAS)
  useEffect(() => {
    if (!selectedConv) {
      setIsContactInactive(false);
      return;
    }

    const messages = selectedConv.messages || [];
    if (messages.length === 0) {
      setIsContactInactive(true);
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const lastMessageDate = new Date(lastMessage.timestamp);
    const daysSinceLastMessage = Math.floor(
      (Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    setIsContactInactive(daysSinceLastMessage >= 30);
  }, [selectedConv]);

  const loadSupabaseConversations = async (append: boolean = false) => {
    if (loadingConversations) return;
    
    try {
      setLoadingConversations(true);
      const startTime = performance.now();
      
      // ⚡ OTIMIZAÇÃO: Usar company_id em cache se disponível
      let companyId = userCompanyId || userCompanyIdRef.current;
      
      // ETAPA 1: Buscar user e company_id (apenas se não tiver cache)
      if (!companyId) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error('Você precisa estar logado');
          setLoadingConversations(false);
          return;
        }
        
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.company_id) {
          toast.error('Erro: Usuário sem empresa associada');
          setLoadingConversations(false);
          return;
        }

        companyId = userRole.company_id;
        setUserCompanyId(companyId);
        userCompanyIdRef.current = companyId;
      }
      
      // ⚡ OTIMIZAÇÃO: Limitar quantidade inicial de conversas para carregamento RÁPIDO (tempo 0)
      const INITIAL_LIMIT = 30; // Reduzir para 30 conversas iniciais (mais rápido)
      const MESSAGES_PER_CONVERSATION = 3; // Apenas 3 últimas mensagens por conversa (mais rápido)
      
      // ⚡ CORREÇÃO: Para append, buscar mensagens mais antigas (conversas diferentes)
      const MESSAGES_TO_FETCH = append ? 100 : INITIAL_LIMIT * 2; // Buscar mais mensagens para agrupar
      
      // ETAPA 2: ⚡ BUSCAR CONVERSAS OTIMIZADO - Buscar apenas últimas mensagens por telefone
      // Query otimizada: buscar apenas campos essenciais e limitar quantidade
      let query = supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, midia_url, fromme')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      // ⚡ CORREÇÃO: Para append, buscar mensagens mais antigas usando a data da última mensagem carregada
      if (append && conversations.length > 0) {
        // Encontrar a data da mensagem mais antiga já carregada
        const todasMensagens = conversations.flatMap(c => c.messages);
        if (todasMensagens.length > 0) {
          const dataMaisAntiga = todasMensagens
            .map(m => m.timestamp instanceof Date ? m.timestamp : new Date(m.timestamp))
            .sort((a, b) => a.getTime() - b.getTime())[0];
          
          // Buscar mensagens mais antigas que a data mais antiga já carregada
          query = query.lt('created_at', dataMaisAntiga.toISOString());
        }
      }
      
      query = query.limit(MESSAGES_TO_FETCH);
      
      const { data: conversasResult, error: conversasError } = await query;

      if (conversasError) {
        toast.error('Erro ao carregar conversas');
        setLoadingConversations(false);
        return;
      }

      const conversasData = conversasResult || [];
      
      // ⚡ OTIMIZAÇÃO: Processar e agrupar de forma mais eficiente
      const validConversas = conversasData.filter(conv => 
        conv.numero && !conv.numero.includes('{{') &&
        conv.mensagem && !conv.mensagem.includes('{{')
      );

      // Agrupar conversas por telefone e pegar apenas última mensagem de cada
      const conversasMap = new Map<string, any[]>();
      validConversas.forEach(conv => {
        const isGroup = conv.is_group || /@g\.us$/.test(conv.numero || '');
        const key = isGroup ? conv.numero : (conv.telefone_formatado || conv.numero.replace(/[^0-9]/g, ''));
        
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        const mensagens = conversasMap.get(key)!;
        mensagens.push(conv);
        // Manter apenas últimas mensagens ordenadas por data
        if (mensagens.length > MESSAGES_PER_CONVERSATION) {
          mensagens.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          mensagens.splice(MESSAGES_PER_CONVERSATION);
        }
      });

      // ⚡ OTIMIZAÇÃO: Buscar apenas leads dos telefones encontrados (não todos) - MAIS RÁPIDO
      const telefonesUnicos = Array.from(conversasMap.keys())
        .map(tel => tel.replace(/[^0-9]/g, ''))
        .filter(tel => tel.length >= 10)
        .slice(0, 30); // Limitar a 30 telefones para query mais rápida
      
      // Buscar leads de forma otimizada - limitar quantidade drasticamente
      let leadsData: any[] = [];
      if (telefonesUnicos.length > 0) {
        // Buscar apenas 50 leads (muito mais rápido)
        const leadsResult = await supabase
          .from('leads')
          .select('id, phone, name, telefone')
          .eq('company_id', companyId)
          .limit(50); // Reduzir para 50 leads (muito mais rápido)
        
        if (!leadsResult.error && leadsResult.data) {
          // Filtrar localmente apenas os leads relevantes
          leadsData = leadsResult.data.filter(lead => {
            const phoneRaw = lead.phone || lead.telefone;
            if (!phoneRaw) return false;
            const phoneKey = phoneRaw.replace(/[^0-9]/g, '');
            return telefonesUnicos.some(tel => phoneKey.includes(tel) || tel.includes(phoneKey));
          });
        }
      }
      
      console.log(`📊 [LOAD] ${conversasData.length} mensagens processadas, ${conversasMap.size} conversas únicas, ${leadsData.length} leads encontrados`);
      
      // Criar mapa de leads para buscar nomes
      const leadsMap = new Map<string, { name: string; leadId: string }>();
      leadsData.forEach(lead => {
        const phoneRaw = lead.phone || lead.telefone;
        if (!phoneRaw) return;
        
        const phoneKey = phoneRaw.replace(/[^0-9]/g, '');
        if (phoneKey) {
          leadsMap.set(phoneKey, {
            name: lead.name || phoneKey,
            leadId: lead.id
          });
        }
      });

      // ETAPA 3: Criar lista de conversas (otimizado)
      const novasConversas: Conversation[] = Array.from(conversasMap.entries())
        .slice(0, INITIAL_LIMIT) // Limitar a 50 conversas iniciais
        .map(([telefone, mensagens]) => {
        const leadInfo = leadsMap.get(telefone);
        
        // PRIORIDADE 1: Nome do Lead (se existir)
        let contactName = leadInfo?.name;
        
        // PRIORIDADE 2: Nome da mensagem
        const nomesProibidos = [
          'jeohvah lima', 
          'jeohvah i.a', 
          'jeova costa de lima',
          'jeo',
          telefone
        ];
        
        if (!contactName || contactName === telefone) {
          const nomeMensagem = mensagens.find(m => {
            const nomeMsg = m.nome_contato?.trim().toLowerCase();
            return nomeMsg && 
                   nomeMsg !== telefone && 
                   !nomesProibidos.includes(nomeMsg);
          })?.nome_contato;
          
          if (nomeMensagem) {
            contactName = nomeMensagem;
          }
        }
        
        // FALLBACK: Usar telefone
        if (!contactName || contactName.trim() === '') {
          contactName = telefone;
        }
        
        // ⚡ OTIMIZAÇÃO: Processar apenas últimas mensagens (já limitado acima)
        const messagensFormatadas: Message[] = mensagens
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-MESSAGES_PER_CONVERSATION)
          .map(m => ({
            id: m.id || `msg-${Date.now()}-${Math.random()}`,
            content: m.mensagem || '',
            type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
            sender: (m.fromme === true || m.status === 'Enviada') ? "user" : "contact",
            timestamp: new Date(m.created_at || Date.now()),
            delivered: true,
            read: m.status !== 'Recebida',
            mediaUrl: m.midia_url,
          }));

        // ⚡ CORREÇÃO: Determinar status baseado na última mensagem
        const ultimaMensagem = messagensFormatadas[messagensFormatadas.length - 1];
        let statusConversa: "waiting" | "answered" | "resolved" = "waiting";
        
        // Verificar se há mensagem marcada como resolvida no banco
        const temMensagemResolvida = mensagens.some(m => m.status === 'Resolvida' || m.status === 'Finalizada');
        if (temMensagemResolvida) {
          statusConversa = "resolved";
        } else if (ultimaMensagem) {
          // Se última mensagem é do usuário = foi respondida
          if (ultimaMensagem.sender === 'user') {
            statusConversa = "answered";
          } else {
            // Se última mensagem é do contato = aguardando resposta
            statusConversa = "waiting";
          }
        }
        
        return {
          id: telefone,
          contactName,
          channel: "whatsapp" as const,
          status: statusConversa,
          lastMessage: messagensFormatadas[messagensFormatadas.length - 1]?.content || '',
          unread: mensagens.filter(m => m.status === 'Recebida' && m.fromme !== true).length,
          messages: messagensFormatadas,
          tags: [],
          phoneNumber: telefone,
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName.substring(0, 2))}&background=0ea5e9&color=fff`,
          isGroup: false
        };
      });

      const loadTime = performance.now() - startTime;
      console.log(`✅ ${novasConversas.length} conversas carregadas em ${loadTime.toFixed(0)}ms`);
      
      // ⚡ MERGE INTELIGENTE: Preservar conversas em tempo real e evitar duplicatas
      if (append) {
        setConversations(prev => {
          // ⚡ CORREÇÃO: Filtrar conversas que já existem para evitar duplicação
          const telefonesExistentes = new Set(prev.map(c => c.phoneNumber || c.id));
          const conversasNovas = novasConversas.filter(conv => {
            const tel = conv.phoneNumber || conv.id;
            return !telefonesExistentes.has(tel);
          });
          
          if (conversasNovas.length === 0) {
            console.log('⚠️ [APPEND] Nenhuma conversa nova encontrada (todas já estão carregadas)');
            setHasMoreConversations(false); // Não há mais conversas para carregar
            toast.info('Todas as conversas já estão carregadas');
            return prev; // Não adicionar duplicatas
          }
          
          console.log(`✅ [APPEND] Adicionando ${conversasNovas.length} conversas novas (${novasConversas.length - conversasNovas.length} duplicadas ignoradas)`);
          
          const merged = [...prev, ...conversasNovas];
          
          // Salvar no cache
          try {
            sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(merged));
            sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          } catch (e) {
            console.warn('⚠️ [CACHE] Erro ao salvar cache:', e);
          }
          
          // Se não encontrou conversas novas, não há mais para carregar
          if (conversasNovas.length < novasConversas.length || conversasNovas.length === 0) {
            setHasMoreConversations(false);
          }
          
          return merged;
        });
        toast.success(`+${novasConversas.filter(conv => {
          const tel = conv.phoneNumber || conv.id;
          return !conversations.some(c => (c.phoneNumber || c.id) === tel);
        }).length} novas conversas carregadas`);
      } else {
        setConversations(prev => {
          const telefonesDoBanco = new Set(novasConversas.map(c => c.phoneNumber || c.id));
          const conversasRealtime = prev.filter(c => {
            const tel = c.phoneNumber || c.id;
            return !telefonesDoBanco.has(tel);
          });
          const merged = [...conversasRealtime, ...novasConversas];
          
          // ⚡ INSTANTÂNEO: Salvar no cache imediatamente
          try {
            sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(merged));
            sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          } catch (e) {
            console.warn('⚠️ [CACHE] Erro ao salvar cache:', e);
          }
          
          return merged;
        });
        // Não mostrar toast se carregou do cache (já está visível)
      }
      
      // ⚡ OTIMIZAÇÃO: Carregar métricas em paralelo (não bloqueia)
      loadCompanyMetrics();
      
      // ⚡ OTIMIZAÇÃO: Finalizar loading ANTES de carregar avatares
      setLoadingConversations(false);

      // ⚡ LAZY LOADING DE AVATARES: Carregar imediatamente (sem delays)
      const primeiros = novasConversas.slice(0, 3);
      Promise.all(primeiros.map(async (conv) => {
        if (conv.phoneNumber) {
          try {
            const profilePicUrl = await getProfilePictureWithFallback(
              conv.phoneNumber, 
              companyId, 
              conv.contactName
            );
            
            if (profilePicUrl) {
              setConversations(prev => prev.map(c => 
                c.id === conv.id ? { ...c, avatarUrl: profilePicUrl } : c
              ));
            }
          } catch (error) {
            // Silenciar erros de foto
          }
        }
      })).catch(() => {}); // Não bloquear se houver erro

      // ⚡ CARREGAR RESTANTES EM BACKGROUND (baixa prioridade)
      const restantes = novasConversas.slice(3);
      if (restantes.length > 0) {
        restantes.forEach(async (conv, index) => {
          if (conv.phoneNumber) {
            try {
              const profilePicUrl = await getProfilePictureWithFallback(
                conv.phoneNumber, 
                companyId, 
                conv.contactName
              );
              
              if (profilePicUrl) {
                setConversations(prev => prev.map(c => 
                  c.id === conv.id ? { ...c, avatarUrl: profilePicUrl } : c
                ));
              }
            } catch (error) {
              // Silenciar erros de foto
            }
          }
        });
      }
      
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      toast.error('Erro ao carregar conversas');
      setLoadingConversations(false);
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

  const loadReminders = async () => {
    if (!leadVinculado?.id) return;
    
    try {
      // CORREÇÃO: Buscar lembretes através dos compromissos do lead
      const { data: compromissos, error: compError } = await supabase
        .from('compromissos')
        .select('id')
        .eq('lead_id', leadVinculado.id);

      if (compError) throw compError;

      if (!compromissos || compromissos.length === 0) {
        setReminders([]);
        return;
      }

      const compromissoIds = compromissos.map(c => c.id);

      const { data, error } = await supabase
        .from('lembretes')
        .select(`
          *,
          compromisso:compromissos(
            data_hora_inicio,
            tipo_servico,
            lead_id
          )
        `)
        .in('compromisso_id', compromissoIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
    }
  };

  const loadMeetings = async () => {
    if (!leadVinculado?.id) {
      setMeetings([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('compromissos')
        .select(`
          *,
          lead:leads(name, phone)
        `)
        .eq('lead_id', leadVinculado.id)
        .order('data_hora_inicio', { ascending: false });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Erro ao carregar reuniões:', error);
    }
  };

  // 📜 Carregar TODO o histórico de mensagens de um contato
  const loadFullConversationHistory = async (phoneNumber: string, contactName: string) => {
    if (!userCompanyId) return;
    
    setLoadingHistory(true);
    console.log(`📜 Carregando histórico completo para ${contactName} (${phoneNumber})...`);
    
    try {
      // Normalizar número de telefone para buscar em diferentes formatos
      const telefoneNormalizado = normalizePhoneForWA(phoneNumber);
      const telefoneSemFormatacao = telefoneNormalizado.replace(/\D/g, '');
      const telefoneOriginal = phoneNumber.replace(/\D/g, '');
      
      // Criar lista de variações para buscar (remover duplicatas)
      const variacoes = Array.from(new Set([
        phoneNumber,
        telefoneNormalizado,
        telefoneSemFormatacao,
        telefoneOriginal,
        `${telefoneNormalizado}@s.whatsapp.net`,
        `${telefoneNormalizado}@c.us`
      ].filter(v => v && v.length > 0)));
      
      // Buscar TODAS as mensagens do contato (sem limite) - tentar múltiplos formatos
      // Construir condições de forma mais segura
      const telefoneConditions = variacoes.map(v => `telefone_formatado.eq.${v}`).join(',');
      const numeroConditions = variacoes.map(v => `numero.eq.${v}`).join(',');
      const allConditions = [telefoneConditions, numeroConditions].filter(c => c).join(',');
      
      let allMessages, error;
      if (allConditions) {
        const result = await supabase
          .from('conversas')
          .select('*')
          .eq('company_id', userCompanyId)
          .or(allConditions)
          .order('created_at', { ascending: true });
        
        allMessages = result.data;
        error = result.error;
      } else {
        // Fallback: buscar apenas pelo número original
        const result = await supabase
          .from('conversas')
          .select('*')
          .eq('company_id', userCompanyId)
          .eq('telefone_formatado', phoneNumber)
          .order('created_at', { ascending: true });
        
        allMessages = result.data;
        error = result.error;
      }
      
      if (error) {
        console.error('❌ Erro ao buscar histórico:', error);
        throw error;
      }
      
      if (allMessages && allMessages.length > 0) {
        console.log(`✅ ${allMessages.length} mensagens carregadas do histórico`);
        
        // Formatar todas as mensagens
        const messagensCompletas: Message[] = allMessages.map(m => ({
          id: m.id || `msg-${Date.now()}-${Math.random()}`,
          content: m.mensagem || '',
          type: (m.tipo_mensagem === 'texto' ? 'text' : (m.tipo_mensagem || 'text')) as any,
          sender: ((m.fromme === true || m.status === 'Enviada') ? "user" : "contact") as "user" | "contact",
          timestamp: new Date(m.created_at || Date.now()),
          delivered: true,
          read: m.status !== 'Recebida',
          mediaUrl: m.midia_url,
          fileName: m.arquivo_nome,
        }));
        
        // Atualizar a conversa selecionada
        setSelectedConv(prev => {
          if (prev && prev.phoneNumber === phoneNumber) {
            return {
              ...prev,
              messages: messagensCompletas
            };
          }
          return prev;
        });
        
        // Atualizar conversa na lista
        setConversations(prev => prev.map(conv => 
          conv.phoneNumber === phoneNumber 
            ? { ...conv, messages: messagensCompletas }
            : conv
        ));
        
        // Estatísticas
        setHistoryStats(prev => ({
          ...prev,
          [phoneNumber]: { total: allMessages.length, loaded: allMessages.length }
        }));
        
        // Scroll
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        
        toast.success(`📜 ${allMessages.length} mensagens carregadas`);
      } else {
        toast.info('Nenhum histórico anterior encontrado');
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar histórico:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoadingHistory(false);
    }
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

  // MELHORIA: Função auxiliar para atualizar status de transcrição
  const updateTranscriptionStatus = (messageId: string, status: "pending" | "processing" | "completed" | "error", transcription?: string) => {
    setTranscriptionStatuses(prev => ({ ...prev, [messageId]: status }));
    
    // Atualizar status na mensagem
    const updateMessage = (msg: Message) => {
      if (msg.id === messageId) {
        return {
          ...msg,
          transcriptionStatus: status,
          ...(transcription !== undefined && { transcricao: transcription })
        };
      }
      return msg;
    };
    
    // Atualizar na conversa selecionada
    setSelectedConv(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map(updateMessage)
      };
    });
    
    // Atualizar na lista de conversas
    setConversations(prevConvs => prevConvs.map(conv => ({
      ...conv,
      messages: conv.messages.map(updateMessage)
    })));
  };

  // MELHORIA: Limpar polling e timeout
  const clearTranscriptionPolling = (messageId: string) => {
    const refs = transcriptionPollingRefs.current[messageId];
    if (refs) {
      if (refs.interval) clearInterval(refs.interval);
      if (refs.timeout) clearTimeout(refs.timeout);
      delete transcriptionPollingRefs.current[messageId];
    }
  };

  // MELHORIA: Polling para verificar status de transcrição
  const pollTranscriptionStatus = async (
    messageId: string,
    transcriptionId?: string,
    audioUrl?: string,
    maxPolls: number = 30,
    pollInterval: number = 1000
  ): Promise<void> => {
    let pollCount = 0;
    
    const pollIntervalId = setInterval(async () => {
      pollCount++;
      
      try {
        // Se tiver transcriptionId, verificar status
        if (transcriptionId) {
          // Aqui você pode implementar verificação de status se a Edge Function retornar um ID
          // Por enquanto, vamos apenas aguardar e verificar se a transcrição foi concluída
          console.log(`🔄 [TRANSCRIBE] Polling status (${pollCount}/${maxPolls}) para mensagem ${messageId}`);
        }
        
        // Se exceder o número máximo de polls, marcar como erro
        if (pollCount >= maxPolls) {
          clearInterval(pollIntervalId);
          updateTranscriptionStatus(messageId, "error");
          toast.error("Timeout: Transcrição demorou muito para processar. Tente novamente.");
          clearTranscriptionPolling(messageId);
        }
      } catch (error) {
        console.error(`❌ [TRANSCRIBE] Erro ao verificar status:`, error);
      }
    }, pollInterval);
    
    transcriptionPollingRefs.current[messageId] = {
      ...transcriptionPollingRefs.current[messageId],
      interval: pollIntervalId
    };
  };

  const transcreverAudio = async (messageId: string, audioUrl: string, retry: boolean = false) => {
    try {
      // Limpar polling anterior se existir
      clearTranscriptionPolling(messageId);
      
      // Se não for retry e já tiver status, não fazer nada
      if (!retry && transcriptionStatuses[messageId] === "processing") {
        console.log(`⏸️ [TRANSCRIBE] Transcrição já em processamento para mensagem ${messageId}`);
        return;
      }
      
      // Atualizar status para "processing"
      updateTranscriptionStatus(messageId, "processing");
      
      console.log(`🎤 [TRANSCRIBE] Iniciando transcrição para mensagem ${messageId}`);
      toast.info("Transcrevendo áudio...", { duration: 2000 });
      
      // Baixar o áudio
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error(`Erro ao baixar áudio: ${audioResponse.statusText}`);
      }
      
      const audioBlob = await audioResponse.blob();
      
      // Converter para base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result?.toString().split(',')[1];
          if (base64) {
            resolve(base64);
          } else {
            reject(new Error("Não foi possível converter áudio para base64"));
          }
        };
        reader.onerror = () => reject(new Error("Erro ao ler arquivo de áudio"));
        reader.readAsDataURL(audioBlob);
      });
      
      if (!userCompanyId) {
        throw new Error("Company ID não encontrado");
      }
      
      // MELHORIA: Usar função com retry e timeout de 30s
      const TRANSCRIPTION_TIMEOUT = 30000; // 30 segundos
      const timeoutId = setTimeout(() => {
        // Verificar status atual sem depender do closure
        setTranscriptionStatuses(prev => {
          const currentStatus = prev[messageId];
          if (currentStatus === "processing" || currentStatus === "pending") {
            // Atualizar status diretamente aqui para evitar problemas de callback
            setTimeout(() => {
              updateTranscriptionStatus(messageId, "error");
              clearTranscriptionPolling(messageId);
              toast.error("Timeout: Transcrição demorou mais de 30 segundos. Tente novamente.");
            }, 0);
            return { ...prev, [messageId]: "error" };
          }
          return prev;
        });
      }, TRANSCRIPTION_TIMEOUT);
      
      transcriptionPollingRefs.current[messageId] = {
        ...transcriptionPollingRefs.current[messageId],
        timeout: timeoutId
      };
      
      // Chamar a Edge Function com retry
      const result = await transcribeAudioWithRetry({
        audioUrl,
        audioBase64: base64Audio,
        company_id: userCompanyId
      });
      
      // Limpar timeout já que recebemos resposta
      clearTimeout(timeoutId);
      
      // Verificar resultado
      if (result.status === 'error' || (!result.transcription && result.status !== 'pending')) {
        // Limpar polling em caso de erro
        clearTranscriptionPolling(messageId);
        updateTranscriptionStatus(messageId, "error");
        toast.error("Erro ao transcrever áudio. Você pode tentar novamente clicando em 'Reenviar Transcrição'.");
        return;
      }
      
      // Se status for "pending", ainda está processando
      if (result.status === 'pending') {
        console.log(`⏳ [TRANSCRIBE] Transcrição pendente, iniciando polling...`);
        updateTranscriptionStatus(messageId, "pending");
        // Iniciar polling - o timeout já foi limpo acima
        pollTranscriptionStatus(messageId, undefined, audioUrl, 15, 2000).catch((error) => {
          console.error('❌ [TRANSCRIBE] Erro no polling:', error);
          updateTranscriptionStatus(messageId, "error");
        });
        return;
      }
      
      // Limpar polling já que temos resultado
      clearTranscriptionPolling(messageId);
      
      // Se status for "completed" ou tiver transcrição, salvar
      const transcriptionText = result.transcription;
      
      if (transcriptionText && transcriptionText !== '[Transcrição pendente - erro ao processar áudio]') {
        // Salvar transcrição no banco de dados (se a coluna existir)
        try {
          await supabase
            .from('conversas')
            .update({ transcricao: transcriptionText } as any)
            .eq('id', messageId);
          
          console.log(`✅ [TRANSCRIBE] Transcrição salva no banco de dados`);
        } catch (dbError) {
          console.warn('⚠️ [TRANSCRIBE] Coluna transcricao não encontrada na tabela conversas. Salvando apenas localmente.', dbError);
        }
        
        // Atualizar status e transcrição
        updateTranscriptionStatus(messageId, "completed", transcriptionText);
        
        toast.success("✅ Áudio transcrito com sucesso!");
        console.log(`✅ [TRANSCRIBE] Transcrição concluída para mensagem ${messageId}`);
      } else {
        updateTranscriptionStatus(messageId, "error");
        toast.error("Transcrição não disponível. Tente novamente.");
      }
      
    } catch (error: any) {
      console.error('❌ [TRANSCRIBE] Erro ao transcrever áudio:', error);
      updateTranscriptionStatus(messageId, "error");
      clearTranscriptionPolling(messageId);
      
      const errorMessage = error?.message || "Não foi possível transcrever o áudio";
      toast.error(`Erro ao transcrever: ${errorMessage}. Você pode tentar novamente.`);
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
    
    // Enviar mensagem editada via WhatsApp (com retry)
    try {
      const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
      const { error } = await enviarWhatsApp({
        numero: numeroNormalizado,
        mensagem: `✏️ *[Mensagem editada]*\n\n${newContent}`,
        tipo_mensagem: 'text'
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

  const handleReact = async (messageId: string, emoji: string) => {
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
    
    // Enviar reação para o cliente com referência à mensagem
    try {
      const targetMsg = selectedConv.messages.find(m => m.id === messageId);
      const { data, error } = await enviarWhatsApp({
        numero: selectedConv.id,
        tipo_mensagem: 'reaction',
        reaction: { emoji, messageId },
        mensagem: `Reagiu com ${emoji} à mensagem: "${targetMsg?.content || ''}"`,
        quoted: targetMsg ? {
          key: { id: messageId },
          message: { conversation: targetMsg.content || '' }
        } : undefined,
      });
      if (error) {
        console.error('Erro ao enviar reação:', error);
      } else {
        // Persistir no histórico como texto informativo
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();
        const isGroup = /@g\.us$/.test(String(selectedConv.id));
        const telefone_formatado = isGroup ? null : normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
        await supabase.from('conversas').insert([{
          numero: selectedConv.id,
          telefone_formatado,
          mensagem: `Reagiu com ${emoji} à mensagem: "${targetMsg?.content || ''}"`,
          origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : 
                  selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
          status: 'Enviada',
          tipo_mensagem: 'text',
          nome_contato: selectedConv.contactName,
          company_id: userRole?.company_id,
        }]);
      }
    } catch (err) {
      console.error('Erro ao processar reação:', err);
    }
    
    toast.success(`Reação ${emoji} enviada!`);
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

      // Enviar via edge function (retry via wrapper interno)
      const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
      const quotedPayload = replyingTo && selectedConv.messages.find(m => m.id === replyingTo)
        ? {
            quoted: {
              key: { id: replyingTo },
              message: { conversation: selectedConv.messages.find(m => m.id === replyingTo)?.content || '' }
            },
            quotedMessageId: replyingTo
          }
        : {};

      const { data, error } = await enviarWhatsApp({
        numero: numeroNormalizado,
        mensagem: caption || tipoMensagem[type],
        tipo_mensagem: type,
        mediaBase64: base64,
        fileName: file.name,
        mimeType: file.type,
        caption: caption || '',
        ...quotedPayload,
      });

      if (error) {
        throw error;
      }

      console.log('✅ Mídia enviada com sucesso');

      // Salvar no Supabase e obter ID para manter sincronizado
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      const { data: inserted, error: dbError } = await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem: caption || tipoMensagem[type],
        origem: 'WhatsApp',
        status: 'Enviada',
        tipo_mensagem: type,
        nome_contato: selectedConv.contactName,
        arquivo_nome: file.name,
        company_id: userRole?.company_id,
      }]).select('id').single();

      if (dbError) {
        console.error('❌ Erro ao salvar mensagem no banco:', dbError);
        toast.error('Erro ao salvar mensagem no histórico');
      }

      const newMessage: Message = {
        id: (inserted?.id || Date.now()).toString(),
        content: caption || tipoMensagem[type] || 'Arquivo enviado',
        type: type as "image" | "audio" | "pdf" | "video",
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        mediaUrl: URL.createObjectURL(file),
        fileName: file.name,
        mimeType: file.type,
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

      // Atualizar status no banco de dados para sincronização em tempo real
      try {
        const telefoneFormatado = selectedConv.phoneNumber?.replace(/[^0-9]/g, '') || selectedConv.id.replace(/[^0-9]/g, '');
        const { error: updateError } = await supabase
          .from('conversas')
          .update({ status: 'Enviada' })
          .eq('telefone_formatado', telefoneFormatado)
          .eq('company_id', userCompanyId);

        if (updateError) {
          console.error('❌ Erro ao atualizar status no banco:', updateError);
        } else {
          console.log('✅ Status atualizado no banco para "Enviada"');
        }
      } catch (error) {
        console.error('❌ Erro ao sincronizar status:', error);
      }

      // já salvo acima

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
      
      // Não mostrar notificação ao enviar mídia - apenas logs
      console.log('✅ Mídia enviada com sucesso');
    } catch (error) {
      console.error("❌ Erro ao enviar mídia:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
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

      // Enviar via edge function (retry via wrapper interno)
      const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
      const quotedPayload = replyingTo && selectedConv.messages.find(m => m.id === replyingTo)
        ? {
            quoted: {
              key: { id: replyingTo },
              message: { conversation: selectedConv.messages.find(m => m.id === replyingTo)?.content || '' }
            },
            quotedMessageId: replyingTo
          }
        : {};
      const { data, error } = await enviarWhatsApp({
        numero: numeroNormalizado,
        mensagem: 'Áudio enviado',
        tipo_mensagem: 'audio',
        mediaBase64: base64,
        fileName: 'audio.ogg',
        mimeType: 'audio/ogg; codecs=opus',
        caption: '',
        ...quotedPayload,
      });

      if (error) {
        throw error;
      }

      console.log('✅ Áudio enviado com sucesso');

      // Salvar no Supabase e obter ID para manter sincronizado
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      const { data: inserted, error: dbError } = await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem: 'Áudio enviado',
        origem: 'WhatsApp',
        status: 'Enviada',
        tipo_mensagem: 'audio',
        nome_contato: selectedConv.contactName,
        arquivo_nome: 'audio.ogg',
        company_id: userRole?.company_id,
      }]).select('id').single();
      if (dbError) {
        console.error('❌ Erro ao salvar mensagem no banco:', dbError);
        toast.error('Erro ao salvar mensagem no histórico');
      }

      const newMessage: Message = {
        id: (inserted?.id || Date.now()).toString(),
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

      // Atualizar status no banco de dados
      try {
        const telefoneFormatado = selectedConv.phoneNumber?.replace(/[^0-9]/g, '') || selectedConv.id.replace(/[^0-9]/g, '');
        await supabase
          .from('conversas')
          .update({ status: 'Enviada' })
          .eq('telefone_formatado', telefoneFormatado)
          .eq('company_id', userCompanyId);
        console.log('✅ Status atualizado no banco após enviar áudio');
      } catch (error) {
        console.error('❌ Erro ao sincronizar status do áudio:', error);
      }

      // Iniciar transcrição automática
      try {
        await transcreverAudio(newMessage.id, newMessage.mediaUrl!);
      } catch (e) {
        console.error('❌ Erro ao iniciar transcrição automática:', e);
      }

      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
      
      // Não mostrar notificação ao enviar áudio - apenas logs
      console.log('✅ Áudio enviado com sucesso');
    } catch (error) {
      console.error("❌ Erro ao enviar áudio:", error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
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

    // Atualizar status no banco de dados para sincronização em tempo real
    try {
      const telefoneFormatado = (selectedConv.phoneNumber || selectedConv.id).replace(/[^0-9]/g, '');
      await supabase
        .from('conversas')
        .update({ status: 'Enviada' })
        .eq('telefone_formatado', telefoneFormatado)
        .eq('company_id', userCompanyId);
      console.log('✅ Status atualizado no banco após enviar mensagem');
    } catch (error) {
      console.error('❌ Erro ao sincronizar status:', error);
    }
    
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
      const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
      const { data, error } = await enviarWhatsApp({
        numero: numeroNormalizado,
        ...mensagemParaEnviar,
        quotedMessageId: replyingTo || undefined,
        tipo_mensagem: type,
      });

      if (error) {
        // Wrapper já exibiu o toast de erro específico
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
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
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
      
      // CORREÇÃO: Limpar replyingTo após envio bem-sucedido
      if (replyingTo) {
        setReplyingTo(null);
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

  const addReminder = async () => {
    if (!selectedConv || !reminderTitle.trim() || !reminderDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }
    
    // Garantir lead automaticamente
    if (!leadVinculado?.id) {
      const lead = await findOrCreateLead(selectedConv);
      if (!lead) {
        toast.error("Não foi possível vincular o lead automaticamente");
        return;
      }
      setLeadVinculado(lead);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do lead vinculado
      const companyId = leadVinculado.company_id;
      if (!companyId) {
        toast.error("Lead sem company_id associado");
        return;
      }

      // Buscar ou criar compromisso
      const dataHoraCompromisso = new Date(reminderDatetime);
      
      const { data: compromisso, error: compromissoError } = await supabase
        .from('compromissos')
        .insert({
          lead_id: (leadVinculado?.id || (await findOrCreateLead(selectedConv))?.id) as string,
          usuario_responsavel_id: user.id,
          owner_id: user.id,
          company_id: companyId,
          data_hora_inicio: dataHoraCompromisso.toISOString(),
          data_hora_fim: new Date(dataHoraCompromisso.getTime() + 60 * 60 * 1000).toISOString(),
          tipo_servico: reminderTitle,
          observacoes: reminderNotes,
          status: 'agendado',
        })
        .select()
        .single();

      if (compromissoError) throw compromissoError;

      // Criar lembrete
      const { error: lembreteError } = await supabase
        .from('lembretes')
        .insert({
          compromisso_id: compromisso.id,
          canal: 'whatsapp',
          horas_antecedencia: 24,
          mensagem: `Olá! Lembramos: ${reminderTitle}`,
          status_envio: 'pendente',
          destinatario: 'lead',
          company_id: companyId,
        });

      if (lembreteError) throw lembreteError;

      setReminderTitle("");
      setReminderDatetime("");
      setReminderNotes("");
      toast.success("Lembrete criado e sincronizado!");
      loadReminders();
    } catch (error) {
      console.error('Erro ao criar lembrete:', error);
      toast.error("Erro ao criar lembrete");
    }
  };

  const scheduleMessage = async () => {
    if (!selectedConv || !scheduledContent.trim() || !scheduledDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      const scheduledDate = new Date(scheduledDatetime);
      const now = new Date();
      
      // Validar se a data está no futuro (sem restrição mínima de tempo)
      if (scheduledDate <= now) {
        toast.error("A data deve ser no futuro");
        return;
      }

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

      const phoneNumber = selectedConv.phoneNumber || selectedConv.id;

      const { error } = await supabase
        .from('scheduled_whatsapp_messages')
        .insert([{
          company_id: userRole.company_id,
          owner_id: session.user.id,
          conversation_id: selectedConv.id,
          phone_number: phoneNumber,
          contact_name: selectedConv.contactName,
          message_content: scheduledContent,
          scheduled_datetime: scheduledDate.toISOString(),
          status: 'pending',
        }]);

      if (error) {
        console.error('❌ Erro ao agendar mensagem:', error);
        toast.error('Erro ao agendar mensagem');
        return;
      }

      // Calcular tempo até o envio
      const minutosAteEnvio = Math.round((scheduledDate.getTime() - now.getTime()) / (1000 * 60));
      const horasAteEnvio = Math.floor(minutosAteEnvio / 60);
      const minutosRestantes = minutosAteEnvio % 60;
      
      let tempoMensagem = "";
      if (horasAteEnvio > 0) {
        tempoMensagem = `em ${horasAteEnvio}h${minutosRestantes > 0 ? ` e ${minutosRestantes}min` : ''}`;
      } else {
        tempoMensagem = `em ${minutosRestantes} minuto${minutosRestantes !== 1 ? 's' : ''}`;
      }

      console.log('✅ Mensagem agendada com sucesso para:', scheduledDate.toISOString());
      toast.success(`Mensagem agendada para ser enviada ${tempoMensagem}!`);
      setScheduledContent("");
      setScheduledDatetime("");
      
      // Recarregar lista de mensagens agendadas
      await carregarMensagensAgendadas();
    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao agendar mensagem');
    }
  };

  const carregarMensagensAgendadas = async () => {
    if (!selectedConv) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const phoneNumber = selectedConv.phoneNumber || selectedConv.id;

      const { data, error } = await supabase
        .from('scheduled_whatsapp_messages')
        .select('*')
        .eq('company_id', userRole.company_id)
        .eq('phone_number', phoneNumber)
        .order('scheduled_datetime', { ascending: true });

      if (!error && data) {
        console.log('📅 Mensagens agendadas:', data.length);
        setScheduledMessages(data);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens agendadas:', error);
    }
  };

  const cancelarMensagemAgendada = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_whatsapp_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('❌ Erro ao cancelar mensagem:', error);
        toast.error('Erro ao cancelar mensagem');
        return;
      }

      toast.success('Mensagem cancelada');
      await carregarMensagensAgendadas();
    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao cancelar mensagem');
    }
  };

  // Sincronizar mensagens agendadas em tempo real
  useEffect(() => {
    if (!selectedConv) return;

    carregarMensagensAgendadas();

    const channel = supabase
      .channel('scheduled-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_whatsapp_messages',
        },
        (payload) => {
          console.log('📡 Atualização de mensagem agendada:', payload);
          carregarMensagensAgendadas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConv?.id]);

  const scheduleMeeting = async () => {
    if (!selectedConv || !meetingTitle.trim() || !meetingDatetime) {
      toast.error("Preencha todos os campos");
      return;
    }
    
    // Garantir lead automaticamente
    if (!leadVinculado?.id) {
      const lead = await findOrCreateLead(selectedConv);
      if (!lead) {
        toast.error("Não foi possível vincular o lead automaticamente");
        return;
      }
      setLeadVinculado(lead);
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do lead vinculado
      const companyId = leadVinculado.company_id;
      if (!companyId) {
        toast.error("Lead sem company_id associado");
        return;
      }

      // Criar compromisso/reunião
      const dataHoraInicio = new Date(meetingDatetime);
      const dataHoraFim = new Date(dataHoraInicio.getTime() + 60 * 60 * 1000); // 1 hora de duração
      
      const { error } = await supabase
        .from('compromissos')
        .insert({
          lead_id: (leadVinculado?.id || (await findOrCreateLead(selectedConv))?.id) as string,
          usuario_responsavel_id: user.id,
          owner_id: user.id,
          company_id: companyId,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico: meetingTitle,
          observacoes: meetingNotes,
          status: 'agendado',
        });

      if (error) throw error;

      setMeetingTitle("");
      setMeetingDatetime("");
      setMeetingNotes("");
      toast.success("Reunião agendada e sincronizada com Agenda!");
      // CORREÇÃO: Recarregar reuniões após criar
      await loadMeetings();
    } catch (error) {
      console.error('Erro ao agendar reunião:', error);
      toast.error("Erro ao agendar reunião");
    }
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
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        
        console.log('✅ Tag adicionada no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
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
      setTimeout(() => setSyncStatus('idle'), 2000);
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
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        
        console.log('✅ Lead adicionado ao funil no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
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
      setTimeout(() => setSyncStatus('idle'), 2000);
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
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        
        console.log('✅ Responsável atualizado no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
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
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  // Criar tarefa vinculada ao lead
  const criarTarefaDoLead = async () => {
    if (!selectedConv || !newTaskTitle.trim()) {
      toast.error("Digite o título da tarefa");
      return;
    }

    // Garantir lead automaticamente e aguardar atualização do estado
    let leadIdFinal = leadVinculado?.id;
    if (!leadIdFinal) {
      const lead = await findOrCreateLead(selectedConv);
      if (!lead) {
        toast.error("Não foi possível vincular o lead automaticamente");
        return;
      }
      setLeadVinculado(lead);
      leadIdFinal = lead.id;
      console.log('📋 [TAREFAS] Lead criado/vincular:', leadIdFinal);
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

      // SOLUÇÃO DEFINITIVA: Usar apenas campos que existem na tabela
      // Garantir que o lead_id seja sempre o do lead vinculado
      const leadIdParaTarefa = leadIdFinal || leadVinculado?.id;
      if (!leadIdParaTarefa) {
        toast.error("Erro: Lead não encontrado");
        return;
      }
      
      console.log('📋 [TAREFAS] Criando tarefa com lead_id:', leadIdParaTarefa);
      
      const taskData: any = {
        title: newTaskTitle,
        description: newTaskDescription || null,
        priority: newTaskPriority,
        due_date: newTaskDueDate || null,
        status: 'pendente',
        lead_id: leadIdParaTarefa,
        company_id: userRole.company_id,
        owner_id: session.user.id,
        // Incluir board_id e column_id apenas se fornecidos
        board_id: selectedTaskBoardId && selectedTaskBoardId.trim() ? selectedTaskBoardId : null,
        column_id: selectedTaskColumnId && selectedTaskColumnId.trim() ? selectedTaskColumnId : null,
      };

      // Inserir tarefa e obter o resultado
      let createdTask = null;
      let insertError = null;
      
      try {
        const result = await supabase
          .from('tasks')
          .insert([taskData])
          .select()
          .single(); // Usar .single() para obter a tarefa criada
        
        insertError = result.error;
        createdTask = result.data;
      } catch (insertException: any) {
        // Capturar qualquer exceção que possa ser lançada durante o insert
        console.error('❌ Exceção ao inserir tarefa:', insertException);
        
        // Verificar se é um erro de Edge Function
        if (insertException?.message?.includes('Edge Function') || 
            insertException?.message?.includes('non-2xx')) {
          // Erro de Edge Function - provavelmente da busca de foto
          // Ignorar e continuar, pois a tarefa pode ter sido criada mesmo assim
          console.warn('⚠️ Erro de Edge Function detectado (provavelmente da busca de foto) - ignorando');
        } else {
          // Outro tipo de erro - propagar
          throw insertException;
        }
      }

      if (insertError) {
        console.error('❌ Erro ao criar tarefa:', insertError);
        console.error('❌ Detalhes do erro:', {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code
        });
        toast.error(`Erro ao criar tarefa: ${insertError.message || 'Erro desconhecido'}`);
        return;
      }

      console.log('✅ Tarefa criada com sucesso:', createdTask);
      console.log('📋 [TAREFAS] Lead vinculado:', leadVinculado?.id);
      console.log('📋 [TAREFAS] Lead_id da tarefa:', createdTask?.lead_id);
      console.log('📋 [TAREFAS] LeadIdFinal:', leadIdFinal);
      toast.success('Tarefa criada!');
      
      // CORREÇÃO DEFINITIVA: SEMPRE adicionar tarefa à lista imediatamente
      if (createdTask) {
        const leadIdTarefa = createdTask.lead_id;
        const leadIdParaBuscar = leadIdTarefa || leadIdFinal || leadVinculado?.id;
        
        console.log('📋 [TAREFAS] Adicionando tarefa à lista. Lead_id tarefa:', leadIdTarefa, 'Lead_id buscar:', leadIdParaBuscar);
        
        // SEMPRE adicionar à lista imediatamente (otimista)
        setLeadTasks(prev => {
          const existe = prev.find(t => t.id === createdTask.id);
          if (existe) {
            console.log('📋 [TAREFAS] Tarefa já está na lista, atualizando');
            return prev.map(t => t.id === createdTask.id ? createdTask : t);
          }
          console.log('📋 [TAREFAS] Adicionando nova tarefa. Total antes:', prev.length);
          const novaLista = [createdTask, ...prev];
          console.log('📋 [TAREFAS] Total depois:', novaLista.length, 'Tarefas:', novaLista.map(t => ({ id: t.id, title: t.title, lead_id: t.lead_id })));
          return novaLista;
        });
        
        // Mudar para aba "Histórico" imediatamente
        setTarefasTabValue("historico");
        
        // Recarregar lista em background para garantir sincronização
        if (leadIdParaBuscar) {
          console.log('📋 [TAREFAS] Recarregando lista em background para sincronização');
          // Usar setTimeout para não bloquear a UI
          setTimeout(async () => {
            await carregarTarefasDoLead(leadIdParaBuscar);
          }, 100);
        }
      } else {
        // Se não conseguiu criar, recarregar lista do lead vinculado
        const leadIdParaBuscar = leadIdFinal || leadVinculado?.id;
        if (leadIdParaBuscar) {
          console.log('📋 [TAREFAS] Tarefa não criada, recarregando lista');
          await carregarTarefasDoLead(leadIdParaBuscar);
          setTarefasTabValue("historico");
        }
      }
      
      // Limpar campos
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("media");
      setNewTaskDueDate("");
      // CORREÇÃO: Manter board_id selecionado, mas limpar column_id
      setSelectedTaskColumnId("");
    } catch (error: any) {
      console.error('❌ Erro ao criar tarefa:', error);
      console.error('❌ Stack trace:', error?.stack);
      const errorMessage = error?.message || error?.error?.message || 'Erro desconhecido ao criar tarefa';
      toast.error(`Erro ao criar tarefa: ${errorMessage}`);
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
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        
        console.log('✅ Informações atualizadas no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
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
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  // Função auxiliar para buscar ou criar lead no Supabase
  // MELHORIA: Função auxiliar para validar e normalizar número de telefone
  const validateAndNormalizePhone = (phone: string): { normalized: string; isValid: boolean; variations: string[] } => {
    if (!phone || typeof phone !== 'string') {
      console.warn('⚠️ [LEAD] Telefone inválido: não é uma string', phone);
      return { normalized: '', isValid: false, variations: [] };
    }

    // Normalizar: remover todos os caracteres não numéricos
    const normalized = phone.replace(/[^0-9]/g, '');
    
    // Validar se é um número brasileiro válido (12 ou 13 dígitos)
    const isValid = normalized.length >= 12 && normalized.length <= 13;
    
    if (!isValid) {
      console.warn('⚠️ [LEAD] Telefone inválido: tamanho incorreto', {
        original: phone,
        normalized,
        length: normalized.length
      });
      return { normalized, isValid: false, variations: [] };
    }

    // Gerar variações do número para busca
    const variations = [
      normalized, // Número limpo
      phone, // Número original
      safeFormatPhoneNumber(phone), // Número formatado (se disponível)
      phone.replace(/\s+/g, ''), // Sem espaços
      phone.replace(/[()]/g, ''), // Sem parênteses
    ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Remover duplicatas

    console.log('✅ [LEAD] Telefone validado e normalizado:', {
      original: phone,
      normalized,
      isValid,
      variations: variations.length
    });

    return { normalized, isValid, variations };
  };

  const findOrCreateLead = async (conversation: Conversation) => {
    try {
      console.log('🔍 [LEAD] Iniciando busca/criação de lead para conversa:', {
        contactName: conversation.contactName,
        phoneNumber: conversation.phoneNumber,
        conversationId: conversation.id
      });
      
      // MELHORIA 1: Validar número de telefone antes de buscar lead
      const phoneRaw = conversation.phoneNumber || conversation.id;
      const { normalized: phoneNormalized, isValid, variations } = validateAndNormalizePhone(phoneRaw);

      if (!isValid || !phoneNormalized) {
        console.error('❌ [LEAD] Telefone inválido - não é possível buscar/criar lead:', phoneRaw);
        toast.error('Número de telefone inválido. Não é possível vincular lead.');
        return null;
      }

      // Buscar user_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ [LEAD] Usuário não autenticado');
        return null;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        console.warn('⚠️ [LEAD] Usuário sem company_id');
        toast.error('Erro: Configuração de empresa não encontrada');
        return null;
      }

      console.log('📞 [LEAD] Buscando lead com variações de telefone:', {
        variations,
        companyId: userRole.company_id
      });

      // MELHORIA 3: Buscar lead por telefone exato e variações
      const phoneConditions = variations
        .map(v => `phone.eq.${v},telefone.eq.${v}`)
        .join(',');
      
      const { data: existingLead, error: searchError } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', userRole.company_id)
        .or(phoneConditions)
        .maybeSingle();

      if (searchError && searchError.code !== 'PGRST116') {
        console.error('❌ [LEAD] Erro ao buscar lead:', {
          error: searchError,
          phoneConditions,
          variations
        });
        return null;
      }

      // MELHORIA 6: Logs detalhados para debug de vinculação
      if (existingLead) {
        console.log('✅ [LEAD] Lead encontrado:', {
          leadId: existingLead.id,
          leadName: existingLead.name,
          phoneMatched: existingLead.phone || existingLead.telefone,
          searchedVariations: variations.length
        });

        // MELHORIA 5: Vincular conversa ao lead encontrado
        const phoneKey = conversation.phoneNumber || conversation.id;
        const formatted = safeFormatPhoneNumber(phoneKey);
        setLeadsVinculados(prev => {
          const newMap = { ...prev };
          // Adicionar todas as variações ao mapeamento
          variations.forEach(v => {
            newMap[v] = existingLead.id;
          });
          newMap[phoneKey] = existingLead.id;
          if (formatted) {
            newMap[formatted] = existingLead.id;
          }
          return newMap;
        });

        console.log('✅ [LEAD] Conversa vinculada ao lead existente');
        return existingLead;
      }

      // MELHORIA 4: Se não encontrar, criar lead automaticamente
      console.log('📝 [LEAD] Lead não encontrado - criando novo lead no Supabase...');
      
      // Preparar dados do novo lead
      const newLeadData = {
        name: conversation.contactName || 'Contato sem nome',
        phone: phoneNormalized,
        telefone: phoneNormalized,
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

      console.log('📦 [LEAD] Dados do novo lead:', newLeadData);

      const { data: newLead, error: createError } = await supabase
        .from('leads')
        .insert(newLeadData)
        .select()
        .single();

      if (createError) {
        console.error('❌ [LEAD] Erro ao criar lead:', {
          error: createError,
          data: newLeadData
        });
        toast.error(`Erro ao criar lead: ${createError.message}`);
        return null;
      }

      console.log('✅ [LEAD] Novo lead criado com sucesso:', {
        leadId: newLead.id,
        leadName: newLead.name,
        phone: newLead.phone
      });

      // MELHORIA 5: Vincular conversa ao lead criado
      const phoneKey = conversation.phoneNumber || conversation.id;
      const formatted = safeFormatPhoneNumber(phoneKey);
      setLeadsVinculados(prev => {
        const newMap = { ...prev };
        // Adicionar todas as variações ao mapeamento
        variations.forEach(v => {
          newMap[v] = newLead.id;
        });
        newMap[phoneKey] = newLead.id;
        if (formatted) {
          newMap[formatted] = newLead.id;
        }
        return newMap;
      });

      toast.success(`Lead "${conversation.contactName}" criado automaticamente!`);
      console.log('✅ [LEAD] Conversa vinculada ao novo lead');
      
      // O realtime vai propagar para Leads e Funil automaticamente
      return newLead;
    } catch (error) {
      console.error('❌ [LEAD] Erro em findOrCreateLead:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversation: {
          id: conversation.id,
          contactName: conversation.contactName,
          phoneNumber: conversation.phoneNumber
        }
      });
      toast.error('Erro ao processar lead');
      return null;
    }
  };

  // MELHORIA: Função para verificar se existe lead vinculado com validação e logs aprimorados
  const verificarLeadVinculado = async (conversation: Conversation) => {
    try {
      setMostrarBotaoCriarLead(false);
      
      console.log('🔍 [LEAD] Verificando lead vinculado para conversa:', {
        contactName: conversation.contactName,
        phoneNumber: conversation.phoneNumber,
        conversationId: conversation.id
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.warn('⚠️ [LEAD] Usuário não autenticado - não é possível verificar lead');
        return;
      }
      
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole?.company_id) {
        console.warn('⚠️ [LEAD] Usuário sem company_id - não é possível verificar lead');
        return;
      }

      // MELHORIA 1 e 2: Validar e normalizar número de telefone
      const phoneRaw = conversation.phoneNumber || conversation.id;
      const { normalized: phoneNormalized, isValid, variations } = validateAndNormalizePhone(phoneRaw);

      if (!isValid || !phoneNormalized) {
        console.warn('⚠️ [LEAD] Telefone inválido - não é possível verificar lead:', phoneRaw);
        setLeadVinculado(null);
        setMostrarBotaoCriarLead(true);
        return;
      }
      
      console.log('📞 [LEAD] Buscando lead com variações de telefone:', {
        variations,
        companyId: userRole.company_id
      });

      // MELHORIA 3: Buscar lead por telefone exato e variações
      const phoneConditions = variations
        .map(v => `phone.eq.${v},telefone.eq.${v}`)
        .join(',');
      
      const { data: existingLead, error } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', userRole.company_id)
        .or(phoneConditions)
        .maybeSingle();

      // MELHORIA 6: Logs detalhados para debug
      if (error && error.code !== 'PGRST116') {
        console.error('❌ [LEAD] Erro ao buscar lead:', {
          error,
          phoneConditions,
          variations,
          companyId: userRole.company_id
        });
      }

      if (existingLead) {
        console.log('✅ [LEAD] Lead vinculado encontrado:', {
          leadId: existingLead.id,
          leadName: existingLead.name,
          phoneMatched: existingLead.phone || existingLead.telefone,
          searchedVariations: variations.length
        });

        setLeadVinculado(existingLead);
        setMostrarBotaoCriarLead(false);
        
        // MELHORIA 5: Atualizar mapeamento de leads vinculados com todas as variações
        const phoneKey = conversation.phoneNumber || conversation.id;
        const formatted = safeFormatPhoneNumber(phoneKey);
        setLeadsVinculados(prev => {
          const newMap = { ...prev };
          // Adicionar todas as variações ao mapeamento
          variations.forEach(v => {
            newMap[v] = existingLead.id;
          });
          newMap[phoneKey] = existingLead.id;
          if (formatted) {
            newMap[formatted] = existingLead.id;
          }
          return newMap;
        });
        
        console.log('✅ [LEAD] Mapeamento de leads vinculados atualizado');
      } else {
        console.log('ℹ️ [LEAD] Nenhum lead vinculado encontrado para este contato:', {
          phoneNormalized,
          variations: variations.length
        });
        setLeadVinculado(null);
        setMostrarBotaoCriarLead(true);
      }
    } catch (error) {
      console.error('❌ [LEAD] Erro ao verificar lead vinculado:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversation: {
          id: conversation.id,
          contactName: conversation.contactName,
          phoneNumber: conversation.phoneNumber
        }
      });
      setLeadVinculado(null);
      setMostrarBotaoCriarLead(false);
    }
  };

  // Função para criar lead manualmente
  const criarLeadManualmente = async () => {
    if (!selectedConv) return;
    
    try {
      setSyncStatus('syncing');
      const lead = await findOrCreateLead(selectedConv);
      
      if (lead) {
        // CORREÇÃO: setLeadVinculado deve receber o objeto lead, não true
        setLeadVinculado(lead);
        setMostrarBotaoCriarLead(false);
        
        // Atualizar mapeamento de leads vinculados
        const phoneKey = selectedConv.phoneNumber || selectedConv.id;
        const formatted = safeFormatPhoneNumber(phoneKey);
        setLeadsVinculados(prev => ({
          ...prev,
          [phoneKey]: lead.id,
          ...(formatted ? { [formatted]: lead.id } : {})
        }));
        
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 2000);
      }
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const handleEditName = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const novoNome = prompt("Digite o novo nome do contato:", conv.contactName);
    if (!novoNome || novoNome.trim() === "") return;

    try {
      // Atualizar no Supabase (contatos: por telefone_formatado; grupos: por numero JID)
      const isGroup = /@g\.us$/.test(String(conv.id));
      const numeroNormalizado = isGroup ? null : normalizePhoneForWA(conv.phoneNumber || conv.id);
      const query = supabase
        .from('conversas')
        .update({ nome_contato: novoNome.trim() })
        .eq('company_id', userCompanyId);
      const { error } = await (isGroup
        ? query.eq('numero', conv.id)
        : query.eq('telefone_formatado', numeroNormalizado!));

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
        setTimeout(() => setSyncStatus('idle'), 1000);
        toast.success(`Lead ${conv.contactName} criado com sucesso!`);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 2000);
        toast.error("Erro ao criar lead");
      }
    } catch (error) {
      console.error('Erro ao criar lead:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 2000);
      toast.error("Erro ao criar lead");
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const confirmar = window.confirm(`Tem certeza que deseja excluir a conversa com ${conv.contactName}?`);
    if (!confirmar) return;

    try {
      // Deletar no Supabase (contatos: por telefone_formatado; grupos: por numero JID)
      const isGroup = /@g\.us$/.test(String(conv.id));
      const numeroNormalizado = isGroup ? null : normalizePhoneForWA(conv.phoneNumber || conv.id);
      const base = supabase
        .from('conversas')
        .delete()
        .eq('company_id', userCompanyId);
      const { error } = await (isGroup
        ? base.eq('numero', conv.id)
        : base.eq('telefone_formatado', numeroNormalizado!));

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

  // ✅ REMOVIDO: Declaração duplicada de filteredConversations (já existe na linha 459 com useMemo)

  const openConversationWithContact = (name: string, phone: string) => {
    const normalized = normalizePhoneForWA(phone);
    const existente = conversations.find(c => c.id === normalized || c.phoneNumber === normalized);
    if (existente) {
      setSelectedConv(existente);
      toast.success('Conversa aberta');
      return;
    }
    const novaConversa: Conversation = {
      id: normalized || phone || Date.now().toString(),
      contactName: name || 'Contato',
      channel: 'whatsapp',
      status: 'waiting',
      lastMessage: 'Nova conversa',
      unread: 0,
      messages: [],
      tags: [],
      phoneNumber: normalized || phone,
    };
    const updated = [novaConversa, ...conversations];
    setConversations(updated);
    setSelectedConv(novaConversa);
    saveConversations(updated);
    toast.success(`Conversa com ${name} criada`);
  };

  // Utilitário: garantir company_id e enviar via Edge Function
  const getCompanyId = async (): Promise<string | null> => {
    if (userCompanyId) return userCompanyId;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (userRole?.company_id) setUserCompanyId(userRole.company_id);
    return userRole?.company_id || null;
  };

  const enviarWhatsApp = async (body: any) => {
    const companyId = await getCompanyId();
    // Usar wrapper com retry/timeout e retornar no formato compatível (data/error)
    const result = await sendWhatsAppWithRetry({
      company_id: companyId,
      ...body,
    });
    if (result && result.success) {
      return { data: result, error: null } as const;
    }
    return { data: result, error: { message: result?.message || 'Falha ao enviar mensagem' } } as const;
  };

  // Normaliza destino: preserva JID de grupo (@g.us). Para contatos, mantém apenas dígitos com prefixo 55.
  const normalizePhoneForWA = (raw: string | undefined | null): string => {
    const value = String(raw || '');
    if (/@g\.us$/.test(value)) return value; // grupo
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return digits.startsWith('55') ? digits : `55${digits}`;
  };

  const finalizarAtendimento = async (mensagem: string) => {
    if (!selectedConv) return;
    try {
      // Enviar mensagem de finalização
      const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
      const { data, error } = await enviarWhatsApp({
        numero: numeroNormalizado,
        mensagem,
        tipo_mensagem: 'text',
      });
      if (error || !data?.success) {
        // Wrapper já exibiu o toast de erro específico
        return;
      }

      // Persistir no histórico
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem,
        origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
        status: 'Enviada',
        tipo_mensagem: 'text',
        nome_contato: selectedConv.contactName,
        company_id: userRole?.company_id,
      }]);

      // Atualizar estados para resolvido
      const updatedConv: Conversation = { ...selectedConv, status: 'resolved', lastMessage: mensagem };
      const updatedList = conversations.map(c => c.id === selectedConv.id ? updatedConv : c);
      saveConversations(updatedList);
      setConversations(updatedList);
      setSelectedConv(updatedConv);
      toast.success('Atendimento finalizado e mensagem enviada');
    } catch (e) {
      console.error('❌ Erro ao finalizar atendimento:', e);
      toast.error('Erro ao finalizar atendimento');
    }
  };

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar esquerda - tema cinza claro */}
      <div className="w-[380px] bg-muted/30 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 bg-background border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Conversas</h1>
            <div className="flex gap-2 items-center">
              {/* MELHORIA: Indicador visual de status de conexão realtime */}
              <div 
                className="flex items-center px-2 py-1 rounded-md"
                title={
                  realtimeConnectionStatus === 'connected' 
                    ? 'Conectado ao servidor em tempo real' 
                    : realtimeConnectionStatus === 'connecting'
                    ? `Reconectando... (tentativa ${realtimeReconnectAttempts})`
                    : realtimeConnectionStatus === 'error'
                    ? 'Erro na conexão - tentando reconectar'
                    : 'Desconectado'
                }
              >
                {realtimeConnectionStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : realtimeConnectionStatus === 'connecting' ? (
                  <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                ) : realtimeConnectionStatus === 'error' ? (
                  <WifiOff className="h-4 w-4 text-red-500" />
                ) : (
                  <WifiOff className="h-4 w-4 text-gray-400" />
                )}
              </div>
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
                size="icon" 
                variant="outline"
                onClick={() => {
                  console.log('🔄 Botão Recarregar clicado');
                  loadSupabaseConversations();
                  toast.success('Recarregando conversas...');
                }}
                className="gap-0"
                aria-label="Recarregar"
              >
                <RefreshCw className="h-4 w-4" />
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
              className="relative"
            >
              Aguardando
              {waitingCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="ml-2 bg-red-500 hover:bg-red-600 text-white min-w-[20px] h-5 px-1.5 flex items-center justify-center"
                >
                  {waitingCount}
                </Badge>
              )}
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
            <Button
              variant={filter === "group" ? "default" : "ghost"}
              size="sm"
              onClick={() => setFilter("group")}
            >
              Grupos
            </Button>
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando conversas...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
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
              onClick={async () => {
                console.log('🔍 Conversa selecionada:', conv.id, 'Mensagens:', conv.messages.length);
                
                // CORREÇÃO: Garantir que userCompanyId está disponível antes de usar
                if (!userCompanyId) {
                  const { data: userRole } = await supabase
                    .from('user_roles')
                    .select('company_id')
                    .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                    .maybeSingle();
                  
                  if (userRole?.company_id) {
                    setUserCompanyId(userRole.company_id);
                  }
                }
                
                // Marcar mensagens como lidas e visualizadas
                // CRÍTICO: Preservar avatarUrl ao atualizar
                const updatedConv = {
                  ...conv,
                  unread: 0,
                  avatarUrl: conv.avatarUrl, // Garantir que avatar não seja perdido
                  messages: conv.messages.map(msg => ({
                    ...msg,
                    read: true
                  }))
                };
                
                console.log('📸 [AVATAR-DEBUG] Selecionando conversa:', {
                  id: conv.id,
                  name: conv.contactName,
                  avatarUrl: conv.avatarUrl?.substring(0, 50)
                });
                
                setSelectedConv(updatedConv);
                
                // 📜 Carregar histórico completo automaticamente
                if (conv.phoneNumber && userCompanyId) {
                  const stats = historyStats[conv.phoneNumber];
                  // Se não tem stats ou tem poucas mensagens carregadas, buscar histórico
                  if (!stats || conv.messages.length < 20) {
                    loadFullConversationHistory(conv.phoneNumber, conv.contactName);
                  }
                }
                
                // Verificar se existe lead vinculado
                verificarLeadVinculado(conv);
                
                // Atualizar estado e localStorage - CRÍTICO: Preservar avatars
                const updated = conversations.map(c => 
                  c.id === conv.id ? updatedConv : { ...c, avatarUrl: c.avatarUrl }
                );
                setConversations(updated); // Atualizar estado React
                saveConversations(updated); // Salvar no localStorage
                
                console.log('📸 [AVATAR-DEBUG] Conversas atualizadas, avatars preservados:', {
                  total: updated.length,
                  comAvatar: updated.filter(c => c.avatarUrl).length
                });
                
                // Persistir no Supabase: marcar mensagens recebidas como 'Lida'
                try {
                  const isGroup = /@g\.us$/.test(String(conv.id));
                  const numeroNormalizado = isGroup ? null : normalizePhoneForWA(conv.phoneNumber || conv.id);
                  // CORREÇÃO: Buscar company_id corretamente
                  let companyIdToUse = userCompanyId;
                  
                  if (!companyIdToUse) {
                    const { data: userRole } = await supabase
                      .from('user_roles')
                      .select('company_id')
                      .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
                      .maybeSingle();
                    companyIdToUse = userRole?.company_id || null;
                    
                    if (companyIdToUse) {
                      setUserCompanyId(companyIdToUse);
                    }
                  }
                  
                  if (companyIdToUse) {
                    const base = supabase
                      .from('conversas')
                      .update({ status: 'Lida' })
                      .eq('company_id', companyIdToUse)
                      .eq('status', 'Recebida');
                    await (isGroup 
                      ? base.eq('numero', conv.id)
                      : base.eq('telefone_formatado', numeroNormalizado!));
                  }
                } catch (err) {
                  console.error('Erro ao marcar mensagens como lidas no Supabase:', err);
                }
                
                // Mostrar toast de visualizado
                if (conv.unread > 0) {
                  toast.success('✔️ Mensagens visualizadas');
                }
              }}
            />
          ))
          )}
          
          {/* ⚡ Botão Carregar Mais Conversas */}
          {!loadingConversations && filteredConversations.length > 0 && hasMoreConversations && (
            <div className="p-4 flex justify-center">
              <Button
                variant="outline"
                onClick={async () => {
                  setLoadingMore(true);
                  await loadSupabaseConversations(true); // Append mode
                  setLoadingMore(false);
                }}
                disabled={loadingMore}
                className="w-full"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Carregando mais...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Carregar Mais Conversas ({conversationsLimit} por vez)
                  </>
                )}
              </Button>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
              mostrarBotaoCriarLead={mostrarBotaoCriarLead}
              onCriarLead={criarLeadManualmente}
              onFinalizeAtendimento={finalizarAtendimento}
              onlineStatus={onlineStatus[selectedConv.id] || 'unknown'}
              isContactInactive={isContactInactive}
              onRestoreConversation={handleRestoreConversation}
              restoringConversation={restoringConversation}
            />

            <div className="flex flex-1 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-6 bg-[#e5ddd5]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}>
                  {/* Indicador de histórico */}
                  {selectedConv.phoneNumber && historyStats[selectedConv.phoneNumber] && (
                    <div className="flex justify-center mb-4">
                      <Badge variant="secondary" className="gap-2">
                        📜 {historyStats[selectedConv.phoneNumber].loaded} mensagens do histórico
                      </Badge>
                    </div>
                  )}
                  {loadingHistory && (
                    <div className="flex justify-center items-center gap-2 mb-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Carregando histórico completo...</span>
                    </div>
                  )}
                  
                  <div className="space-y-2 min-h-[200px]">
                     {selectedConv.messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        Nenhuma mensagem ainda
                      </div>
                     ) : (
                      selectedConv.messages.map((msg) => (
                        <MessageItem
                          key={msg.id}
                          message={msg as any}
                          allMessages={selectedConv.messages as any}
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
                          isTranscribing={transcriptionStatuses[msg.id] === "processing"}
                          transcriptionStatus={msg.transcriptionStatus}
                          onRetryTranscribe={msg.transcriptionStatus === "error" ? () => transcreverAudio(msg.id, msg.mediaUrl!, true) : undefined}
                          onReply={handleReply}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onReact={handleReact}
                          onOpenContactConversation={openConversationWithContact}
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
                    <MediaUpload onFileSelected={handleSendMedia as any} />
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
                <div className="w-[340px] bg-background border-l border-border flex flex-col overflow-hidden">
                  <div className="p-6 space-y-6 flex-1 overflow-y-auto">
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
                        {leadVinculado ? (
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
                            <TrendingUp className="h-3 w-3 mr-2" /> 
                            {leadVinculado && leadVinculado.funil_id ? "Mover de Funil" : "Adicionar ao Funil"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              {leadVinculado && leadVinculado.funil_id ? "Mover Lead de Funil" : "Adicionar ao Funil"}
                            </DialogTitle>
                            <p className="text-sm text-muted-foreground mt-1">
                              Selecione o funil de vendas e a etapa para {leadVinculado && leadVinculado.funil_id ? "mover" : "adicionar"} este lead
                            </p>
                          </DialogHeader>
                          
                          {/* Informação do funil atual */}
                          {leadVinculado && leadVinculado.funil_id && (
                            <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-primary" />
                                <p className="text-sm font-semibold text-primary">Posição Atual do Lead</p>
                              </div>
                              <div className="pl-6 space-y-1.5">
                                <div>
                                  <p className="text-xs text-muted-foreground">Funil:</p>
                                  <p className="text-sm font-medium text-foreground">
                                    📊 {funis.find(f => f.id === leadVinculado.funil_id)?.nome || "Funil não encontrado"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Etapa:</p>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2.5 h-2.5 rounded-full" 
                                      style={{ 
                                        backgroundColor: etapas.find(e => e.id === leadVinculado.etapa_id)?.cor || '#3b82f6' 
                                      }}
                                    />
                                    <p className="text-sm font-medium text-foreground">
                                      {etapas.find(e => e.id === leadVinculado.etapa_id)?.nome || "Etapa não definida"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6 pt-1">
                                💡 Selecione um novo funil/etapa abaixo para mover o lead
                              </p>
                            </div>
                          )}
                          
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
                                        {leadVinculado?.funil_id === funil.id && (
                                          <span className="text-xs text-primary ml-2 font-medium">
                                            (Atual)
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
                                          {leadVinculado?.etapa_id === etapa.id && (
                                            <span className="text-xs text-primary ml-2 font-medium">
                                              (Atual)
                                            </span>
                                          )}
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
                            {leadVinculado && leadVinculado.funil_id ? "Mover Lead" : "Adicionar Lead"}
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
                                {/* Botão para criar nova mensagem */}
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button className="w-full">
                                      <Plus className="h-4 w-4 mr-2" />
                                      Criar Nova Mensagem
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Criar Nova Mensagem</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3">
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
                                  </DialogContent>
                                </Dialog>

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
                              {scheduledMessages.filter(m => m.status === 'pending').length > 0 && (
                                <Badge variant="secondary" className="ml-auto">
                                  {scheduledMessages.filter(m => m.status === 'pending').length}
                                </Badge>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>⏰ Agendar Mensagem WhatsApp</DialogTitle>
                              <p className="text-sm text-muted-foreground mt-1">
                                Programe mensagens para serem enviadas automaticamente
                              </p>
                            </DialogHeader>
                            
                            <Tabs defaultValue="agendar" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="agendar">Agendar Nova</TabsTrigger>
                                <TabsTrigger value="historico">
                                  Histórico 
                                  ({scheduledMessages.length})
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="agendar" className="space-y-4">
                                <div className="space-y-3">
                                  <div className="space-y-2">
                                    <Label>Mensagem *</Label>
                                    <Textarea
                                      value={scheduledContent}
                                      onChange={(e) => setScheduledContent(e.target.value)}
                                      placeholder="Digite a mensagem que será enviada..."
                                      rows={4}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Data e Hora *</Label>
                                    <Input
                                      type="datetime-local"
                                      value={scheduledDatetime}
                                      onChange={(e) => setScheduledDatetime(e.target.value)}
                                      min={new Date().toISOString().slice(0, 16)}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      ⚡ Agende para qualquer momento futuro - sem tempo mínimo!
                                    </p>
                                    <p className="text-xs text-primary/70">
                                      💡 Pode agendar para daqui a 5 minutos, 1 hora, ou dias
                                    </p>
                                  </div>
                                  <Button onClick={scheduleMessage} className="w-full">
                                    <Clock className="h-4 w-4 mr-2" />
                                    Agendar Envio
                                  </Button>
                                </div>
                              </TabsContent>

                              <TabsContent value="historico" className="space-y-4">
                                {scheduledMessages.length === 0 ? (
                                  <div className="text-center py-12 text-muted-foreground">
                                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>Nenhuma mensagem agendada</p>
                                    <p className="text-xs mt-1">
                                      Agende mensagens na aba "Agendar Nova"
                                    </p>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {scheduledMessages.map((msg) => (
                                      <div
                                        key={msg.id}
                                        className={`p-3 border rounded-lg ${
                                          msg.status === 'sent' ? 'bg-green-50 border-green-200' :
                                          msg.status === 'failed' ? 'bg-red-50 border-red-200' :
                                          'bg-background'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                              {msg.status === 'pending' && (
                                                <Badge variant="outline" className="text-xs">
                                                  ⏳ Aguardando
                                                </Badge>
                                              )}
                                              {msg.status === 'sent' && (
                                                <Badge variant="default" className="text-xs bg-green-600">
                                                  ✓ Enviada
                                                </Badge>
                                              )}
                                              {msg.status === 'failed' && (
                                                <Badge variant="destructive" className="text-xs">
                                                  ✗ Falha
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-sm font-medium break-words">
                                              {msg.message_content}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                              <span>
                                                📅 {new Date(msg.scheduled_datetime).toLocaleString('pt-BR')}
                                              </span>
                                              {msg.status === 'pending' && (
                                                <span className="text-primary font-medium">
                                                  <CountdownTimer targetDate={msg.scheduled_datetime} />
                                                </span>
                                              )}
                                              {msg.status === 'sent' && msg.sent_at && (
                                                <span className="text-green-600">
                                                  Enviado em {new Date(msg.sent_at).toLocaleString('pt-BR')}
                                                </span>
                                              )}
                                            </div>
                                            {msg.error_message && (
                                              <p className="text-xs text-destructive mt-1">
                                                Erro: {msg.error_message}
                                              </p>
                                            )}
                                          </div>
                                          {msg.status === 'pending' && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => cancelarMensagemAgendada(msg.id)}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </TabsContent>
                            </Tabs>
                          </DialogContent>
                        </Dialog>

                        {/* Schedule Reminder */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start">
                              <Bell className="h-4 w-4 mr-2" /> Gerenciar Lembretes
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Lembretes do Lead</DialogTitle>
                            </DialogHeader>
                            
                            <Tabs defaultValue="criar" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="criar">Criar Novo</TabsTrigger>
                                <TabsTrigger value="historico">
                                  Histórico ({reminders.length})
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="criar" className="space-y-4">
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
                                <Button 
                                  onClick={async () => {
                                    // CORREÇÃO: Garantir lead antes de criar lembrete
                                    if (!leadVinculado?.id && selectedConv) {
                                      setSyncStatus('syncing');
                                      const lead = await findOrCreateLead(selectedConv);
                                      if (lead) {
                                        setLeadVinculado(lead);
                                        setMostrarBotaoCriarLead(false);
                                        const phoneKey = selectedConv.phoneNumber || selectedConv.id;
                                        const formatted = safeFormatPhoneNumber(phoneKey);
                                        setLeadsVinculados(prev => ({
                                          ...prev,
                                          [phoneKey]: lead.id,
                                          ...(formatted ? { [formatted]: lead.id } : {})
                                        }));
                                        toast.success('Lead vinculado automaticamente!');
                                      }
                                      setSyncStatus('idle');
                                    }
                                    await addReminder();
                                  }} 
                                  className="w-full"
                                  disabled={!reminderTitle.trim() || !reminderDatetime}
                                >
                                  Criar Lembrete
                                </Button>
                              </TabsContent>

                              <TabsContent value="historico" className="space-y-4">
                                <ScrollArea className="h-[400px]">
                                  {reminders.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                      <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                      <p>Nenhum lembrete criado</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {reminders.map((lembrete) => (
                                        <Card key={lembrete.id} className={`border-l-4 ${
                                          lembrete.status_envio === 'enviado' ? 'border-l-green-500' :
                                          lembrete.status_envio === 'pendente' ? 'border-l-yellow-500' :
                                          'border-l-red-500'
                                        }`}>
                                          <CardContent className="pt-4">
                                            <div className="space-y-2">
                                              <div className="flex justify-between items-start">
                                                <div className="space-y-1 flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                      {lembrete.compromisso?.tipo_servico || 'Lembrete'}
                                                    </span>
                                                    <Badge variant={
                                                      lembrete.status_envio === 'enviado' ? 'default' :
                                                      lembrete.status_envio === 'pendente' ? 'secondary' :
                                                      'destructive'
                                                    }>
                                                      {lembrete.status_envio === 'enviado' ? '✓ Enviado' :
                                                       lembrete.status_envio === 'pendente' ? '⏳ Pendente' :
                                                       '✗ Erro'}
                                                    </Badge>
                                                  </div>
                                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {lembrete.compromisso?.data_hora_inicio && 
                                                      format(parseISO(lembrete.compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                                    }
                                                  </p>
                                                  <p className="text-sm text-muted-foreground">
                                                    <strong>Destinatário:</strong> {
                                                      lembrete.destinatario === 'lead' ? 'Lead' :
                                                      lembrete.destinatario === 'responsavel' ? 'Responsável' :
                                                      lembrete.destinatario === 'ambos' ? 'Lead e Responsável' :
                                                      'Lead'
                                                    }
                                                  </p>
                                                  <p className="text-sm text-muted-foreground">
                                                    <strong>Canal:</strong> {lembrete.canal.toUpperCase()} | 
                                                    <strong> Antecedência:</strong> {lembrete.horas_antecedencia}h
                                                  </p>
                                                  {lembrete.data_envio && (
                                                    <p className="text-xs text-muted-foreground">
                                                      {lembrete.status_envio === 'enviado' ? 'Enviado em: ' : 'Última tentativa: '}
                                                      {format(parseISO(lembrete.data_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                    </p>
                                                  )}
                                                  {lembrete.mensagem && (
                                                    <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                                                      {lembrete.mensagem}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </ScrollArea>
                              </TabsContent>
                            </Tabs>
                          </DialogContent>
                        </Dialog>

                        {/* Compromissos e Reuniões */}
                        <Dialog open={reunioesDialogOpen} onOpenChange={setReunioesDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start"
                              onClick={async () => {
                                // CORREÇÃO: Criar lead automaticamente ao abrir o modal
                                if (!leadVinculado?.id && selectedConv) {
                                  setSyncStatus('syncing');
                                  const lead = await findOrCreateLead(selectedConv);
                                  if (lead) {
                                    setLeadVinculado(lead);
                                    setMostrarBotaoCriarLead(false);
                                    const phoneKey = selectedConv.phoneNumber || selectedConv.id;
                                    const formatted = safeFormatPhoneNumber(phoneKey);
                                    setLeadsVinculados(prev => ({
                                      ...prev,
                                      [phoneKey]: lead.id,
                                      ...(formatted ? { [formatted]: lead.id } : {})
                                    }));
                                    toast.success('Lead vinculado automaticamente!');
                                  }
                                  setSyncStatus('idle');
                                }
                                setReunioesDialogOpen(true);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-2" /> Compromissos
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Reuniões e Compromissos</DialogTitle>
                            </DialogHeader>
                            
                            <Tabs defaultValue="criar" className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="criar">Agendar Nova</TabsTrigger>
                                <TabsTrigger value="historico">
                                  Histórico ({meetings.length})
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="criar" className="space-y-4">
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
                                <Button 
                                  onClick={async () => {
                                    // CORREÇÃO: Garantir lead antes de agendar
                                    if (!leadVinculado?.id && selectedConv) {
                                      setSyncStatus('syncing');
                                      const lead = await findOrCreateLead(selectedConv);
                                      if (lead) {
                                        setLeadVinculado(lead);
                                        setMostrarBotaoCriarLead(false);
                                        const phoneKey = selectedConv.phoneNumber || selectedConv.id;
                                        const formatted = safeFormatPhoneNumber(phoneKey);
                                        setLeadsVinculados(prev => ({
                                          ...prev,
                                          [phoneKey]: lead.id,
                                          ...(formatted ? { [formatted]: lead.id } : {})
                                        }));
                                        toast.success('Lead vinculado automaticamente!');
                                      }
                                      setSyncStatus('idle');
                                    }
                                    await scheduleMeeting();
                                  }} 
                                  className="w-full"
                                  disabled={!meetingTitle.trim() || !meetingDatetime}
                                >
                                  Agendar Reunião
                                </Button>
                              </TabsContent>

                              <TabsContent value="historico" className="space-y-4">
                                <ScrollArea className="h-[400px]">
                                  {meetings.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                      <p>Nenhuma reunião agendada</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {meetings.map((meeting) => (
                                        <Card key={meeting.id} className={`border-l-4 ${
                                          meeting.status === 'concluido' ? 'border-l-green-500' :
                                          meeting.status === 'agendado' ? 'border-l-blue-500' :
                                          'border-l-red-500'
                                        }`}>
                                          <CardContent className="pt-4">
                                            <div className="space-y-2">
                                              <div className="flex justify-between items-start">
                                                <div className="space-y-1 flex-1">
                                                  <div className="flex items-center gap-2">
                                                    <span className="font-medium">
                                                      {meeting.tipo_servico}
                                                    </span>
                                                    <Badge variant={
                                                      meeting.status === 'concluido' ? 'default' :
                                                      meeting.status === 'agendado' ? 'secondary' :
                                                      'destructive'
                                                    }>
                                                      {meeting.status === 'concluido' ? '✓ Concluído' :
                                                       meeting.status === 'agendado' ? '📅 Agendado' :
                                                       '✗ Cancelado'}
                                                    </Badge>
                                                  </div>
                                                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {format(parseISO(meeting.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                                    {' - '}
                                                    {format(parseISO(meeting.data_hora_fim), "HH:mm", { locale: ptBR })}
                                                  </p>
                                                  {meeting.lead && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                      <User className="h-3 w-3" />
                                                      {meeting.lead.name}
                                                    </p>
                                                  )}
                                                  {meeting.custo_estimado && (
                                                    <p className="text-sm text-muted-foreground">
                                                      <strong>Valor:</strong> R$ {meeting.custo_estimado.toFixed(2)}
                                                    </p>
                                                  )}
                                                  {meeting.observacoes && (
                                                    <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted rounded">
                                                      {meeting.observacoes}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </ScrollArea>
                              </TabsContent>
                            </Tabs>
                          </DialogContent>
                        </Dialog>

                        {/* Tarefas do Lead */}
                        <Dialog open={tarefasDialogOpen} onOpenChange={setTarefasDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              className="w-full justify-start"
                              onClick={async () => {
                                // CORREÇÃO: Criar lead automaticamente ao abrir o modal
                                if (!leadVinculado?.id && selectedConv) {
                                  setSyncStatus('syncing');
                                  const lead = await findOrCreateLead(selectedConv);
                                  if (lead) {
                                    setLeadVinculado(lead);
                                    setMostrarBotaoCriarLead(false);
                                    const phoneKey = selectedConv.phoneNumber || selectedConv.id;
                                    const formatted = safeFormatPhoneNumber(phoneKey);
                                    setLeadsVinculados(prev => ({
                                      ...prev,
                                      [phoneKey]: lead.id,
                                      ...(formatted ? { [formatted]: lead.id } : {})
                                    }));
                                    toast.success('Lead vinculado automaticamente!');
                                  }
                                  setSyncStatus('idle');
                                }
                                setTarefasDialogOpen(true);
                              }}
                              type="button"
                            >
                              <CheckSquare className="h-4 w-4 mr-2" /> Tarefas
                              {leadTasks.length > 0 && (
                                <Badge variant="secondary" className="ml-auto">
                                  {leadTasks.filter(t => t.status !== 'concluida').length}
                                </Badge>
                              )}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Tarefas do Lead</DialogTitle>
                            </DialogHeader>

                            <Tabs defaultValue="criar" value={tarefasTabValue} onValueChange={setTarefasTabValue} className="w-full">
                              <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="criar">Criar Nova</TabsTrigger>
                                <TabsTrigger value="historico">
                                  Histórico ({leadTasks.length})
                                </TabsTrigger>
                              </TabsList>

                              <TabsContent value="criar" className="space-y-4">
                                {!leadVinculado?.id ? (
                                  <div className="text-center py-8 text-muted-foreground">
                                    <CheckSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="mb-4">O lead será criado automaticamente ao abrir este modal.</p>
                                    <Button 
                                      onClick={async () => {
                                        if (selectedConv) {
                                          setSyncStatus('syncing');
                                          const lead = await findOrCreateLead(selectedConv);
                                          if (lead) {
                                            setLeadVinculado(lead);
                                            setMostrarBotaoCriarLead(false);
                                            const phoneKey = selectedConv.phoneNumber || selectedConv.id;
                                            const formatted = safeFormatPhoneNumber(phoneKey);
                                            setLeadsVinculados(prev => ({
                                              ...prev,
                                              [phoneKey]: lead.id,
                                              ...(formatted ? { [formatted]: lead.id } : {})
                                            }));
                                            toast.success('Lead criado! Você pode criar tarefas agora.');
                                            await carregarTarefasDoLead(lead.id);
                                          }
                                          setSyncStatus('idle');
                                        }
                                      }}
                                      variant="default"
                                    >
                                      Criar Lead Agora
                                    </Button>
                                  </div>
                                ) : (
                                  <>
                                    {taskBoards.length > 0 && (
                                      <div>
                                        <Label>Quadro</Label>
                                        <Select
                                          value={selectedTaskBoardId}
                                          onValueChange={(value) => {
                                            setSelectedTaskBoardId(value);
                                            setSelectedTaskColumnId("");
                                          }}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecione o quadro" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {taskBoards.map((board) => (
                                              <SelectItem key={board.id} value={board.id}>
                                                {board.nome}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    {selectedTaskBoardId && taskColumns.filter(c => c.board_id === selectedTaskBoardId).length > 0 && (
                                      <div>
                                        <Label>Etapa</Label>
                                        <Select
                                          value={selectedTaskColumnId}
                                          onValueChange={setSelectedTaskColumnId}
                                        >
                                          <SelectTrigger>
                                            <SelectValue placeholder="Selecione a etapa" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {taskColumns
                                              .filter(c => c.board_id === selectedTaskBoardId)
                                              .map((column) => (
                                                <SelectItem key={column.id} value={column.id}>
                                                  {column.nome}
                                                </SelectItem>
                                              ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )}

                                    <div>
                                      <Label>Título *</Label>
                                      <Input
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        placeholder="Ex: Enviar proposta comercial"
                                      />
                                    </div>
                                    <div>
                                      <Label>Descrição</Label>
                                      <Textarea
                                        value={newTaskDescription}
                                        onChange={(e) => setNewTaskDescription(e.target.value)}
                                        placeholder="Detalhes da tarefa..."
                                        rows={2}
                                      />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
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
                                      <div>
                                        <Label>Data de Vencimento</Label>
                                        <Input
                                          type="date"
                                          value={newTaskDueDate}
                                          onChange={(e) => setNewTaskDueDate(e.target.value)}
                                        />
                                      </div>
                                    </div>
                                    <Button 
                                      type="button"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        
                                        if (!leadVinculado?.id && selectedConv) {
                                          setSyncStatus('syncing');
                                          const lead = await findOrCreateLead(selectedConv);
                                          if (lead) {
                                            setLeadVinculado(lead);
                                            setMostrarBotaoCriarLead(false);
                                            const phoneKey = selectedConv.phoneNumber || selectedConv.id;
                                            const formatted = safeFormatPhoneNumber(phoneKey);
                                            setLeadsVinculados(prev => ({
                                              ...prev,
                                              [phoneKey]: lead.id,
                                              ...(formatted ? { [formatted]: lead.id } : {})
                                            }));
                                            toast.success('Lead vinculado automaticamente!');
                                          }
                                          setSyncStatus('idle');
                                        }
                                        await criarTarefaDoLead();
                                      }} 
                                      className="w-full"
                                      disabled={!newTaskTitle.trim()}
                                    >
                                      Criar Tarefa
                                    </Button>
                                  </>
                                )}
                              </TabsContent>

                              <TabsContent value="historico" className="space-y-4">
                                <ScrollArea className="h-[400px]">
                                  {(() => {
                                    console.log('📋 [TAREFAS] Renderizando histórico. Total de tarefas:', leadTasks.length, 'Tarefas:', leadTasks.map(t => ({ id: t.id, title: t.title, lead_id: t.lead_id })));
                                    return null;
                                  })()}
                                  {leadTasks.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                      <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                      <p>Nenhuma tarefa criada</p>
                                      <p className="text-xs mt-2">Lead ID: {leadVinculado?.id || 'N/A'}</p>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {leadTasks.map((task) => {
                                        console.log('📋 [TAREFAS] Renderizando tarefa:', task.id, task.title, 'Lead_id:', task.lead_id);
                                        return (
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
                                        );
                                      })}
                                    </div>
                                  )}
                                </ScrollArea>
                              </TabsContent>
                            </Tabs>
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
                            <div className="space-y-3">
                              {/* Filas */}
                              {queues.length > 0 && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium">Filas</h4>
                                  {queues.map((q) => (
                                    <Button
                                      key={q.id}
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() => assignConversationToQueue(q.id, q.name)}
                                    >
                                      📥 {q.name}
                                    </Button>
                                  ))}
                                  {/* Selecionar fila para ver membros */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Ver membros da fila:</span>
                                    <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Selecione uma fila" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {queues.map((q) => (
                                          <SelectItem key={`sel-${q.id}`} value={q.id}>{q.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}

                              {/* Agentes */}
                              <div className="space-y-2">
                                <h4 className="text-sm font-medium">Agentes</h4>
                                {companyUsers
                                  .filter(u => u.name !== selectedConv.responsavel)
                                  .map((user) => (
                                <Button 
                                  key={user.id}
                                  variant="outline" 
                                  className="w-full justify-start"
                                  onClick={() => assignConversationToUser(user.id, user.name)}
                                >
                                  {user.name}
                                </Button>
                                ))}
                              </div>

                              {/* Membros da fila selecionada */}
                              {selectedQueueId && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium">Membros da Fila</h4>
                                  {queueMembers.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Nenhum membro na fila selecionada.</p>
                                  ) : (
                                    queueMembers.map((m) => (
                                      <Button
                                        key={`m-${m.id}`}
                                        variant="outline"
                                        className="w-full justify-start"
                                        onClick={() => assignConversationToUser(m.id, m.name)}
                                      >
                                        👤 {m.name}
                                      </Button>
                                    ))
                                  )}
                                </div>
                              )}
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

      {/* Modais de Agenda e Tarefa com lead pré-selecionado */}
      {leadVinculado && selectedConv && (
        <>
          <AgendaModal
            open={agendaModalOpen}
            onOpenChange={setAgendaModalOpen}
            lead={{
              id: leadVinculado.id,
              nome: leadVinculado.name || selectedConv.contactName,
              telefone: leadVinculado.phone || leadVinculado.telefone || selectedConv.phoneNumber,
            }}
            onAgendamentoCriado={() => {
              setAgendaModalOpen(false);
              loadMeetings();
              toast.success('Compromisso criado e vinculado ao lead!');
            }}
          />

          <TarefaModal
            open={tarefaModalOpen}
            onOpenChange={setTarefaModalOpen}
            lead={{
              id: leadVinculado.id,
              nome: leadVinculado.name || selectedConv.contactName,
            }}
            onTarefaCriada={() => {
              setTarefaModalOpen(false);
              if (leadVinculado?.id) {
                carregarTarefasDoLead(leadVinculado.id);
              }
              toast.success('Tarefa criada e vinculada ao lead!');
            }}
          />
        </>
      )}
    </div>
  );
}

export default Conversas;
