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
import { Switch } from "@/components/ui/switch";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  MessageSquare, Instagram, Facebook, Send, Search, Bot, User, Paperclip, 
  Clock, Calendar, Zap, FileText, Tag, TrendingUp, ArrowRightLeft, Image as ImageIcon,
  Mic, FileUp, Check, CheckCheck, Phone, Video, Info, DollarSign, Users, Bell, Download, Volume2,
  RefreshCw, CheckCircle2, AlertCircle, Reply, CheckSquare, X, Plus, Trash2, Loader2
} from "lucide-react";
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
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
import { EditarLeadDialog } from "@/components/funil/EditarLeadDialog";
import { ResponsaveisManager } from "@/components/conversas/ResponsaveisManager";
import { AgendaModal } from "@/components/agenda/AgendaModal";
import { TarefaModal } from "@/components/tarefas/TarefaModal";
import { formatPhoneNumber, safeFormatPhoneNumber } from "@/utils/phoneFormatter";
import { cleanAllConversationsHistory } from "@/utils/cleanConversationsHistory";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { useConversationsCache } from "@/hooks/useConversationsCache";
import { usePermissions } from "@/hooks/usePermissions";
import { useTagsManager } from "@/hooks/useTagsManager";
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
  type?: "text" | "image" | "video"; // Tipo de mensagem
  mediaUrl?: string; // URL base64 da mídia
  fileName?: string; // Nome do arquivo
  mimeType?: string; // Tipo MIME do arquivo
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
const CACHE_MAX_AGE = 10 * 60 * 1000; // Cache válido por 10 minutos (aumentado para melhor performance)

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
  const { isAdmin } = usePermissions();
  const { allTags, refreshTags } = useTagsManager();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null); // Declarar primeiro
  
  // ⚡ CARREGAMENTO INSTANTÂNEO: Hook carrega do cache em 0 segundos
  const { 
    conversations: cachedConversations, 
    isLoading: cacheLoading,
    syncConversations,
    updateConversation: updateCachedConversation,
    addMessage: addCachedMessage
  } = useConversationsCache(userCompanyId);

  // ⚡ CARREGAR FOTOS DE PERFIL de forma assíncrona para todas as conversas
  useEffect(() => {
    if (!userCompanyId || cachedConversations.length === 0) return;

    const loadAvatars = async () => {
      const conversationsWithAvatars = await Promise.all(
        cachedConversations.map(async (conv) => {
          // Se já tem foto real (não é placeholder), não recarregar
          if (conv.avatarUrl && !conv.avatarUrl.includes('ui-avatars.com')) {
            return conv;
          }

          const phoneNumber = conv.phoneNumber || conv.id;
          const profilePic = await getProfilePictureWithFallback(phoneNumber, userCompanyId, conv.contactName);
          
          return {
            ...conv,
            avatarUrl: profilePic || conv.avatarUrl
          };
        })
      );

      setConversations(conversationsWithAvatars);
    };

    loadAvatars();
  }, [cachedConversations, userCompanyId]);
  
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
  const [cleanHistoryDialogOpen, setCleanHistoryDialogOpen] = useState(false);
  const [cleaningHistory, setCleaningHistory] = useState(false);
  
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
    
    console.log('🔄 [SEND-WHATSAPP-RETRY] Iniciando envio (tentativa 1):', {
      company_id: body.company_id,
      numero: body.numero,
      temMensagem: !!body.mensagem
    });
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [SEND-WHATSAPP-RETRY] Tentativa ${attempt}/${maxRetries} - Chamando edge function...`, {
          body: {
            company_id: body.company_id,
            numero: body.numero,
            tipo_mensagem: body.tipo_mensagem,
            temMensagem: !!body.mensagem
          }
        });
        
        // ⚡ CORREÇÃO: Adicionar timeout explícito para evitar travamento
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout após 30 segundos')), 30000);
        });
        
        const functionPromise = supabase.functions.invoke('enviar-whatsapp', { body });
        
        console.log(`⏳ [SEND-WHATSAPP-RETRY] Aguardando resposta da edge function...`);
        const res: any = await Promise.race([functionPromise, timeoutPromise]);
        console.log(`📥 [SEND-WHATSAPP-RETRY] Resposta recebida!`);
        
        console.log(`📥 [SEND-WHATSAPP-RETRY] Resposta da edge function (tentativa ${attempt}):`, {
          hasData: !!res?.data,
          hasError: !!res?.error,
          status: res?.status,
          dataSuccess: res?.data?.success,
          dataError: res?.data?.error,
          dataCode: res?.data?.code
        });
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
        if (data?.success) {
          console.log('✅ [SEND-WHATSAPP-RETRY] Mensagem enviada com sucesso!');
          return { success: true };
        }
        // Falha desconhecida
        console.error('❌ [SEND-WHATSAPP-RETRY] Falha desconhecida. Resposta:', data);
        toast.error('Falha desconhecida ao enviar mensagem.');
        return { success: false };
      } catch (err: any) {
        const errorMessage = err?.message || String(err);
        console.error(`❌ [SEND-WHATSAPP-RETRY] Exceção na tentativa ${attempt}:`, {
          error: errorMessage,
          isTimeout: errorMessage.includes('Timeout'),
          attempt,
          maxRetries
        });
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`⏳ [SEND-WHATSAPP-RETRY] Aguardando ${delay}ms antes de tentar novamente...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        
        // Se foi timeout, mensagem específica
        if (errorMessage.includes('Timeout')) {
          toast.error('Timeout ao enviar mensagem. A conexão pode estar lenta. Tente novamente.');
        } else {
          toast.error(`Erro de rede ao enviar mensagem: ${errorMessage}`);
        }
        return { success: false, errorCode: 'NETWORK_ERROR', message: errorMessage };
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

  // ✅ FILTROS CORRIGIDOS: Implementação conforme especificação do usuário
  const filteredConversations = useMemo(() => {
    console.log('🔍 [DEBUG] Filtrando conversas:', {
      total: conversations.length,
      filtro: filter,
      busca: debouncedSearchTerm
    });
    
    let filtered = conversations;

    // Aplicar filtro de status conforme especificação
    if (filter === "all") {
      // ✅ Filtro "Todos": Mostrar TODAS as conversas (individuais e grupos)
      filtered = filtered; // Não filtrar nada - mostrar tudo
    } else if (filter === "group") {
      // ✅ Filtro "Grupos": Mostrar APENAS grupos
      filtered = filtered.filter((conv) => conv.isGroup === true);
    } else if (filter === "waiting") {
      // ✅ Filtro "Aguardando": Contatos que enviaram mensagem e ainda não foram respondidos
      // Critérios: última mensagem é do contato (sender === 'contact') + não está finalizada
      filtered = filtered.filter((conv) => {
        if (conv.isGroup === true) return false; // Excluir grupos
        if (conv.status === 'resolved') return false; // Excluir finalizadas
        
        // Verificar se a última mensagem é do contato (aguardando resposta)
        const lastMessage = conv.messages?.[conv.messages.length - 1];
        if (!lastMessage) return false;
        
        // ✅ Se última mensagem é do contato = aguardando resposta
        return lastMessage.sender === 'contact';
      });
    } else if (filter === "answered") {
      // ✅ Filtro "Respondidos": Conversas que estavam aguardando e foram respondidas
      // Critérios: última mensagem é do usuário (sender === 'user') + não está finalizada
      // Quando responder uma conversa que estava em "aguardando", ela vai IMEDIATAMENTE para "respondidos"
      filtered = filtered.filter((conv) => {
        if (conv.isGroup === true) return false; // Excluir grupos
        if (conv.status === 'resolved') return false; // Excluir finalizadas
        
        // Verificar se a última mensagem é do usuário (foi respondida)
        const lastMessage = conv.messages?.[conv.messages.length - 1];
        if (!lastMessage) return false;
        
        // ✅ Se última mensagem é do usuário = foi respondida
        return lastMessage.sender === 'user';
      });
    } else if (filter === "resolved") {
      // ✅ Filtro "Finalizados": Conversas marcadas como finalizadas com o botão "Finalizar atendimento"
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

    // ⚡ CORREÇÃO CRÍTICA: REMOVER limite de exibição - todas as conversas devem ser exibidas
    // Todas as conversas do WhatsApp precisam aparecer no CRM
    return filtered; // Removido .slice(0, conversationsLimit) para exibir TODAS as conversas
  }, [conversations, filter, debouncedSearchTerm]);

  // Mensagens exibidas: sempre refletir state atual da conversa selecionada (evitar cache obsoleto)
  // ⚡ CORREÇÃO: Não limitar mensagens exibidas - mostrar todas para preservar histórico
  const displayedMessages = useMemo(() => {
    if (!selectedConv) return [];
    const messages = selectedConv.messages || [];
    // ⚡ CORREÇÃO CRÍTICA: Mostrar TODAS as mensagens, não limitar
    // O limite de 50 era para performance, mas estava fazendo mensagens desaparecerem
    return messages; // Remover .slice(-messagesLimit) para preservar histórico completo
  }, [selectedConv?.id, selectedConv?.messages]);

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

  // ⚡ CORREÇÃO: Carregar TODAS as conversas, não apenas 50
  const loadInitialConversations = useCallback(async () => {
    try {
      // ⚡ CORREÇÃO CRÍTICA: Remover limite - carregar TODAS as conversas do WhatsApp
      const { data, error } = await supabase
        .from('conversas')
        .select('*')
        .eq('company_id', userCompanyId || '')
        .order('created_at', { ascending: false })
        // REMOVIDO: .limit(50) - agora carrega TODAS as conversas

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

  // ⚡ SINCRONIZAÇÃO INSTANTÂNEA: Atualizar conversas do cache imediatamente (0 segundos)
  useEffect(() => {
    if (cachedConversations.length > 0) {
      console.log(`⚡ [INSTANT] ${cachedConversations.length} conversas carregadas instantaneamente do cache`);
      setConversations(cachedConversations);
    }
  }, [cachedConversations]);

  // Form states
  const [newQuickTitle, setNewQuickTitle] = useState("");
  const [newQuickContent, setNewQuickContent] = useState("");
  const [newQuickCategory, setNewQuickCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newQuickMessageType, setNewQuickMessageType] = useState<"text" | "image" | "video">("text");
  const [newQuickMediaFile, setNewQuickMediaFile] = useState<File | null>(null);
  const [newQuickMediaPreview, setNewQuickMediaPreview] = useState<string | null>(null);
  // Estados para edição
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editMessageTitle, setEditMessageTitle] = useState("");
  const [editMessageContent, setEditMessageContent] = useState("");
  const [editMessageCategory, setEditMessageCategory] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editMessageType, setEditMessageType] = useState<"text" | "image" | "video">("text");
  const [editMessageMediaFile, setEditMessageMediaFile] = useState<File | null>(null);
  const [editMessageMediaPreview, setEditMessageMediaPreview] = useState<string | null>(null);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDatetime, setReminderDatetime] = useState("");
  const [reminderNotes, setReminderNotes] = useState("");
  const [scheduledContent, setScheduledContent] = useState("");
  const [scheduledDatetime, setScheduledDatetime] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDatetime, setMeetingDatetime] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [enviarConfirmacaoReuniao, setEnviarConfirmacaoReuniao] = useState(true); // ⚡ Enviar confirmação por padrão
  const [enviarLembreteReuniao, setEnviarLembreteReuniao] = useState(true); // ⚡ Enviar lembrete por padrão
  const [horasAntecedenciaReuniaoHoras, setHorasAntecedenciaReuniaoHoras] = useState("1"); // ⚡ 1 hora padrão
  const [horasAntecedenciaReuniaoMinutos, setHorasAntecedenciaReuniaoMinutos] = useState("0"); // ⚡ 0 minutos padrão
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

  // ⚡ CORREÇÃO: Verificar e atualizar lead vinculado quando a conversa selecionada mudar
  useEffect(() => {
    if (selectedConv && userCompanyId) {
      verificarLeadVinculado(selectedConv);
    } else {
      setLeadVinculado(null);
      setMostrarBotaoCriarLead(false);
    }
  }, [selectedConv?.id, userCompanyId]);

  // ⚡ CORREÇÃO: Atualizar informações do funil quando funis/etapas forem carregados e lead estiver vinculado
  useEffect(() => {
    if (leadVinculado?.funil_id && funis.length > 0 && etapas.length > 0) {
      const etapaInfo = leadVinculado.etapa_id ? etapas.find(e => e.id === leadVinculado.etapa_id) : null;
      const funilInfo = funis.find(f => f.id === leadVinculado.funil_id);
      
      console.log('📊 [FUNIL] Verificando exibição do funil:', {
        leadVinculado: !!leadVinculado,
        funil_id: leadVinculado.funil_id,
        etapa_id: leadVinculado.etapa_id,
        funilInfo: funilInfo?.nome || 'não encontrado',
        etapaInfo: etapaInfo?.nome || 'não encontrado',
        funisCarregados: funis.length,
        etapasCarregadas: etapas.length
      });
      
      if (funilInfo && selectedConv) {
        // Atualizar conversa selecionada com informações do funil
        if (etapaInfo) {
          setSelectedConv(prev => prev ? {
            ...prev,
            funnelStage: etapaInfo.nome
          } : null);
        }
      }
    }
  }, [funis, etapas, leadVinculado?.funil_id, leadVinculado?.etapa_id, selectedConv?.id]);

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

  // 🔑 CRÍTICO: Carregar company_id PRIMEIRO (otimizado para ser mais rápido)
  useEffect(() => {
    console.log('🚀 Componente Conversas montado');
    
    const carregarDadosIniciais = async () => {
      try {
        // ⚡ OTIMIZAÇÃO: Tentar usar sessão existente primeiro (mais rápido)
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        if (!userId) {
          // Fallback: buscar usuário se sessão não estiver disponível
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            console.error('❌ Usuário não autenticado');
            return;
          }
          
          // Buscar company_id
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('company_id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (userRole?.company_id) {
            console.log('🏢 Company ID carregado:', userRole.company_id);
            setUserCompanyId(userRole.company_id);
            userCompanyIdRef.current = userRole.company_id;
          }
          
          // Buscar perfil
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", user.id)
            .maybeSingle();
          
          if (profile) {
            setUserName(profile.full_name || profile.email);
            console.log('👤 Usuário logado:', profile.full_name || profile.email);
          }
          return;
        }
        
        // ⚡ OTIMIZAÇÃO: Buscar company_id e perfil em paralelo (mais rápido)
        const [userRoleResult, profileResult] = await Promise.all([
          supabase
            .from('user_roles')
            .select('company_id')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", userId)
            .maybeSingle()
        ]);

        if (userRoleResult.data?.company_id) {
          console.log('🏢 Company ID carregado:', userRoleResult.data.company_id);
          setUserCompanyId(userRoleResult.data.company_id);
          userCompanyIdRef.current = userRoleResult.data.company_id;
        } else {
          console.error('❌ Erro: Usuário sem empresa associada');
          toast.error('Erro: Usuário sem empresa associada');
        }
        
        if (profileResult.data) {
          setUserName(profileResult.data.full_name || profileResult.data.email);
          console.log('👤 Usuário logado:', profileResult.data.full_name || profileResult.data.email);
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
    
    // ⚡ CORREÇÃO: Carregar tags na inicialização
    refreshTags();
  }, [refreshTags]); // ⚡ Executar apenas uma vez no mount

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
          console.warn('⚠️ [REALTIME] Dados inválidos: faltam campos obrigatórios', {
            id: data.id,
            numero: data.numero,
            telefone_formatado: data.telefone_formatado
          });
          return false;
        }
        const isGroup = Boolean((data as any)?.is_group) || /@g\.us$/.test(String(data.numero || ''));
        if (!isGroup) {
          const numeroPadrao = data.telefone_formatado || data.numero || '';
          const numeroE164 = normalizePhoneForWA(numeroPadrao);
          const somenteDigitos = numeroE164.replace(/[^0-9]/g, '');
          // ⚡ CORREÇÃO: Aceitar números de 10 a 13 dígitos (mais flexível para disparo em massa)
          // Números brasileiros podem ter 10 (fixo) ou 11 (celular) dígitos + 55 = 12 ou 13
          // Mas também aceitar números sem 55 para compatibilidade
          if (somenteDigitos.length < 10 || somenteDigitos.length > 13) {
            console.warn('⚠️ [REALTIME] Número de telefone inválido:', {
              original: numeroPadrao,
              normalizado: numeroE164,
              digitos: somenteDigitos,
              tamanho: somenteDigitos.length
            });
            return false;
          }
        }
        // ⚡ CORREÇÃO CRÍTICA: Aceitar TODAS as mensagens válidas, mesmo com caracteres especiais
        // Não bloquear mensagens por causa de placeholders ou variáveis - isso pode estar bloqueando mensagens legítimas
        if (data.mensagem && typeof data.mensagem === 'string') {
          // Bloquear apenas mensagens que são claramente objetos não serializados
          if (data.mensagem === '[object Object]') {
            console.warn('⚠️ [REALTIME] Mensagem é objeto não serializado');
            return false;
          }
          // Aceitar todas as outras mensagens, mesmo com {{ ou outros caracteres especiais
        }
        return true;
      } catch (error) {
        console.error('❌ [REALTIME] Erro ao validar dados:', error);
        return false;
      }
    };

    // ⚡ CORREÇÃO CRÍTICA: SEM debounce para garantir sincronização em tempo real
    // Especialmente importante para disparos em massa
    const debouncedUpdate = (updateFn: () => void | Promise<void>, delay: number = 0, isFromMe: boolean = false) => {
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      // ⚡ CORREÇÃO: Delay 0 para sincronização instantânea
      const finalDelay = 0;
      debounceTimeoutRef.current = setTimeout(async () => {
        const now = Date.now();
        // Permitir atualizações mais frequentes
        const minInterval = 0;
        if (now - lastUpdateTimeRef.current < minInterval) {
          console.log('⏱️ [REALTIME] Atualização ignorada (muito frequente)', { isFromMe });
          return;
        }
        lastUpdateTimeRef.current = now;
        await updateFn();
      }, finalDelay);
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
      // ⚡ CORREÇÃO CRÍTICA: Escutar TODOS os eventos (INSERT e UPDATE) para sincronização total
      // Não usar filtros no realtime - processar todas as mensagens e filtrar por company_id no código
      // Isso garante que nenhuma mensagem seja perdida
      const channel = supabase.channel(`conversas_realtime_${userCompanyIdRef.current}_${Date.now()}`)
        .on('postgres_changes', {
          event: '*', // Escutar INSERT, UPDATE e DELETE
          schema: 'public', 
          table: 'conversas'
          // ⚡ CRÍTICO: NÃO usar filter aqui - pode causar perda de mensagens
          // O filtro por company_id será feito no código após receber o evento
        }, async (payload) => {
          try {
            const eventType = payload.eventType;
            const recordId = (payload.new as any)?.id || (payload.old as any)?.id;
            const payloadCompanyId = (payload.new as any)?.company_id;
            const payloadFromMe = (payload.new as any)?.fromme;
            const payloadTelefone = (payload.new as any)?.telefone_formatado || (payload.new as any)?.numero;
            
            // ⚡ CORREÇÃO CRÍTICA: Log detalhado para debug de mensagens não aparecendo
            const isReceived = payloadFromMe === false || !payloadFromMe;
            console.log(`📩 [REALTIME] Evento detectado: ${eventType}`, { 
              id: recordId,
              timestamp: new Date().toISOString(),
              company_id: payloadCompanyId,
              userCompanyId: userCompanyIdRef.current,
              fromme: payloadFromMe,
              isReceivedMessage: isReceived,
              telefone_formatado: payloadTelefone,
              status: (payload.new as any)?.status,
              mensagem: (payload.new as any)?.mensagem?.substring(0, 50)
            });
            
            // ⚡ CORREÇÃO: Log específico para mensagens recebidas
            if (isReceived && eventType === 'INSERT') {
              console.log('📥 [REALTIME] ⚠️ MENSAGEM RECEBIDA DETECTADA!', {
                id: recordId,
                telefone: payloadTelefone,
                mensagem: (payload.new as any)?.mensagem?.substring(0, 50),
                company_id: payloadCompanyId,
                userCompanyId: userCompanyIdRef.current
              });
            }
            
            // ⚡ CORREÇÃO CRÍTICA: Para mensagens RECEBIDAS, NUNCA ignorar por company_id
            // Verificar se é mensagem recebida antes de filtrar por empresa
            // payloadFromMe já foi declarado acima na linha 1939
            const isReceivedPayload = payloadFromMe === false || !payloadFromMe;
            
            // ⚡ CORREÇÃO: Apenas filtrar mensagens ENVIADAS de outra empresa
            // Mensagens RECEBIDAS devem sempre ser processadas
            if (payloadCompanyId && payloadCompanyId !== userCompanyIdRef.current) {
              if (!isReceivedPayload) {
                // Mensagem enviada de outra empresa - ignorar (segurança)
                console.log('⏭️ [REALTIME] Mensagem ENVIADA de outra empresa, ignorando:', {
                  payloadCompanyId,
                  userCompanyId: userCompanyIdRef.current
                });
                return;
              } else {
                // Mensagem RECEBIDA de outra empresa - processar mesmo assim
                console.warn('⚠️ [REALTIME] Mensagem RECEBIDA de outra empresa, mas processando mesmo assim:', {
                  payloadCompanyId,
                  userCompanyId: userCompanyIdRef.current
                });
                // Continuar processamento - não retornar
              }
            }
            
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
              
              if (!novaConversa) {
                console.warn('⚠️ [REALTIME] Conversa não encontrada no banco');
                return;
              }
              
              // ⚡ CORREÇÃO: Log detalhado antes da validação para debug
              console.log('🔍 [REALTIME] Validando dados:', {
                id: novaConversa.id,
                fromme: novaConversa.fromme,
                telefone_formatado: novaConversa.telefone_formatado,
                numero: novaConversa.numero,
                mensagem: novaConversa.mensagem?.substring(0, 50),
                company_id: novaConversa.company_id,
                userCompanyId: userCompanyIdRef.current
              });
              
              // ⚡ CORREÇÃO CRÍTICA: Log detalhado antes da validação para mensagens recebidas
              // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta
              const isReceivedMessage = novaConversa.fromme === false || String(novaConversa.fromme) === 'false' || novaConversa.fromme === null || novaConversa.fromme === undefined;
              if (isReceivedMessage) {
                console.log('📥 [REALTIME] Mensagem RECEBIDA detectada:', {
                  id: novaConversa.id,
                  fromme: novaConversa.fromme,
                  telefone: novaConversa.telefone_formatado || novaConversa.numero,
                  mensagem: novaConversa.mensagem?.substring(0, 50),
                  company_id: novaConversa.company_id
                });
              }
              
              if (!validateRealtimeData(novaConversa)) {
                console.warn('⚠️ [REALTIME] Dados inválidos ignorados após validação:', {
                  id: novaConversa.id,
                  fromme: novaConversa.fromme,
                  numero: novaConversa.numero,
                  telefone_formatado: novaConversa.telefone_formatado,
                  mensagem: novaConversa.mensagem?.substring(0, 50)
                });
                return;
              }
              
              console.log('✅ [REALTIME] Dados validados com sucesso, processando...', {
                isReceived: isReceivedMessage,
                fromme: novaConversa.fromme
              });
              
              // ⚡ CORREÇÃO CRÍTICA: Para mensagens RECEBIDAS, SEMPRE processar independente de company_id
              // Remover filtro restritivo que estava bloqueando mensagens recebidas
              const isReceivedMsg = novaConversa.fromme === false || !novaConversa.fromme;
              
              if (novaConversa.company_id) {
                // Se tem company_id, verificar se corresponde ao usuário atual
                if (novaConversa.company_id !== userCompanyIdRef.current) {
                  // ⚡ CORREÇÃO: Para mensagens RECEBIDAS, processar mesmo se for de outra empresa
                  // Isso garante que mensagens recebidas nunca sejam perdidas
                  if (isReceivedMsg) {
                    console.warn('⚠️ [REALTIME] Mensagem recebida de outra empresa, mas processando mesmo assim:', {
                      conversaCompanyId: novaConversa.company_id,
                      userCompanyId: userCompanyIdRef.current
                    });
                    // Continuar processamento - não bloquear mensagens recebidas
                  } else {
                    // Para mensagens enviadas, manter filtro de segurança
                    console.warn('⚠️ [REALTIME] Mensagem enviada de outra empresa ignorada:', {
                      conversaCompanyId: novaConversa.company_id,
                      userCompanyId: userCompanyIdRef.current
                    });
                    return;
                  }
                }
              } else if (userCompanyIdRef.current) {
                // ⚡ CORREÇÃO: Se não tem company_id mas temos userCompanyId, aceitar e processar
                // Isso garante que mensagens sem company_id sejam processadas
                console.log('⚠️ [REALTIME] Conversa sem company_id, usando empresa do usuário:', userCompanyIdRef.current);
                // Continuar processamento - não bloquear
              } else {
                // ⚡ CORREÇÃO: Para mensagens recebidas, NUNCA bloquear mesmo sem company_id
                if (isReceivedMsg) {
                  console.warn('⚠️ [REALTIME] Mensagem recebida sem company_id, mas processando mesmo assim');
                  // Continuar processamento - não bloquear mensagens recebidas
                } else {
                  // Apenas bloquear mensagens enviadas sem company_id
                  console.warn('⚠️ [REALTIME] Não é possível processar mensagem enviada: sem company_id e sem userCompanyId');
                  return;
                }
              }
              
              // ⚡ CORREÇÃO: Processar TODAS as mensagens (enviadas e recebidas) para garantir sincronização
              // Não ignorar mensagens enviadas pelo usuário, pois podem vir de outros dispositivos ou precisar sincronização
              
              // ⚡ CORREÇÃO: Usar debounce mais curto para mensagens enviadas (disparo em massa)
              const isFromMe = novaConversa.fromme === true;
              console.log('📨 [REALTIME] Processando mensagem:', {
                id: novaConversa.id,
                fromme: isFromMe,
                telefone: novaConversa.telefone_formatado || novaConversa.numero,
                mensagem: novaConversa.mensagem?.substring(0, 50)
              });
              
              // ⚡ CORREÇÃO CRÍTICA: Executar IMEDIATAMENTE sem debounce
              // ⚡ CORREÇÃO: Capturar isReceivedMessage ANTES do debouncedUpdate para evitar erro de inicialização
              const isReceivedMessageForUpdate = novaConversa.fromme === false || !novaConversa.fromme;
              
              debouncedUpdate(async () => {
                console.log('⚡ [REALTIME] Processando mensagem IMEDIATAMENTE');
                // ⚡ CORREÇÃO: Usar variável capturada do escopo externo
                const isReceivedMessageLocal = isReceivedMessageForUpdate;
                const isGroup = Boolean((novaConversa as any)?.is_group) || /@g\.us$/.test(String(novaConversa.numero || ''));
                // ⚡ CORREÇÃO CRÍTICA: Usar telefone_formatado diretamente se disponível (já normalizado)
                // Se não tiver, normalizar o numero. Garantir consistência com disparo em massa
                let telefoneNormalizado: string;
                
                console.log('🔍 [REALTIME] Iniciando processamento:', {
                  isReceived: isReceivedMessageLocal,
                  numero: novaConversa.numero,
                  telefone_formatado: novaConversa.telefone_formatado,
                  isGroup: isGroup
                });
                if (isGroup) {
                  telefoneNormalizado = String(novaConversa.numero);
                } else if (novaConversa.telefone_formatado) {
                  // Se já tem telefone_formatado, usar diretamente (já está normalizado)
                  // Mas garantir que tenha prefixo 55 se necessário
                  const telefoneLimpo = novaConversa.telefone_formatado.replace(/[^0-9]/g, '');
                  telefoneNormalizado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;
                  console.log('📞 [REALTIME] Telefone normalizado do banco:', {
                    original: novaConversa.telefone_formatado,
                    limpo: telefoneLimpo,
                    final: telefoneNormalizado,
                    fromme: novaConversa.fromme
                  });
                } else {
                  // Se não tem telefone_formatado, normalizar o numero
                  telefoneNormalizado = normalizePhoneForWA(novaConversa.numero);
                  console.log('📞 [REALTIME] Telefone normalizado do numero:', {
                    numero: novaConversa.numero,
                    normalizado: telefoneNormalizado,
                    fromme: novaConversa.fromme
                  });
                }
                
                const { data: leadVinculadoRealtime } = await supabase.from('leads')
                  .select('name')
                  .or(`phone.eq.${telefoneNormalizado},telefone.eq.${telefoneNormalizado}`)
                  .maybeSingle();
                  
                const nomeValido = leadVinculadoRealtime?.name || (novaConversa.nome_contato && novaConversa.nome_contato.trim() !== '' && novaConversa.nome_contato !== novaConversa.numero ? novaConversa.nome_contato : novaConversa.numero);
                let profilePic: string | undefined;
                try { profilePic = await getProfilePictureWithFallback(novaConversa.numero, userCompanyIdRef.current || '', nomeValido || String(novaConversa.numero)); } catch {}
                const numeroLimpo = String(novaConversa.numero || '').replace(/\D/g, '');
                const isRealGroup = Boolean((novaConversa as any)?.is_group) || (numeroLimpo.length >= 17 && /@g\.us$/.test(String(novaConversa.numero || '')));
                // ⚡ CORREÇÃO CRÍTICA: Para grupos, garantir que id e phoneNumber usem o numero (JID do grupo)
                // Nunca usar telefone_formatado para grupos, pois pode conter número do integrante
                const idParaGrupo = isRealGroup ? String(novaConversa.numero) : telefoneNormalizado;
                const phoneNumberParaGrupo = isRealGroup ? String(novaConversa.numero) : telefoneNormalizado;
                
                // ⚡ CORREÇÃO CRÍTICA: Status deve ser 'answered' se mensagem foi enviada pelo usuário (disparo em massa)
                const statusInicial = (novaConversa.fromme === true) ? 'answered' as const : 'waiting' as const;
                
                const novaConvFormatted: Conversation = {
                  id: idParaGrupo, 
                  contactName: nomeValido,
                  avatarUrl: profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(nomeValido)}&background=10b981&color=fff`,
                  channel: 'whatsapp' as const, 
                  status: statusInicial, 
                  isGroup: isRealGroup,
                  messages: [{
                    id: novaConversa.id, content: novaConversa.mensagem,
                    // ✅ CORREÇÃO CRÍTICA: Usar APENAS fromme para determinar lado da mensagem
                    // fromme === true ou 'true' → sender: "user" (lado direito)
                    // fromme === false, 'false', null, undefined → sender: "contact" (lado esquerdo)
                    sender: (novaConversa.fromme === true || String(novaConversa.fromme) === 'true') ? 'user' : 'contact',
                    timestamp: new Date(novaConversa.created_at), delivered: true,
                    type: (novaConversa.tipo_mensagem === 'audio' ? 'audio' : novaConversa.tipo_mensagem === 'image' ? 'image' : novaConversa.tipo_mensagem === 'video' ? 'video' : novaConversa.tipo_mensagem === 'pdf' || (novaConversa.tipo_mensagem === 'document' && novaConversa.mensagem?.includes('[Documento:')) ? 'pdf' : novaConversa.tipo_mensagem === 'document' ? 'document' : 'text') as Message["type"],
                    mediaUrl: novaConversa.midia_url, fileName: novaConversa.arquivo_nome
                  }],
                  lastMessage: novaConversa.mensagem,
                  unread: (novaConversa.fromme === true) ? 0 : 1,
                  tags: [], 
                  phoneNumber: phoneNumberParaGrupo // ⚡ CORREÇÃO: Usar numero do grupo para grupos
                };
                // ⚡ CORREÇÃO: Verificar se a conversa está aberta ANTES de atualizar
                const isOpen = !!(selectedConvRef.current && (
                  selectedConvRef.current.id === idParaGrupo ||
                  selectedConvRef.current.phoneNumber === phoneNumberParaGrupo ||
                  (isRealGroup && selectedConvRef.current.id === String(novaConversa.numero)) ||
                  (isRealGroup && selectedConvRef.current.phoneNumber === String(novaConversa.numero))
                ));
                
                let conversaAtualizada: Conversation | null = null;
                
                setConversations(prev => {
                  console.log('🔍 [REALTIME] INICIANDO busca de conversa existente:', {
                    isReceived: isReceivedMessageLocal,
                    telefoneNormalizado,
                    numeroOriginal: novaConversa.numero,
                    telefoneFormatado: novaConversa.telefone_formatado,
                    isGroup: isRealGroup,
                    idParaGrupo,
                    phoneNumberParaGrupo,
                    totalConversas: prev.length,
                    conversasIds: prev.map(c => ({ id: c.id, phone: c.phoneNumber }))
                  });
                  
                  // ⚡ CORREÇÃO CRÍTICA: Busca mais flexível para garantir agrupamento correto
                  // Normalizar números para comparação (remover caracteres não numéricos e garantir prefixo 55)
                  const normalizeForComparison = (num: string | undefined | null): string => {
                    if (!num) return '';
                    const digits = String(num).replace(/[^0-9]/g, '');
                    return digits.startsWith('55') ? digits : `55${digits}`;
                  };
                  
                  const telefoneComparacao = normalizeForComparison(telefoneNormalizado);
                  const numeroComparacao = normalizeForComparison(novaConversa.numero);
                  const telefoneFormatadoComparacao = normalizeForComparison(novaConversa.telefone_formatado);
                  
                  // ⚡ LOG: Debug de busca de conversa existente
                  console.log('🔍 [REALTIME] Buscando conversa existente:', {
                    isReceived: isReceivedMessageLocal,
                    telefoneNormalizado,
                    numeroOriginal: novaConversa.numero,
                    telefoneFormatado: novaConversa.telefone_formatado,
                    telefoneComparacao,
                    numeroComparacao,
                    telefoneFormatadoComparacao,
                    isGroup: isRealGroup,
                    idParaGrupo,
                    phoneNumberParaGrupo,
                    totalConversas: prev.length
                  });
                  
                  // ⚡ CORREÇÃO CRÍTICA: Busca ULTRA flexível para garantir que SEMPRE encontre a conversa
                  // Para grupos, buscar pelo numero (JID do grupo), não pelo telefone_formatado
                  // Para contatos, buscar por QUALQUER variação possível do número
                  const existingIndex = prev.findIndex(c => {
                    if (isRealGroup) {
                      // Grupos: comparar pelo JID completo
                      return c.id === idParaGrupo || 
                             c.phoneNumber === phoneNumberParaGrupo ||
                             c.id === String(novaConversa.numero) ||
                             c.phoneNumber === String(novaConversa.numero);
                    } else {
                      // ⚡ CORREÇÃO CRÍTICA: Busca ULTRA flexível para contatos
                      // Normalizar TODOS os números possíveis para comparação
                      const cIdNormalizado = normalizeForComparison(c.id);
                      const cPhoneNormalizado = normalizeForComparison(c.phoneNumber);
                      
                      // Criar lista de TODAS as variações possíveis do número recebido
                      const todasVariacoes = [
                        telefoneComparacao,
                        numeroComparacao,
                        telefoneFormatadoComparacao,
                        normalizeForComparison(telefoneNormalizado),
                        normalizeForComparison(novaConversa.numero),
                        normalizeForComparison(novaConversa.telefone_formatado)
                      ].filter(v => v && v.length >= 10); // Remover vazias ou muito curtas
                      
                      // Criar lista de TODAS as variações possíveis da conversa existente
                      const todasVariacoesConversa = [
                        cIdNormalizado,
                        cPhoneNormalizado,
                        normalizeForComparison(c.id),
                        normalizeForComparison(c.phoneNumber)
                      ].filter(v => v && v.length >= 10);
                      
                      // Verificar se QUALQUER variação do número recebido corresponde a QUALQUER variação da conversa
                      const match = todasVariacoes.some(vRecebido => 
                        todasVariacoesConversa.some(vConversa => vRecebido === vConversa)
                      ) || 
                      // Fallback: comparações diretas
                      c.id === idParaGrupo || 
                      c.phoneNumber === phoneNumberParaGrupo ||
                      cIdNormalizado === telefoneComparacao ||
                      cPhoneNormalizado === telefoneComparacao ||
                      cIdNormalizado === numeroComparacao ||
                      cPhoneNormalizado === numeroComparacao ||
                      cIdNormalizado === telefoneFormatadoComparacao ||
                      cPhoneNormalizado === telefoneFormatadoComparacao;
                      
                      if (match && isReceivedMessageLocal) {
                        console.log('✅ [REALTIME] Conversa existente encontrada para mensagem recebida:', {
                          conversaId: c.id,
                          conversaPhone: c.phoneNumber,
                          conversaIdNormalizado: cIdNormalizado,
                          conversaPhoneNormalizado: cPhoneNormalizado,
                          telefoneComparacao,
                          numeroComparacao,
                          todasVariacoes,
                          todasVariacoesConversa
                        });
                      }
                      
                      return match;
                    }
                  });
                  
                  if (existingIndex === -1 && isReceivedMessageLocal) {
                    console.warn('⚠️ [REALTIME] Conversa NÃO encontrada para mensagem recebida!', {
                      telefoneNormalizado,
                      numeroOriginal: novaConversa.numero,
                      telefoneFormatado: novaConversa.telefone_formatado,
                      telefoneComparacao,
                      numeroComparacao,
                      telefoneFormatadoComparacao,
                      conversasExistentes: prev.map(c => ({
                        id: c.id,
                        phoneNumber: c.phoneNumber,
                        idNormalizado: normalizeForComparison(c.id),
                        phoneNormalizado: normalizeForComparison(c.phoneNumber)
                      }))
                    });
                  }
                  
                  if (existingIndex >= 0) {
                    // Conversa já existe - adicionar mensagem ao histórico
                    const updated = [...prev];
                    const conversaExistente = updated[existingIndex];
                    
                    // ⚡ CORREÇÃO MELHORADA: Verificar duplicatas de forma mais inteligente
                    const novaMensagem = novaConvFormatted.messages[0];
                    const mensagemJaExiste = conversaExistente.messages.some(m => {
                      // Verificar por ID (mensagens do banco)
                      if (m.id === novaMensagem.id) {
                        return true;
                      }
                      // ⚡ CORREÇÃO CRÍTICA: Para mensagens enviadas pelo usuário, verificar duplicatas
                      // por conteúdo + timestamp mesmo quando IDs são diferentes (ID temporário vs ID real)
                      if (novaConversa.fromme === true) {
                        const mesmoConteudo = m.content.trim() === novaMensagem.content.trim();
                        const diffMs = Math.abs(new Date(m.timestamp).getTime() - new Date(novaMensagem.timestamp).getTime());
                        // Aumentar janela para 30 segundos para capturar mensagens que foram adicionadas localmente
                        // e depois chegaram via realtime com ID diferente
                        if (mesmoConteudo && diffMs < 30000) {
                          console.log('🔍 [REALTIME] Duplicata detectada por conteúdo+timestamp (mensagem enviada)', {
                            idLocal: m.id,
                            idBanco: novaMensagem.id,
                            conteudo: m.content.substring(0, 30),
                            diffMs
                          });
                          return true;
                        }
                        // Verificar também se o ID local é temporário (começa com "temp_") e o conteúdo é igual
                        if (m.id.startsWith('temp_') && mesmoConteudo && diffMs < 30000) {
                          console.log('🔍 [REALTIME] Duplicata detectada: ID temporário local vs ID real do banco');
                          return true;
                        }
                      }
                      return false;
                    });
                    
                    if (mensagemJaExiste) {
                      console.log('⏭️ [REALTIME] Mensagem já existe, atualizando versão do banco se necessário');
                      // Se já existe, pode ser uma mensagem local que precisa ser atualizada com ID do banco
                      const mensagemIndex = conversaExistente.messages.findIndex(m => 
                        m.id === novaMensagem.id || 
                        (m.content.trim() === novaMensagem.content.trim() && 
                         Math.abs(new Date(m.timestamp).getTime() - new Date(novaMensagem.timestamp).getTime()) < 30000) ||
                        (m.id.startsWith('temp_') && m.content.trim() === novaMensagem.content.trim() && 
                         Math.abs(new Date(m.timestamp).getTime() - new Date(novaMensagem.timestamp).getTime()) < 30000)
                      );
                      
                      if (mensagemIndex >= 0) {
                        const mensagemExistente = conversaExistente.messages[mensagemIndex];
                        // Se o ID é diferente (mensagem local com ID temporário vs mensagem do banco com ID real)
                        if (mensagemExistente.id !== novaMensagem.id) {
                          // Substituir mensagem local pela versão do banco (com ID real)
                          const mensagensAtualizadas = [...conversaExistente.messages];
                          mensagensAtualizadas[mensagemIndex] = {
                            ...novaMensagem,
                            sentBy: mensagemExistente.sentBy || novaMensagem.sentBy,
                            // Preservar outros campos da mensagem local se necessário
                            replyTo: mensagemExistente.replyTo || novaMensagem.replyTo
                          };
                          
                          updated[existingIndex] = {
                            ...conversaExistente,
                            messages: mensagensAtualizadas.sort((a, b) => {
                              const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                              const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                              return timeA - timeB;
                            }),
                            lastMessage: novaConvFormatted.lastMessage,
                          };
                          conversaAtualizada = updated[existingIndex];
                          console.log('✅ [REALTIME] Mensagem local atualizada com ID real do banco:', {
                            idAntigo: mensagemExistente.id,
                            idNovo: novaMensagem.id
                          });
                        } else {
                          // Mensagem já existe e está correta, apenas atualizar lastMessage se necessário
                          updated[existingIndex] = {
                            ...conversaExistente,
                            lastMessage: novaConvFormatted.lastMessage,
                          };
                          conversaAtualizada = updated[existingIndex];
                        }
                      } else {
                        // Mensagem marcada como existente mas não encontrada no índice - não fazer nada
                        console.log('⚠️ [REALTIME] Mensagem marcada como existente mas não encontrada no índice');
                        return prev;
                      }
                    } else {
                      // ⚡ CORREÇÃO CRÍTICA: Calcular status dinamicamente baseado em TODAS as mensagens
                      const todasMensagens = [...conversaExistente.messages, novaMensagem]
                        .sort((a, b) => {
                          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                          return timeA - timeB;
                        });
                      
                      // ⚡ CORREÇÃO: Usar função para calcular status baseado na última mensagem
                      const novoStatus = calculateConversationStatus(todasMensagens);
                      
                      updated[existingIndex] = {
                        ...conversaExistente,
                        messages: todasMensagens,
                        lastMessage: novaConvFormatted.lastMessage,
                        status: novoStatus,
                        // ⚡ CORREÇÃO: Só aumentar unread se for mensagem recebida do contato E conversa não estiver aberta
                        unread: isOpen ? 0 : (novaConversa.fromme === true ? conversaExistente.unread : conversaExistente.unread + 1),
                      };
                      
                      conversaAtualizada = updated[existingIndex];
                    }
                    
                    // Mover para o topo
                    const [item] = updated.splice(existingIndex, 1);
                    updated.unshift(item);
                    
                    return updated;
                  } else {
                    // Nova conversa - adicionar no topo
                    console.log('➕ [REALTIME] Nova conversa criada:', {
                      nome: nomeValido,
                      telefone: telefoneNormalizado,
                      fromme: novaConversa.fromme,
                      status: statusInicial,
                      mensagem: novaConversa.mensagem?.substring(0, 50)
                    });
                    conversaAtualizada = novaConvFormatted;
                    return [novaConvFormatted, ...prev];
                  }
                });
                
                // ⚡ CORREÇÃO CRÍTICA: Se a conversa está aberta, atualizar selectedConv IMEDIATAMENTE
                if (isOpen && conversaAtualizada) {
                  console.log('🔄 [REALTIME] Atualizando selectedConv com nova mensagem');
                  setSelectedConv(conversaAtualizada);
                }
                
                // ⚡ CORREÇÃO CRÍTICA: Notificar e tocar som para mensagens recebidas
                // Usar isReceivedMessageLocal que já foi definido acima
                if (isReceivedMessageLocal) {
                  console.log('🔔 [REALTIME] Mensagem recebida processada:', {
                    nome: nomeValido,
                    telefone: telefoneNormalizado,
                    isOpen,
                    unread: novaConvFormatted.unread,
                    fromme: novaConversa.fromme
                  });
                  
                  // Tocar som de notificação para mensagens recebidas
                  if (!isOpen && novaConvFormatted.unread > 0) {
                    try { 
                      notificationSound.current?.play().catch(() => {}); 
                      console.log('🔔 [REALTIME] Som de notificação tocado para mensagem recebida');
                    } catch (err) {
                      console.warn('⚠️ [REALTIME] Erro ao tocar som:', err);
                    }
                    toast.success(`Nova mensagem de ${nomeValido}`, { duration: 4000 });
                  }
                }
              }, 0, isFromMe); // ⚡ CORREÇÃO: Delay 0 para sincronização instantânea
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
                // ✅ CORREÇÃO: Usar APENAS fromme para determinar lado da mensagem
                sender: (msg.fromme === true) ? 'user' : 'contact',
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
  }, [location, conversations, userCompanyId]);

  // 📡 CRÍTICO: Configurar canal realtime APENAS quando userCompanyId estiver disponível
  // ⚡ NOTA: Este useEffect foi removido porque já existe um useEffect anterior (linha 1727)
  // que configura o canal realtime. O código duplicado estava causando conflitos.
  
  // ⚡ INSTANTÂNEO: Carregar do cache IMEDIATAMENTE (sem esperar userCompanyId)
  // ⚡ CRÍTICO: Executar ANTES de qualquer outra coisa para carregamento instantâneo
  useEffect(() => {
    // ⚡ Carregar do cache instantaneamente (tempo 0) - SEM esperar userCompanyId ou qualquer outra coisa
    const loadFromCache = () => {
      try {
        const cachedData = sessionStorage.getItem(CONVERSATIONS_CACHE_KEY);
        const cacheTimestamp = sessionStorage.getItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);
        
        if (cachedData && cacheTimestamp) {
          const age = Date.now() - parseInt(cacheTimestamp, 10);
          // ⚡ Aumentar tempo de cache válido para 10 minutos (era 5)
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
            
            console.log(`⚡ [CACHE] Carregando ${restoredConversations.length} conversas do cache INSTANTANEAMENTE (${age}ms atrás)`);
            setConversations(restoredConversations);
            // ⚡ CRÍTICO: Setar loadingConversations como false IMEDIATAMENTE para exibir conversas do cache
            setLoadingConversations(false);
            return true; // Cache válido
          } else {
            console.log('⏱️ [CACHE] Cache expirado, será recarregado do Supabase');
          }
        }
        return false; // Cache inválido ou não existe
      } catch (error) {
        console.error('❌ [CACHE] Erro ao carregar do cache:', error);
        return false;
      }
    };

    // Executar imediatamente
    loadFromCache();
  }, []); // ⚡ Executar apenas uma vez no mount
  
  // ⚡ INSTANTÂNEO: Carregar do cache IMEDIATAMENTE (sem esperar userCompanyId)
  // ⚡ CRÍTICO: Executar ANTES de qualquer outra coisa para carregamento instantâneo
  useEffect(() => {
    // ⚡ Carregar do cache instantaneamente (tempo 0) - SEM esperar userCompanyId ou qualquer outra coisa
    const loadFromCache = () => {
      try {
        const cachedData = sessionStorage.getItem(CONVERSATIONS_CACHE_KEY);
        const cacheTimestamp = sessionStorage.getItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);
        
        if (cachedData && cacheTimestamp) {
          const age = Date.now() - parseInt(cacheTimestamp, 10);
          // ⚡ Aumentar tempo de cache válido para 10 minutos (era 5)
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
            
            console.log(`⚡ [CACHE] Carregando ${restoredConversations.length} conversas do cache INSTANTANEAMENTE (${age}ms atrás)`);
            setConversations(restoredConversations);
            // ⚡ CRÍTICO: Setar loadingConversations como false IMEDIATAMENTE para exibir conversas do cache
            setLoadingConversations(false);
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
    
    // ⚡ Carregar do cache IMEDIATAMENTE (sem esperar nada)
    loadFromCache();
  }, []); // ⚡ Executar apenas uma vez no mount - INSTANTÂNEO (antes de tudo)

  // 📡 CARREGAMENTO INSTANTÂNEO: Usar hook de cache para zero tempo de espera
  // ⚡ O hook carrega do localStorage imediatamente e sincroniza em background
  useEffect(() => {
    if (!userCompanyId) return;
    
    // ⚡ Evitar múltiplos carregamentos
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    
    console.log('⚡ [INSTANT] Carregamento instantâneo iniciado');
    
    // ⚡ OTIMIZAÇÃO: Verificar se já temos cache válido antes de forçar refresh
    // Se já temos cache, não forçar refresh para evitar delay desnecessário
    const cachedData = sessionStorage.getItem(CONVERSATIONS_CACHE_KEY);
    const cacheTimestamp = sessionStorage.getItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY);
    const hasValidCache = cachedData && cacheTimestamp && (Date.now() - parseInt(cacheTimestamp, 10)) < CACHE_MAX_AGE;
    
    // Se já temos cache válido, sincronizar em background sem forçar refresh
    syncConversations(hasValidCache ? false : true).then(() => {
      console.log('✅ [INSTANT] Conversas disponíveis instantaneamente');
    }).catch((err) => {
      console.error('❌ [INSTANT] Erro:', err);
      initialLoadRef.current = false;
    });
  }, [userCompanyId, syncConversations]);

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
    
    // ⚡ OTIMIZAÇÃO: Se já temos conversas do cache, não bloquear a exibição
    // Apenas setar loading se não temos conversas ainda
    const hasCachedConversations = conversations.length > 0;
    if (!hasCachedConversations) {
      setLoadingConversations(true);
    }
    
    try {
      const startTime = performance.now();
      
      // ⚡ OTIMIZAÇÃO: Usar company_id em cache se disponível
      let companyId = userCompanyId || userCompanyIdRef.current;
      
      // ETAPA 1: Buscar user e company_id (apenas se não tiver cache)
      let currentUser: any = null;
      if (!companyId) {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          toast.error('Você precisa estar logado');
          setLoadingConversations(false);
          return;
        }
        
        currentUser = user;
        setCurrentUserId(user.id);
        
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
      } else {
        // Se já tem companyId, buscar user para verificar responsável
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          currentUser = user;
          setCurrentUserId(user.id);
        }
      }
      
      // ⚡ CORREÇÃO: Remover limite de conversas - carregar TODAS as conversas do WhatsApp
      // Não usar INITIAL_LIMIT para limitar conversas - todas devem ser exibidas
      const MESSAGES_PER_CONVERSATION = 10; // Aumentar para 10 últimas mensagens por conversa (melhor histórico)
      
      // ⚡ CORREÇÃO CRÍTICA: Aumentar drasticamente limite de mensagens para garantir que TODAS as conversas sejam carregadas
      // Usar limite maior para garantir que todas as conversas sejam encontradas
      const MESSAGES_TO_FETCH = append ? 2000 : 5000; // Buscar MUITO mais mensagens para garantir histórico completo de TODAS as conversas
      
      // ⚡ CORREÇÃO CRÍTICA: Buscar TODAS as mensagens (enviadas e recebidas) sem filtros restritivos
      // Não filtrar por status, fromme ou qualquer outro campo - garantir que todas apareçam
      let query = supabase
        .from('conversas')
        .select('id, numero, telefone_formatado, mensagem, nome_contato, tipo_mensagem, status, created_at, is_group, midia_url, fromme')
        .eq('company_id', companyId)
        // ⚡ CORREÇÃO: Não adicionar filtros adicionais - carregar TODAS as mensagens
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

      let conversasData: any[] = [];
      
      if (conversasError) {
        console.error('❌ [LOAD] Erro ao carregar conversas:', conversasError);
        // ⚡ CORREÇÃO: Não mostrar toast de erro se for apenas um problema temporário
        // Apenas logar o erro para debug
        console.warn('⚠️ [LOAD] Erro ao carregar conversas do banco, tentando continuar...');
        setLoadingConversations(false);
        // Continuar com array vazio para não quebrar a interface
        conversasData = [];
      } else {
        conversasData = conversasResult || [];
      }
      
      // ⚡ CORREÇÃO CRÍTICA: Log detalhado para debug
      const mensagensEnviadas = conversasData.filter(c => c.fromme === true || c.fromme === 'true').length;
      const mensagensRecebidas = conversasData.filter(c => c.fromme === false || c.fromme === 'false' || c.fromme === null || c.fromme === undefined).length;
      const mensagensSemFromme = conversasData.filter(c => c.fromme === null || c.fromme === undefined).length;
      
      console.log(`📊 [LOAD] Carregadas ${conversasData.length} mensagens do banco`, {
        companyId,
        mensagensEnviadas,
        mensagensRecebidas,
        mensagensSemFromme,
        primeiraMensagem: conversasData[0] ? {
          id: conversasData[0].id,
          numero: conversasData[0].numero,
          telefone_formatado: conversasData[0].telefone_formatado,
          fromme: conversasData[0].fromme,
          frommeType: typeof conversasData[0].fromme,
          status: conversasData[0].status,
          mensagem: conversasData[0].mensagem?.substring(0, 50),
          created_at: conversasData[0].created_at
        } : null,
        exemploRecebida: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme) ? {
          id: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme)?.id,
          fromme: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme)?.fromme,
          mensagem: conversasData.find(c => c.fromme === false || c.fromme === 'false' || !c.fromme)?.mensagem?.substring(0, 50)
        } : null
      });
      
      // ⚡ CORREÇÃO: Verificar se há mais conversas para carregar
      // Se retornou exatamente o limite, provavelmente há mais mensagens no banco
      const hasMoreMessages = conversasData.length === MESSAGES_TO_FETCH;
      if (!append && hasMoreMessages) {
        console.log(`⚠️ [LOAD] Retornou exatamente ${MESSAGES_TO_FETCH} mensagens - pode haver mais no banco`);
        setHasMoreConversations(true); // Garantir que o botão "carregar mais" apareça
      }
      
      // ⚡ CORREÇÃO CRÍTICA: Remover TODOS os filtros restritivos
      // Aceitar TODAS as mensagens que tenham número (mesmo sem mensagem, pode ser mídia)
      // NÃO filtrar por nome_contato, status, ou qualquer outro campo
      const validConversas = conversasData.filter(conv => {
        // Apenas verificar se tem número (obrigatório)
        if (!conv.numero || conv.numero.trim() === '') {
          return false;
        }
        
        // ⚡ CORREÇÃO: Aceitar mensagens mesmo sem texto (pode ser apenas mídia)
        // Se não tem mensagem, pode ser imagem/áudio/vídeo sem caption
        if (!conv.mensagem || conv.mensagem.trim() === '') {
          // Verificar se tem mídia - se tiver, aceitar mesmo sem texto
          if (conv.midia_url || conv.tipo_mensagem !== 'text') {
            return true; // Aceitar mídia sem texto
          }
          return false; // Rejeitar apenas se não tem nem mensagem nem mídia
        }
        
        return true; // Aceitar todas as outras mensagens
      });
      
      console.log(`📊 [LOAD] ${validConversas.length} mensagens válidas de ${conversasData.length} total`, {
        mensagensRecebidas: validConversas.filter(c => c.fromme === false || !c.fromme).length,
        mensagensEnviadas: validConversas.filter(c => c.fromme === true).length,
        porNumero: validConversas.reduce((acc, c) => {
          const num = c.telefone_formatado || c.numero;
          acc[num] = (acc[num] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });

      // Agrupar conversas por telefone - PRESERVAR TODAS as mensagens (não limitar)
      // ⚡ CORREÇÃO CRÍTICA: Para grupos, SEMPRE usar o numero (JID do grupo) como chave
      // Nunca usar telefone_formatado para grupos, pois pode conter número do integrante
      const conversasMap = new Map<string, any[]>();
      
      // ⚡ LOG: Debug de agrupamento
      console.log(`📊 [LOAD] Agrupando ${validConversas.length} mensagens válidas...`);
      
      // Função auxiliar para normalizar número de forma consistente
      const normalizePhoneForGrouping = (num: string | null | undefined): string => {
        if (!num) return '';
        // Remover caracteres não numéricos
        const digits = String(num).replace(/[^0-9]/g, '');
        // Garantir código do país para números brasileiros
        if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith('55')) {
          return `55${digits}`;
        }
        return digits;
      };
      
      validConversas.forEach(conv => {
        // Detectar se é grupo: verificar is_group OU se numero termina com @g.us
        const isGroup = Boolean(conv.is_group) === true || /@g\.us$/.test(String(conv.numero || ''));
        
        // ⚡ CORREÇÃO CRÍTICA: Para grupos, SEMPRE usar numero (JID completo do grupo)
        // Para contatos individuais, normalizar telefone para garantir agrupamento correto
        let key: string;
        if (isGroup) {
          key = String(conv.numero || ''); // SEMPRE usar numero para grupos (contém JID do grupo)
        } else {
          // ⚡ CORREÇÃO CRÍTICA: Normalizar telefone de forma ULTRA flexível
          // Tentar TODAS as variações possíveis para garantir agrupamento
          const telefoneFormatado = conv.telefone_formatado || '';
          const numeroOriginal = conv.numero || '';
          
          // Tentar usar telefone_formatado primeiro, senão normalizar número original
          let telefoneNormalizado = telefoneFormatado 
            ? telefoneFormatado.replace(/[^0-9]/g, '')
            : numeroOriginal.replace(/[^0-9]/g, '');
          
          // ⚡ CORREÇÃO: NUNCA descartar - sempre criar uma chave válida
          if (telefoneNormalizado.length >= 10) {
            // Se não começa com 55, adicionar (padrão brasileiro)
            key = telefoneNormalizado.startsWith('55') 
              ? telefoneNormalizado 
              : `55${telefoneNormalizado}`;
          } else if (telefoneNormalizado.length > 0) {
            // Mesmo que não tenha 10 dígitos, usar como está (pode ser número incompleto)
            key = telefoneNormalizado;
          } else {
            // ⚡ FALLBACK: Se não tem número válido, usar o número original como chave
            // Isso garante que mensagens sejam agrupadas mesmo com números inválidos
            key = numeroOriginal || telefoneFormatado || 'unknown';
          }
        }
        
        // ⚡ LOG: Debug de cada mensagem sendo agrupada
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta (pode ser boolean, string, null, undefined)
        const isReceived = conv.fromme === false || conv.fromme === 'false' || conv.fromme === null || conv.fromme === undefined;
        if (isReceived) {
          console.log('📥 [LOAD] Mensagem RECEBIDA sendo agrupada:', {
            id: conv.id,
            numero: conv.numero,
            telefone_formatado: conv.telefone_formatado,
            key: key,
            nome_contato: conv.nome_contato,
            fromme: conv.fromme,
            frommeType: typeof conv.fromme,
            status: conv.status,
            mensagem: conv.mensagem?.substring(0, 30)
          });
        }
        
        if (!conversasMap.has(key)) {
          conversasMap.set(key, []);
        }
        const mensagens = conversasMap.get(key)!;
        mensagens.push(conv);
        // ⚡ CORREÇÃO CRÍTICA: NÃO limitar mensagens aqui - preservar todas para não perder histórico
        // Apenas ordenar por data (mais recente primeiro)
        mensagens.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
      
      // ⚡ CORREÇÃO: Log de agrupamento para debug
      const conversasAgrupadas = Array.from(conversasMap.entries());
      const grupos = conversasAgrupadas.filter(([k]) => /@g\.us$/.test(k));
      const contatos = conversasAgrupadas.filter(([k]) => !/@g\.us$/.test(k));
      
      console.log(`📊 [LOAD] Agrupadas ${conversasMap.size} conversas únicas de ${validConversas.length} mensagens`, {
        grupos: grupos.length,
        contatos: contatos.length,
        detalhesContatos: contatos.map(([key, msgs]) => ({
          key,
          totalMensagens: msgs.length,
          mensagensRecebidas: msgs.filter(m => m.fromme === false || !m.fromme).length,
          mensagensEnviadas: msgs.filter(m => m.fromme === true).length,
          primeiraMensagem: msgs[0] ? {
            numero: msgs[0].numero,
            telefone_formatado: msgs[0].telefone_formatado,
            nome_contato: msgs[0].nome_contato,
            fromme: msgs[0].fromme
          } : null
        }))
      });

      // ⚡ CORREÇÃO: Buscar leads de TODOS os telefones encontrados (sem limite)
      // Remover slice para garantir que todos os leads sejam encontrados
      const telefonesUnicos = Array.from(conversasMap.keys())
        .map(tel => tel.replace(/[^0-9]/g, ''))
        .filter(tel => tel.length >= 10);
      // Removido .slice(0, 50) para buscar leads de TODAS as conversas
      
      // Buscar leads de forma otimizada usando queries mais eficientes
      let leadsData: any[] = [];
      if (telefonesUnicos.length > 0) {
        // ⚡ OTIMIZAÇÃO: Buscar leads usando .or() com múltiplos telefones de uma vez
        // Construir condições para busca otimizada
        const phoneConditions: string[] = [];
        telefonesUnicos.forEach(tel => {
          if (tel && tel.length >= 10) {
            phoneConditions.push(`phone.ilike.%${tel}%`);
            phoneConditions.push(`telefone.ilike.%${tel}%`);
          }
        });
        
        if (phoneConditions.length > 0) {
          // ⚡ CORREÇÃO: Buscar leads em lotes maiores para garantir que todos sejam encontrados
          // Processar em lotes de 100 condições para evitar query muito longa
          const BATCH_SIZE = 100;
          let allLeads: any[] = [];
          
          for (let i = 0; i < phoneConditions.length; i += BATCH_SIZE) {
            const batch = phoneConditions.slice(i, i + BATCH_SIZE);
            const orCondition = batch.join(',');
            
            const leadsResult = await supabase
              .from('leads')
              .select('id, phone, name, telefone')
              .eq('company_id', companyId)
              .or(orCondition)
              .limit(500); // Limite maior por lote
            
            if (!leadsResult.error && leadsResult.data) {
              allLeads = [...allLeads, ...leadsResult.data];
            }
          }
          
          leadsData = allLeads;
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

      // ETAPA 3: Buscar assignments (responsáveis) das conversas
      // Buscar assignments para todos os telefones (para mostrar responsável e filtrar se necessário)
      let assignmentsMap = new Map<string, string | null>(); // telefone -> assigned_user_id
      
      // ⚡ CORREÇÃO: Buscar assignments de TODOS os telefones das conversas (sem limite)
      const telefonesParaBuscar = Array.from(conversasMap.keys())
        .map(tel => tel.replace(/[^0-9]/g, ''))
        .filter(tel => tel.length >= 10);
      // Removido .slice(0, 100) para buscar assignments de TODAS as conversas
      
      if (telefonesParaBuscar.length > 0) {
        // ⚡ CORREÇÃO: Buscar assignments em lotes para garantir que todos sejam encontrados
        // Processar em lotes de 100 telefones para evitar limite do Supabase
        const ASSIGNMENT_BATCH_SIZE = 100;
        let allAssignments: any[] = [];
        
        for (let i = 0; i < telefonesParaBuscar.length; i += ASSIGNMENT_BATCH_SIZE) {
          const batch = telefonesParaBuscar.slice(i, i + ASSIGNMENT_BATCH_SIZE);
          
          const { data: assignmentsData } = await supabase
            .from('conversation_assignments')
            .select('telefone_formatado, assigned_user_id')
            .eq('company_id', companyId)
            .in('telefone_formatado', batch);
          
          if (assignmentsData) {
            allAssignments = [...allAssignments, ...assignmentsData];
          }
        }
        
        // Processar todos os assignments encontrados
        allAssignments.forEach((assignment: any) => {
          const telKey = assignment.telefone_formatado?.replace(/[^0-9]/g, '') || '';
          if (telKey) {
            assignmentsMap.set(telKey, assignment.assigned_user_id);
          }
        });
      }

      // ETAPA 4: Criar lista de conversas (otimizado)
      // ⚡ CORREÇÃO CRÍTICA: REMOVER TODOS OS FILTROS - exibir TODAS as conversas SEM EXCEÇÃO
      // Todas as conversas do WhatsApp devem aparecer no CRM, independente de responsável ou admin
      const novasConversas: Conversation[] = Array.from(conversasMap.entries())
        // ⚡ CORREÇÃO CRÍTICA: REMOVIDO filtro de responsável/admin - TODAS as conversas devem aparecer
        // REMOVIDO: .slice(0, INITIAL_LIMIT) - agora todas as conversas são exibidas
        // REMOVIDO: .filter() por responsável - todas as conversas devem ser visíveis
        .map(([telefone, mensagens]) => {
        // ⚡ CORREÇÃO CRÍTICA: Detectar se é grupo ANTES de processar
        // Verificar se alguma mensagem tem is_group = true ou se o número termina com @g.us
        // Verificar também o telefone (que pode ser o número do grupo) e o número das mensagens
        const isGroup = mensagens.some(m => Boolean(m.is_group) === true) || 
                       /@g\.us$/.test(String(telefone || '')) || 
                       mensagens.some(m => /@g\.us$/.test(String(m.numero || '')));
        
        const leadInfo = leadsMap.get(telefone);
        
        // PRIORIDADE 1: Nome do Lead (se existir) - APENAS para contatos individuais
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
        
        // FALLBACK: Usar telefone ou "Grupo" para grupos
        if (!contactName || contactName.trim() === '') {
          contactName = isGroup ? 'Grupo' : telefone;
        }
        
        // ⚡ CORREÇÃO CRÍTICA: Processar TODAS as mensagens (não limitar) para preservar histórico completo
        // Apenas para exibição inicial na lista, mostrar últimas 3, mas manter todas no estado
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta (pode ser boolean, string, null, undefined)
        const todasMensagensFormatadas: Message[] = mensagens
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map(m => {
            // ⚡ CORREÇÃO CRÍTICA: Determinar sender baseado em fromme de forma robusta
            // fromme === true ou 'true' → sender: "user" (mensagem enviada)
            // fromme === false, 'false', null, undefined → sender: "contact" (mensagem recebida)
            const isFromMe = m.fromme === true || m.fromme === 'true';
            const sender: "user" | "contact" = isFromMe ? "user" : "contact";
            
            return {
              id: m.id || `msg-${Date.now()}-${Math.random()}`,
              content: m.mensagem || '',
              type: (m.tipo_mensagem === 'texto' ? 'text' : m.tipo_mensagem || 'text') as any,
              sender: sender,
              timestamp: new Date(m.created_at || Date.now()),
              delivered: true,
              read: m.status !== 'Recebida',
              mediaUrl: m.midia_url,
            };
          });
        
        // ⚡ CORREÇÃO: Para exibição na lista, usar apenas últimas 3 mensagens
        // Mas manter TODAS as mensagens no estado da conversa
        const messagensFormatadas = todasMensagensFormatadas;

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
        
        // Buscar responsável da conversa (se houver)
        const telKey = telefone.replace(/[^0-9]/g, '');
        const assignedUserId = assignmentsMap.get(telKey);
        
        const conversaCriada = {
          id: telefone,
          contactName,
          channel: "whatsapp" as const,
          status: statusConversa,
          lastMessage: messagensFormatadas[messagensFormatadas.length - 1]?.content || '',
          unread: mensagens.filter(m => m.fromme !== true).length,
          messages: messagensFormatadas,
          tags: [],
          phoneNumber: telefone,
          avatarUrl: isGroup 
            ? `https://ui-avatars.com/api/?name=${encodeURIComponent('Grupo')}&background=10b981&color=fff`
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(contactName.substring(0, 2))}&background=0ea5e9&color=fff`,
          isGroup: isGroup, // ⚡ CORREÇÃO CRÍTICA: Definir isGroup corretamente
          responsavel: assignedUserId || undefined // Adicionar responsável à conversa
        };
        
        // ⚡ LOG: Debug de conversa criada
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta
        const temMensagensRecebidas = mensagens.some(m => {
          const isReceived = m.fromme === false || m.fromme === 'false' || m.fromme === null || m.fromme === undefined;
          return isReceived;
        });
        
        if (temMensagensRecebidas) {
          const mensagensRecebidasCount = mensagens.filter(m => {
            const isReceived = m.fromme === false || m.fromme === 'false' || m.fromme === null || m.fromme === undefined;
            return isReceived;
          }).length;
          const mensagensEnviadasCount = mensagens.filter(m => m.fromme === true || m.fromme === 'true').length;
          
          console.log('✅ [LOAD] Conversa criada com mensagens RECEBIDAS:', {
            telefone,
            contactName,
            totalMensagens: messagensFormatadas.length,
            mensagensRecebidas: mensagensRecebidasCount,
            mensagensEnviadas: mensagensEnviadasCount,
            status: statusConversa,
            mensagensFormatadasRecebidas: messagensFormatadas.filter(m => m.sender === 'contact').length,
            mensagensFormatadasEnviadas: messagensFormatadas.filter(m => m.sender === 'user').length
          });
        }
        
        return conversaCriada;
      });

      const loadTime = performance.now() - startTime;
      console.log(`✅ [LOAD] ${novasConversas.length} conversas carregadas em ${loadTime.toFixed(0)}ms`, {
        totalMensagens: conversasData.length,
        conversasUnicas: novasConversas.length,
        mensagensEnviadas: novasConversas.reduce((acc, c) => acc + c.messages.filter(m => m.sender === 'user').length, 0),
        mensagensRecebidas: novasConversas.reduce((acc, c) => acc + c.messages.filter(m => m.sender === 'contact').length, 0)
      });
      
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
          
          // ⚡ CORREÇÃO CRÍTICA: Preservar mensagens existentes quando mesclar conversas
          // Se uma conversa já existe e tem muitas mensagens (histórico completo), preservar todas
          const merged = novasConversas.map(novaConv => {
            const telefoneNova = novaConv.phoneNumber || novaConv.id;
            const conversaExistente = prev.find(c => {
              const tel = c.phoneNumber || c.id;
              return tel === telefoneNova;
            });
            
            // Se conversa existente tem histórico completo (mais de 3 mensagens), preservar todas
            if (conversaExistente && conversaExistente.messages.length > 3) {
              // Mesclar mensagens: adicionar novas do banco que não existem localmente
              const idsExistentes = new Set(conversaExistente.messages.map(m => m.id));
              const novasMensagens = novaConv.messages.filter(m => !idsExistentes.has(m.id));
              
              // Combinar mensagens existentes com novas, ordenadas por timestamp
              const todasMensagens = [...conversaExistente.messages, ...novasMensagens]
                .sort((a, b) => {
                  const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                  const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                  return timeA - timeB;
                });
              
              // ⚡ CORREÇÃO CRÍTICA: Preservar status 'resolved' se conversa estava finalizada
              // Só atualizar status se conversa não estava finalizada
              const statusPreservado = conversaExistente.status === 'resolved' 
                ? 'resolved' 
                : novaConv.status;
              
              console.log(`🔄 Preservando ${conversaExistente.messages.length} mensagens existentes + ${novasMensagens.length} novas para ${novaConv.contactName}, status: ${statusPreservado}`);
              
              return {
                ...novaConv,
                messages: todasMensagens, // Preservar histórico completo
                lastMessage: novaConv.lastMessage, // Atualizar última mensagem
                status: statusPreservado, // ⚡ PRESERVAR status 'resolved' se estava finalizada
                isGroup: conversaExistente.isGroup, // ⚡ PRESERVAR flag de grupo
              };
            }
            
            // Se não tem histórico completo, usar as mensagens do banco mas preservar status se estava finalizada
            const statusPreservado = conversaExistente?.status === 'resolved' 
              ? 'resolved' 
              : novaConv.status;
            
            return {
              ...novaConv,
              status: statusPreservado, // ⚡ PRESERVAR status 'resolved' se estava finalizada
              isGroup: conversaExistente?.isGroup ?? novaConv.isGroup, // ⚡ PRESERVAR flag de grupo
            };
          });
          
          const finalMerged = [...conversasRealtime, ...merged];
          
          // ⚡ INSTANTÂNEO: Salvar no cache imediatamente
          try {
            sessionStorage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(finalMerged));
            sessionStorage.setItem(CONVERSATIONS_CACHE_TIMESTAMP_KEY, Date.now().toString());
          } catch (e) {
            console.warn('⚠️ [CACHE] Erro ao salvar cache:', e);
          }
          
          return finalMerged;
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
        restantes.forEach(async (conv) => {
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
      // ⚡ CORREÇÃO: Construir query corretamente usando .or() do Supabase
      // O formato correto é: "campo1.eq.valor1,campo2.eq.valor2" (sem espaços)
      const conditions: string[] = [];
      
      // Adicionar condições para telefone_formatado
      variacoes.forEach(v => {
        if (v && v.trim()) {
          conditions.push(`telefone_formatado.eq.${v}`);
        }
      });
      
      // Adicionar condições para numero
      variacoes.forEach(v => {
        if (v && v.trim()) {
          conditions.push(`numero.eq.${v}`);
        }
      });
      
      let allMessages, error;
      
      if (conditions.length > 0) {
        // Construir string de condições no formato correto do Supabase
        const orCondition = conditions.join(',');
        
        const result = await supabase
          .from('conversas')
          .select('*')
          .eq('company_id', userCompanyId)
          .or(orCondition)
          .order('created_at', { ascending: true });
        
        allMessages = result.data;
        error = result.error;
        
        // Se não encontrou nada, tentar busca mais ampla
        if ((!allMessages || allMessages.length === 0) && !error) {
          // Tentar buscar apenas pelo número limpo (sem formatação)
          const telefoneLimpo = telefoneSemFormatacao;
          const result2 = await supabase
            .from('conversas')
            .select('*')
            .eq('company_id', userCompanyId)
            .or(`telefone_formatado.ilike.%${telefoneLimpo}%,numero.ilike.%${telefoneLimpo}%`)
            .order('created_at', { ascending: true });
          
          if (result2.data && result2.data.length > 0) {
            allMessages = result2.data;
            error = result2.error;
          }
        }
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
        
        // ⚡ CORREÇÃO: Remover mensagens duplicadas por ID antes de formatar
        const mensagensUnicas = allMessages.filter((m, index, self) => 
          index === self.findIndex(msg => msg.id === m.id)
        );
        
        console.log(`📊 ${mensagensUnicas.length} mensagens únicas (${allMessages.length - mensagensUnicas.length} duplicadas removidas)`);
        
        // Formatar todas as mensagens
        // ⚡ CORREÇÃO: Verificar fromme de forma mais robusta
        const messagensCompletas: Message[] = mensagensUnicas
          .map(m => {
            // ⚡ CORREÇÃO CRÍTICA: Determinar sender baseado em fromme de forma robusta
            const isFromMe = m.fromme === true || m.fromme === 'true';
            const sender: "user" | "contact" = isFromMe ? "user" : "contact";
            
            return {
              id: m.id || `msg-${Date.now()}-${Math.random()}`,
              content: m.mensagem || '',
              type: (m.tipo_mensagem === 'texto' ? 'text' : (m.tipo_mensagem || 'text')) as any,
              sender: sender,
              timestamp: new Date(m.created_at || Date.now()),
              delivered: true,
              read: m.status !== 'Recebida',
              mediaUrl: m.midia_url,
              fileName: m.arquivo_nome,
            };
          })
          // Ordenar por timestamp para garantir ordem cronológica correta
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        // ⚡ LOG: Debug de mensagens formatadas
        console.log(`📊 [HISTORY] ${messagensCompletas.length} mensagens formatadas:`, {
          recebidas: messagensCompletas.filter(m => m.sender === 'contact').length,
          enviadas: messagensCompletas.filter(m => m.sender === 'user').length
        });
        
        // ⚡ CORREÇÃO: Remover duplicatas finais por ID e timestamp (caso ainda existam)
        const mensagensFinais = messagensCompletas.filter((m, index, self) => 
          index === self.findIndex(msg => 
            msg.id === m.id || 
            (msg.content === m.content && 
             Math.abs(msg.timestamp.getTime() - m.timestamp.getTime()) < 1000)
          )
        );
        
        // Atualizar a conversa selecionada
        setSelectedConv(prev => {
          if (prev && prev.phoneNumber === phoneNumber) {
            return {
              ...prev,
              messages: mensagensFinais
            };
          }
          return prev;
        });
        
        // Atualizar conversa na lista
        setConversations(prev => prev.map(conv => 
          conv.phoneNumber === phoneNumber 
            ? { ...conv, messages: mensagensFinais }
            : conv
        ));
        
        // Estatísticas
        setHistoryStats(prev => ({
          ...prev,
          [phoneNumber]: { total: mensagensFinais.length, loaded: mensagensFinais.length }
        }));
        
        // Scroll
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        
        toast.success(`📜 ${mensagensFinais.length} mensagens carregadas`);
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

      // ⚡ CORREÇÃO: Criar URL blob temporária para exibição imediata
      const blobUrl = URL.createObjectURL(file);
      
      // ⚡ CORREÇÃO: Criar data URL para salvar no banco (compatível com getMediaUrl)
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });

      const { data: inserted, error: dbError } = await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem: caption || tipoMensagem[type],
        origem: 'WhatsApp',
        status: 'Enviada',
        tipo_mensagem: type,
        nome_contato: selectedConv.contactName,
        arquivo_nome: file.name,
        midia_url: dataUrl, // ⚡ CORREÇÃO: Salvar URL da mídia no banco
        company_id: userRole?.company_id,
        fromme: true, // Marcar como mensagem enviada pelo usuário
      }]).select('id, midia_url').single();

      if (dbError) {
        console.error('❌ Erro ao salvar mensagem no banco:', dbError);
        toast.error('Erro ao salvar mensagem no histórico');
      }

      // ⚡ CORREÇÃO: Usar blob URL para exibição imediata, mas também ter o ID do banco
      const newMessage: Message = {
        id: (inserted?.id || Date.now()).toString(),
        content: caption || tipoMensagem[type] || 'Arquivo enviado',
        type: type as "image" | "audio" | "pdf" | "video",
        sender: "user",
        timestamp: new Date(),
        delivered: true,
        read: false,
        mediaUrl: blobUrl, // URL blob temporária para exibição imediata
        fileName: file.name,
        mimeType: file.type,
        sentBy: userName || "Você", // Adicionar quem enviou
      };

      // ⚡ CORREÇÃO CRÍTICA: Ordenar mensagens por timestamp após adicionar nova mensagem
      const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
        return [...messages].sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
      };

      // ⚡ CORREÇÃO: Calcular status dinamicamente
      const sortedMessagesWithNew = sortMessagesByTimestamp([...selectedConv.messages, newMessage]);
      const newStatus = calculateConversationStatus(sortedMessagesWithNew);

      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? {
              ...conv,
              messages: sortedMessagesWithNew,
              lastMessage: tipoMensagem[type] || newMessage.content,
              status: newStatus,
              unread: 0,
            }
          : conv
      );

      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        messages: sortedMessagesWithNew,
        status: newStatus,
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
        fromme: true, // ⚡ CORREÇÃO: Marcar como mensagem enviada pelo usuário
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

      // ⚡ CORREÇÃO CRÍTICA: Ordenar mensagens por timestamp após adicionar nova mensagem
      const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
        return [...messages].sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
      };

      // ⚡ CORREÇÃO: Calcular status dinamicamente
      const sortedMessagesWithNew = sortMessagesByTimestamp([...selectedConv.messages, newMessage]);
      const newStatus = calculateConversationStatus(sortedMessagesWithNew);

      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? {
              ...conv,
              messages: sortedMessagesWithNew,
              lastMessage: "Áudio enviado",
              status: newStatus,
              unread: 0,
            }
          : conv
      );

      saveConversations(updatedConversations);
      setSelectedConv({
        ...selectedConv,
        messages: sortedMessagesWithNew,
        status: newStatus,
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

  // ⚡ FUNÇÃO PARA CALCULAR STATUS BASEADO NA ÚLTIMA MENSAGEM
  const calculateConversationStatus = (messages: Message[]): "waiting" | "answered" | "resolved" => {
    if (!messages || messages.length === 0) return "waiting";
    
    // Ordenar mensagens por timestamp para garantir que pegamos a última
    const sortedMessages = [...messages].sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
    
    const ultimaMensagem = sortedMessages[sortedMessages.length - 1];
    
    // Se a última mensagem foi do contato, está aguardando resposta
    if (ultimaMensagem.sender === "contact") {
      return "waiting";
    }
    
    // Se a última mensagem foi do usuário, foi respondida
    if (ultimaMensagem.sender === "user") {
      return "answered";
    }
    
    return "waiting";
  };

  const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
    const messageContent = content || messageInput.trim();
    if (!messageContent || !selectedConv) return;

    console.log('📤 [ENVIO] Iniciando envio de mensagem:', {
      conteudo: messageContent.substring(0, 50),
      tipo: type,
      conversaId: selectedConv.id,
      timestamp: new Date().toISOString()
    });

    // Validar e formatar número
    try {
      const formattedPhone = formatPhoneNumber(selectedConv.id);
    } catch (error: any) {
      toast.error(error.message);
      return;
    }

    const newMessage: Message = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`, // ID temporário único
      content: messageContent,
      type,
      sender: "user",
      timestamp: new Date(),
      delivered: true,
      replyTo: replyingTo || undefined,
      sentBy: userName || "Você", // Adicionar quem enviou a mensagem
    };

    console.log('📝 [ENVIO] Mensagem criada com ID temporário:', newMessage.id);

    // ⚡ CORREÇÃO CRÍTICA: Ordenar mensagens por timestamp após adicionar nova mensagem
    const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
      return [...messages].sort((a, b) => {
        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
    };

    // ⚡ CORREÇÃO: Calcular status dinamicamente baseado nas mensagens
    const sortedMessagesWithNew = sortMessagesByTimestamp([...selectedConv.messages, newMessage]);
    const newStatus = calculateConversationStatus(sortedMessagesWithNew);

    const updatedConversations = conversations.map((conv) =>
      conv.id === selectedConv.id
        ? {
            ...conv,
            messages: sortedMessagesWithNew,
            lastMessage: type === "text" ? messageContent : `📎 ${type}`,
            status: newStatus,
            unread: 0,
          }
        : conv
    );

    saveConversations(updatedConversations);
    setSelectedConv({
      ...selectedConv,
      messages: sortedMessagesWithNew,
      lastMessage: type === "text" ? messageContent : `📎 ${type}`,
      status: newStatus,
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
    
    // ⚡ CORREÇÃO CRÍTICA: Salvar mensagem no banco PRIMEIRO (antes de enviar)
    // Isso garante que a mensagem apareça no CRM mesmo se o envio falhar
    console.log('💾 [ENVIO] Salvando mensagem no banco PRIMEIRO...');
    const numeroNormalizado = normalizePhoneForWA(selectedConv.phoneNumber || selectedConv.id);
    let mensagemSalva = false;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        
        if (userRole?.company_id) {
          const repliedMessage = replyingTo ? selectedConv.messages.find(m => m.id === replyingTo)?.content : null;
          const { error: dbError } = await supabase.from('conversas').insert([{
            numero: numeroNormalizado,
            telefone_formatado: numeroNormalizado,
            mensagem: messageContent,
            origem: 'WhatsApp',
            status: 'Enviada',
            tipo_mensagem: type,
            nome_contato: selectedConv.contactName,
            company_id: userRole.company_id,
            fromme: true,
            replied_to_message: repliedMessage || null,
          }]);
          
          if (!dbError) {
            mensagemSalva = true;
            console.log('✅ [ENVIO] Mensagem salva no banco com sucesso (antes do envio)');
            // ⚡ CORREÇÃO: Não recarregar conversas manualmente - o realtime vai atualizar automaticamente
            // Isso evita duplicação de mensagens
          } else {
            console.error('❌ [ENVIO] Erro ao salvar mensagem no banco:', dbError);
          }
        }
      }
    } catch (saveError) {
      console.error('❌ [ENVIO] Erro ao salvar mensagem no banco:', saveError);
    }
    
    // Enviar mensagem via Evolution API (após salvar no banco)
    try {
      console.log('📤 [ENVIO] Preparando envio via WhatsApp:', {
        numeroNormalizado,
        mensagem: messageContent.substring(0, 50),
        tipo: type,
        userCompanyId,
        telefoneOriginal: selectedConv.phoneNumber || selectedConv.id
      });
      
      const { data, error } = await enviarWhatsApp({
        numero: numeroNormalizado,
        ...mensagemParaEnviar,
        quotedMessageId: replyingTo || undefined,
        tipo_mensagem: type,
      });

      console.log('📥 [ENVIO] Resposta do enviarWhatsApp:', { data, error });
      // ⚡ CORREÇÃO: Mensagem já foi salva antes do envio, não salvar novamente aqui
      // Isso evita duplicação de mensagens no banco

      if (error) {
        console.error('❌ [ENVIO] Erro ao enviar mensagem via WhatsApp:', error);
        
        // Se a mensagem foi salva, apenas avisar sobre o envio
        if (mensagemSalva) {
          toast.warning('Mensagem salva, mas pode não ter sido enviada. Verifique a conexão WhatsApp.');
        } else {
          toast.error(`Erro ao enviar mensagem: ${error.message || 'Erro desconhecido'}`);
        }
        
        // Recarregar conversas para mostrar a mensagem salva
        if (mensagemSalva) {
          setTimeout(async () => {
            console.log('🔄 [ENVIO] Recarregando conversas após salvar mensagem...');
            await loadSupabaseConversations();
          }, 500);
        }
        return;
      }

      console.log('✅ [ENVIO] Resposta Evolution API:', data);
      
      // Não mostrar notificação ao enviar - apenas logs
      console.log('✅ [ENVIO] Mensagem enviada para WhatsApp com sucesso');
      
      // ⚡ CORREÇÃO: Se a mensagem já foi salva antes, não salvar novamente
      if (!mensagemSalva) {
        console.log('⚠️ [ENVIO] Mensagem não foi salva antes, salvando agora...');
        // Se por algum motivo não foi salva antes, salvar agora
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: userRole } = await supabase
              .from('user_roles')
              .select('company_id')
              .eq('user_id', user.id)
              .single();
            
            if (userRole?.company_id) {
              const repliedMessage = replyingTo ? selectedConv.messages.find(m => m.id === replyingTo)?.content : null;
              const { error: dbError } = await supabase.from('conversas').insert([{
                numero: numeroNormalizado,
                telefone_formatado: numeroNormalizado,
                mensagem: messageContent,
                origem: 'WhatsApp',
                status: 'Enviada',
                tipo_mensagem: type,
                nome_contato: selectedConv.contactName,
                company_id: userRole.company_id,
                fromme: true,
                replied_to_message: repliedMessage || null,
              }]);
              
              if (!dbError) {
                mensagemSalva = true;
                console.log('✅ [ENVIO] Mensagem salva no banco após envio bem-sucedido');
              }
            }
          }
        } catch (saveError) {
          console.error('❌ [ENVIO] Erro ao salvar mensagem após envio:', saveError);
        }
      }
      
      // Recarregar conversas para garantir que a mensagem apareça
      if (mensagemSalva) {
        setTimeout(async () => {
          console.log('🔄 [ENVIO] Recarregando conversas após envio bem-sucedido...');
          await loadSupabaseConversations();
        }, 500);
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

  // Função para converter arquivo para base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsDataURL(file);
    });
  };

  const addQuickMessage = async () => {
    if (!newQuickTitle || !newQuickCategory) {
      toast.error("Preencha título e selecione uma categoria");
      return;
    }
    
    // Validar conteúdo baseado no tipo
    if (newQuickMessageType === "text" && !newQuickContent.trim()) {
      toast.error("Digite a mensagem de texto");
      return;
    }
    
    if ((newQuickMessageType === "image" || newQuickMessageType === "video") && !newQuickMediaFile) {
      toast.error("Selecione um arquivo de mídia");
      return;
    }

    let mediaUrl = "";
    let fileName = "";
    let mimeType = "";

    // Converter mídia para base64 se houver
    if (newQuickMediaFile) {
      try {
        mediaUrl = await convertFileToBase64(newQuickMediaFile);
        fileName = newQuickMediaFile.name;
        mimeType = newQuickMediaFile.type;
      } catch (error) {
        toast.error("Erro ao processar arquivo de mídia");
        return;
      }
    }

    const newMsg: QuickMessage = {
      id: Date.now().toString(),
      title: newQuickTitle,
      content: newQuickContent || (newQuickMessageType === "image" ? "[Imagem]" : newQuickMessageType === "video" ? "[Vídeo]" : ""),
      category: newQuickCategory,
      type: newQuickMessageType,
      mediaUrl: mediaUrl || undefined,
      fileName: fileName || undefined,
      mimeType: mimeType || undefined,
    };
    
    saveQuickMessages([...quickMessages, newMsg]);
    setNewQuickTitle("");
    setNewQuickContent("");
    setNewQuickCategory("");
    setNewQuickMessageType("text");
    setNewQuickMediaFile(null);
    setNewQuickMediaPreview(null);
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

  const sendQuickMessage = async (message: QuickMessage) => {
    if (message.type === "image" || message.type === "video") {
      // Enviar mídia
      if (!message.mediaUrl) {
        toast.error("Mídia não encontrada na mensagem rápida");
        return;
      }
      
      // Extrair base64 da data URL
      const base64 = message.mediaUrl.includes(',') ? message.mediaUrl.split(',')[1] : message.mediaUrl;
      
      // Criar arquivo temporário a partir do base64
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: message.mimeType || 'image/jpeg' });
      const file = new File([blob], message.fileName || 'media', { type: message.mimeType || 'image/jpeg' });
      
      // Enviar mídia usando handleSendMedia
      await handleSendMedia(file, message.content, message.type);
    } else {
      // Enviar texto
      handleSendMessage(message.content);
    }
  };

  // Função para editar mensagem rápida
  const editQuickMessage = (id: string) => {
    const message = quickMessages.find(m => m.id === id);
    if (message) {
      setEditingMessageId(id);
      setEditMessageTitle(message.title);
      setEditMessageContent(message.content);
      setEditMessageCategory(message.category);
      setEditMessageType(message.type || "text");
      setEditMessageMediaPreview(message.mediaUrl || null);
      setEditMessageMediaFile(null); // Resetar arquivo novo
    }
  };

  // Função para salvar edição de mensagem
  const saveEditedMessage = async () => {
    if (!editingMessageId || !editMessageTitle || !editMessageCategory) {
      toast.error("Preencha título e selecione uma categoria");
      return;
    }
    
    // Validar conteúdo baseado no tipo
    if (editMessageType === "text" && !editMessageContent.trim()) {
      toast.error("Digite a mensagem de texto");
      return;
    }
    
    if ((editMessageType === "image" || editMessageType === "video") && !editMessageMediaFile && !editMessageMediaPreview) {
      toast.error("Selecione um arquivo de mídia ou mantenha o existente");
      return;
    }

    let mediaUrl = editMessageMediaPreview || "";
    let fileName = "";
    let mimeType = "";

    // Se houver novo arquivo, converter para base64
    if (editMessageMediaFile) {
      try {
        mediaUrl = await convertFileToBase64(editMessageMediaFile);
        fileName = editMessageMediaFile.name;
        mimeType = editMessageMediaFile.type;
      } catch (error) {
        toast.error("Erro ao processar arquivo de mídia");
        return;
      }
    } else if (editMessageMediaPreview) {
      // Manter dados do arquivo existente se não houver novo
      const existingMsg = quickMessages.find(m => m.id === editingMessageId);
      if (existingMsg) {
        fileName = existingMsg.fileName || "";
        mimeType = existingMsg.mimeType || "";
      }
    }

    const updated = quickMessages.map(m => 
      m.id === editingMessageId 
        ? { 
            ...m, 
            title: editMessageTitle, 
            content: editMessageContent || (editMessageType === "image" ? "[Imagem]" : editMessageType === "video" ? "[Vídeo]" : ""), 
            category: editMessageCategory,
            type: editMessageType,
            mediaUrl: mediaUrl || undefined,
            fileName: fileName || undefined,
            mimeType: mimeType || undefined,
          }
        : m
    );
    saveQuickMessages(updated);
    setEditingMessageId(null);
    setEditMessageTitle("");
    setEditMessageContent("");
    setEditMessageCategory("");
    setEditMessageType("text");
    setEditMessageMediaFile(null);
    setEditMessageMediaPreview(null);
    toast.success("Mensagem editada com sucesso!");
  };

  // Função para cancelar edição de mensagem
  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditMessageTitle("");
    setEditMessageContent("");
    setEditMessageCategory("");
    setEditMessageType("text");
    setEditMessageMediaFile(null);
    setEditMessageMediaPreview(null);
  };

  // Função para editar categoria
  const editQuickCategory = (id: string) => {
    const category = quickCategories.find(c => c.id === id);
    if (category) {
      setEditingCategoryId(id);
      setEditCategoryName(category.name);
    }
  };

  // Função para salvar edição de categoria
  const saveEditedCategory = () => {
    if (!editingCategoryId || !editCategoryName.trim()) {
      toast.error("Digite o nome da categoria");
      return;
    }
    const updated = quickCategories.map(c => 
      c.id === editingCategoryId 
        ? { ...c, name: editCategoryName }
        : c
    );
    saveQuickCategories(updated);
    setEditingCategoryId(null);
    setEditCategoryName("");
    toast.success("Categoria editada com sucesso!");
  };

  // Função para cancelar edição de categoria
  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName("");
  };

  // Função para mover mensagem para cima
  const moveMessageUp = (id: string, categoryId: string) => {
    // Obter todas as mensagens da categoria na ordem atual
    const categoryMessages = quickMessages.filter(m => m.category === categoryId);
    const otherMessages = quickMessages.filter(m => m.category !== categoryId);
    
    const currentIndex = categoryMessages.findIndex(m => m.id === id);
    if (currentIndex <= 0) return; // Já está no topo
    
    // Reordenar mensagens da categoria
    const reordered = [...categoryMessages];
    [reordered[currentIndex], reordered[currentIndex - 1]] = 
    [reordered[currentIndex - 1], reordered[currentIndex]];
    
    // Reconstruir array completo mantendo ordem: outras categorias + categoria reordenada
    const updated = [...otherMessages, ...reordered];
    saveQuickMessages(updated);
    toast.success("Mensagem movida para cima!");
  };

  // Função para mover mensagem para baixo
  const moveMessageDown = (id: string, categoryId: string) => {
    // Obter todas as mensagens da categoria na ordem atual
    const categoryMessages = quickMessages.filter(m => m.category === categoryId);
    const otherMessages = quickMessages.filter(m => m.category !== categoryId);
    
    const currentIndex = categoryMessages.findIndex(m => m.id === id);
    if (currentIndex >= categoryMessages.length - 1) return; // Já está no final
    
    // Reordenar mensagens da categoria
    const reordered = [...categoryMessages];
    [reordered[currentIndex], reordered[currentIndex + 1]] = 
    [reordered[currentIndex + 1], reordered[currentIndex]];
    
    // Reconstruir array completo mantendo ordem: outras categorias + categoria reordenada
    const updated = [...otherMessages, ...reordered];
    saveQuickMessages(updated);
    toast.success("Mensagem movida para baixo!");
  };

  // Função para mover categoria para cima
  const moveCategoryUp = (id: string) => {
    const currentIndex = quickCategories.findIndex(c => c.id === id);
    if (currentIndex <= 0) return; // Já está no topo
    
    const updated = [...quickCategories];
    [updated[currentIndex], updated[currentIndex - 1]] = 
    [updated[currentIndex - 1], updated[currentIndex]];
    
    saveQuickCategories(updated);
    toast.success("Categoria movida para cima!");
  };

  // Função para mover categoria para baixo
  const moveCategoryDown = (id: string) => {
    const currentIndex = quickCategories.findIndex(c => c.id === id);
    if (currentIndex >= quickCategories.length - 1) return; // Já está no final
    
    const updated = [...quickCategories];
    [updated[currentIndex], updated[currentIndex + 1]] = 
    [updated[currentIndex + 1], updated[currentIndex]];
    
    saveQuickCategories(updated);
    toast.success("Categoria movida para baixo!");
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
      
      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .insert({
          lead_id: leadVinculado.id,
          usuario_responsavel_id: user.id,
          owner_id: user.id,
          company_id: companyId,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico: meetingTitle,
          observacoes: meetingNotes,
          status: 'agendado',
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ [COMPROMISSO] Compromisso criado com sucesso:', compromisso?.id);

      // ⚡ ENVIAR MENSAGEM DE CONFIRMAÇÃO IMEDIATA
      console.log('🔍 [DEBUG-CONFIRMAÇÃO] Estado enviarConfirmacaoReuniao:', enviarConfirmacaoReuniao);
      console.log('🔍 [DEBUG-CONFIRMAÇÃO] Lead vinculado:', leadVinculado);
      console.log('🔍 [DEBUG-CONFIRMAÇÃO] Compromisso criado:', compromisso);
      
      if (enviarConfirmacaoReuniao && compromisso && leadVinculado) {
        try {
          const telefone = leadVinculado.phone || leadVinculado.telefone;
          console.log('🔍 [DEBUG-CONFIRMAÇÃO] Telefone do lead:', telefone);
          
          if (telefone) {
            const telefoneNormalizado = normalizePhoneForWA(telefone);
            console.log('🔍 [DEBUG-CONFIRMAÇÃO] Telefone normalizado:', telefoneNormalizado);
            
            if (telefoneNormalizado) {
              // Mensagem de confirmação formatada e personalizada
              const tipoServicoFormatado = meetingTitle.trim()
                ? meetingTitle.charAt(0).toUpperCase() + meetingTitle.slice(1)
                : 'Compromisso';
              
              const mensagemConfirmacao = `✅ *Compromisso Confirmado!*\n\n` +
                `Olá ${leadVinculado.name}! Seu compromisso foi agendado com sucesso.\n\n` +
                `📅 *Data:* ${format(dataHoraInicio, "dd/MM/yyyy", { locale: ptBR })}\n` +
                `🕐 *Horário:* ${format(dataHoraInicio, "HH:mm", { locale: ptBR })} às ${format(dataHoraFim, "HH:mm", { locale: ptBR })}\n` +
                `📋 *Tipo:* ${tipoServicoFormatado}\n` +
                (meetingNotes ? `\n💬 *Observações:*\n${meetingNotes}\n` : '') +
                `\n✅ *Status:* Agendado\n\n` +
                `Aguardamos você no dia e horário agendados!\n\n` +
                `_Esta é uma confirmação automática do seu agendamento._`;

              console.log('📱 [CONFIRMAÇÃO] Enviando mensagem de confirmação imediata...');
              console.log('📱 [CONFIRMAÇÃO] Dados do envio:', {
                numero: telefoneNormalizado,
                company_id: companyId,
                mensagemLength: mensagemConfirmacao.length
              });
              
              const { data: resultConfirmacao, error: confirmacaoError } = await supabase.functions.invoke('enviar-whatsapp', {
                body: {
                  numero: telefoneNormalizado,
                  mensagem: mensagemConfirmacao,
                  company_id: companyId
                }
              });

              console.log('📱 [CONFIRMAÇÃO] Resposta da edge function:', { data: resultConfirmacao, error: confirmacaoError });

              if (confirmacaoError) {
                console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', confirmacaoError);
                toast.warning("Compromisso criado, mas não foi possível enviar a confirmação imediata.");
              } else {
                console.log('✅ [CONFIRMAÇÃO] Mensagem de confirmação enviada com sucesso!');
                
                // Salvar mensagem de confirmação na tabela conversas para ficar visível no CRM
                try {
                  const { error: dbError } = await supabase.from('conversas').insert([{
                    numero: telefoneNormalizado,
                    telefone_formatado: telefoneNormalizado,
                    mensagem: mensagemConfirmacao,
                    origem: 'WhatsApp',
                    status: 'Enviada',
                    tipo_mensagem: 'text',
                    nome_contato: leadVinculado.name || leadVinculado.nome,
                    company_id: companyId,
                    lead_id: leadVinculado.id,
                    fromme: true,
                  }]);
                  
                  if (dbError) {
                    console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', dbError);
                  } else {
                    console.log('✅ [CONFIRMAÇÃO] Mensagem salva no banco de dados com sucesso!');
                  }
                } catch (saveError) {
                  console.error('❌ [CONFIRMAÇÃO] Erro ao salvar mensagem no banco:', saveError);
                }
                
                toast.success("Compromisso criado e confirmação enviada ao cliente!");
              }
            } else {
              console.warn('⚠️ [CONFIRMAÇÃO] Telefone normalizado está vazio');
              toast.warning("Compromisso criado, mas telefone inválido para envio.");
            }
          } else {
            console.warn('⚠️ [CONFIRMAÇÃO] Lead sem telefone');
            toast.warning("Compromisso criado, mas lead sem telefone para enviar confirmação.");
          }
        } catch (error: any) {
          console.error('❌ [CONFIRMAÇÃO] Erro ao enviar confirmação:', error);
          toast.error(`Erro ao enviar confirmação: ${error?.message || 'Erro desconhecido'}`);
        }
      } else {
        console.log('ℹ️ [CONFIRMAÇÃO] Confirmação não será enviada. Motivos:', {
          enviarConfirmacaoReuniao,
          temCompromisso: !!compromisso,
          temLead: !!leadVinculado
        });
      }

      // ⚡ CRIAR LEMBRETE AUTOMÁTICO
      if (enviarLembreteReuniao && compromisso) {
        try {
          console.log('📝 [LEMBRETE] Criando lembrete para compromisso:', compromisso.id);

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();

          // Validar e processar horas de antecedência (converter horas e minutos para decimal)
          const horas = parseInt(horasAntecedenciaReuniaoHoras || "0", 10);
          const minutos = parseInt(horasAntecedenciaReuniaoMinutos || "0", 10);
          
          if (horas === 0 && minutos === 0) {
            toast.error("Por favor, informe o tempo de antecedência para o lembrete");
            return;
          }
          
          if (horas < 0 || minutos < 0 || minutos >= 60) {
            toast.error("Valores inválidos para horas ou minutos");
            return;
          }
          
          // Converter horas e minutos para formato decimal (horas + minutos/60)
          const horasAntecedencia = horas + (minutos / 60);

          // Calcular data de envio do lembrete
          const dataEnvio = new Date(dataHoraInicio);
          dataEnvio.setHours(dataEnvio.getHours() - horasAntecedencia);

          const lembreteData = {
            compromisso_id: compromisso.id,
            canal: 'whatsapp',
            horas_antecedencia: horasAntecedencia,
            mensagem: `Olá ${leadVinculado.name}! Lembramos do seu compromisso agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
            status_envio: 'pendente',
            data_envio: dataEnvio.toISOString(),
            destinatario: 'lead',
            telefone_responsavel: profile?.full_name || user.email,
            company_id: companyId,
          };

          console.log('📝 [LEMBRETE] Dados do lembrete:', { ...lembreteData, mensagem: '[oculta]' });

          const { error: lembreteError } = await supabase
            .from('lembretes')
            .insert(lembreteData);

          if (lembreteError) {
            console.error('❌ [LEMBRETE] Erro ao criar lembrete:', lembreteError);
            toast.warning("Compromisso criado, mas houve erro ao criar o lembrete.");
          } else {
            console.log('✅ [LEMBRETE] Lembrete criado com sucesso!');
          }
        } catch (error) {
          console.error('❌ [LEMBRETE] Erro ao criar lembrete:', error);
        }
      }

      setMeetingTitle("");
      setMeetingDatetime("");
      setMeetingNotes("");
      setEnviarConfirmacaoReuniao(true); // Reset para padrão
      setEnviarLembreteReuniao(true); // Reset para padrão
      setHorasAntecedenciaReuniaoHoras("0"); // Reset para padrão
      setHorasAntecedenciaReuniaoMinutos("0"); // Reset para padrão
      
      if (!enviarConfirmacaoReuniao) {
        toast.success("Reunião agendada e sincronizada com Agenda!");
      }
      
      // Recarregar reuniões após criar
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
    
    // Verificar se a tag já existe
    if (selectedConv.tags?.includes(newTag.trim())) {
      toast.error("Esta tag já foi adicionada");
      return;
    }
    
    try {
      setSyncStatus('syncing');
      
      // Buscar ou criar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Atualizar tags no Supabase
        const updatedTags = [...(leadData.tags || []), newTag.trim()];
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
          ? { ...conv, tags: [...(conv.tags || []), newTag.trim()] }
          : conv
      );
      saveConversations(updatedConversations);
      setSelectedConv({ ...selectedConv, tags: [...(selectedConv.tags || []), newTag.trim()] });
      setNewTag("");
      await refreshTags(); // Atualizar lista de tags disponíveis
      toast.success("Tag adicionada!");
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar tag');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const addExistingTag = async (tag: string) => {
    if (!selectedConv) return;
    
    // Verificar se a tag já existe
    if (selectedConv.tags?.includes(tag)) {
      return;
    }
    
    try {
      setSyncStatus('syncing');
      
      // Buscar ou criar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Atualizar tags no Supabase
        const updatedTags = [...(leadData.tags || []), tag];
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
      
      // Atualizar localmente
      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? { ...conv, tags: [...(conv.tags || []), tag] }
          : conv
      );
      saveConversations(updatedConversations);
      setSelectedConv({ ...selectedConv, tags: [...(selectedConv.tags || []), tag] });
      
      // Atualizar lead vinculado se existir
      if (leadVinculado) {
        setLeadVinculado({ ...leadVinculado, tags: updatedConversations.find(c => c.id === selectedConv.id)?.tags || [] });
      }
      
      toast.success("Tag adicionada!");
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao adicionar tag');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }
  };

  const removeTag = async (tag: string) => {
    if (!selectedConv) return;
    
    try {
      setSyncStatus('syncing');
      
      // Buscar lead no Supabase
      const leadData = await findOrCreateLead(selectedConv);
      
      if (leadData) {
        // Remover tag do array
        const updatedTags = (leadData.tags || []).filter(t => t !== tag);
        const { error } = await supabase
          .from('leads')
          .update({ tags: updatedTags })
          .eq('id', leadData.id);
        
        if (error) {
          console.error('Erro ao remover tag no Supabase:', error);
          setSyncStatus('error');
          toast.error('Erro ao remover tag');
          setTimeout(() => setSyncStatus('idle'), 2000);
          return;
        }
        
        console.log('✅ Tag removida no Supabase');
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      }
      
      // Atualizar localmente
      const updatedTags = (selectedConv.tags || []).filter(t => t !== tag);
      const updatedConversations = conversations.map((conv) =>
        conv.id === selectedConv.id
          ? { ...conv, tags: updatedTags }
          : conv
      );
      saveConversations(updatedConversations);
      setSelectedConv({ ...selectedConv, tags: updatedTags });
      
      // Atualizar lead vinculado se existir
      if (leadVinculado) {
        setLeadVinculado({ ...leadVinculado, tags: updatedTags });
      }
      
      toast.success("Tag removida!");
    } catch (error) {
      console.error('Erro ao remover tag:', error);
      setSyncStatus('error');
      toast.error('Erro ao remover tag');
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
          searchedVariations: variations.length,
          funil_id: existingLead.funil_id,
          etapa_id: existingLead.etapa_id
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
        
        // ⚡ SINCRONIZAÇÃO: Atualizar informações do funil na conversa
        // Atualizar conversa com informações do lead (tags, valor, etc)
        setConversations(prev => prev.map(conv => 
          conv.id === conversation.id 
            ? { 
                ...conv, 
                tags: existingLead.tags || conv.tags,
                responsavel: existingLead.responsavel_id ? conv.responsavel : conv.responsavel,
                valor: existingLead.value ? `R$ ${Number(existingLead.value).toLocaleString('pt-BR')}` : conv.valor
              }
            : conv
        ));
        
        // Atualizar conversa selecionada se for a mesma
        if (selectedConv?.id === conversation.id) {
          setSelectedConv(prev => prev ? {
            ...prev,
            tags: existingLead.tags || prev.tags,
            valor: existingLead.value ? `R$ ${Number(existingLead.value).toLocaleString('pt-BR')}` : prev.valor
          } : null);
        }
        
        // Se o lead tem funil, buscar informações do funil e etapa
        if (existingLead.funil_id && existingLead.etapa_id) {
          // Aguardar um pouco para garantir que funis/etapas foram carregados
          setTimeout(() => {
            const etapaInfo = etapas.find(e => e.id === existingLead.etapa_id);
            const funilInfo = funis.find(f => f.id === existingLead.funil_id);
            const nomeEtapa = etapaInfo?.nome || "Etapa não definida";
            const nomeFunil = funilInfo?.nome || "Funil";
            
            console.log('📊 [FUNIL] Atualizando informações do funil:', {
              funil_id: existingLead.funil_id,
              etapa_id: existingLead.etapa_id,
              nomeFunil,
              nomeEtapa,
              funisCarregados: funis.length,
              etapasCarregadas: etapas.length
            });
            
            // Atualizar conversa com informações do funil
            setConversations(prev => prev.map(conv => 
              conv.id === conversation.id 
                ? { ...conv, funnelStage: nomeEtapa }
                : conv
            ));
            
            // Atualizar conversa selecionada se for a mesma
            if (selectedConv?.id === conversation.id) {
              setSelectedConv(prev => prev ? {
                ...prev,
                funnelStage: nomeEtapa
              } : null);
            }
          }, 100);
        }
        
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
    console.log('📞 [ENVIAR-WHATSAPP] Iniciando envio:', {
      numero: body.numero,
      tipo: body.tipo_mensagem,
      temMensagem: !!body.mensagem
    });
    
    const companyId = await getCompanyId();
    
    if (!companyId) {
      console.error('❌ [ENVIAR-WHATSAPP] Company ID não encontrado!');
      return { 
        data: null, 
        error: { message: 'Company ID não encontrado. Faça login novamente.' } 
      } as const;
    }
    
    console.log('📞 [ENVIAR-WHATSAPP] Company ID obtido:', companyId);
    
    // Usar wrapper com retry/timeout e retornar no formato compatível (data/error)
    const result = await sendWhatsAppWithRetry({
      company_id: companyId,
      ...body,
    });
    
    console.log('📞 [ENVIAR-WHATSAPP] Resultado do sendWhatsAppWithRetry:', {
      success: result?.success,
      errorCode: result?.errorCode,
      message: result?.message
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

  // Função para limpar histórico de conversas
  const handleCleanHistory = async () => {
    setCleaningHistory(true);
    try {
      const result = await cleanAllConversationsHistory(userCompanyId || undefined);
      
      if (result.success) {
        // ⚡ CORREÇÃO: Limpar APENAS o histórico de conversas, sem afetar outras funcionalidades
        // Não chamar loadSupabaseConversations() para evitar reinicialização desnecessária
        setConversations([]);
        setSelectedConv(null);
        setLeadVinculado(null);
        setLeadsVinculados({});
        
        // Limpar cache do hook de conversas também
        if (syncConversations) {
          await syncConversations(true); // Force refresh do cache
        }
        
        toast.success(
          `✅ Histórico limpo! ${result.supabaseResult?.deletedCount || 0} mensagens removidas. Todas as outras configurações foram preservadas.`,
          { duration: 5000 }
        );
        
        setCleanHistoryDialogOpen(false);
        
        console.log('✅ [CLEAN] Histórico limpo sem afetar funcionalidades:', {
          leadsPreservados: result.diagnosis?.leads.count,
          tarefasPreservadas: result.diagnosis?.tasks.count,
          funisPreservados: result.diagnosis?.funis.count,
          etapasPreservadas: result.diagnosis?.etapas.count,
          whatsappPreservado: result.diagnosis?.whatsappConnections.count
        });
      } else {
        toast.error(`❌ Erro ao limpar histórico: ${result.error || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error('❌ Erro ao limpar histórico:', error);
      toast.error(`❌ Erro ao limpar histórico: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setCleaningHistory(false);
    }
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

      // CORREÇÃO: Inserir mensagem de finalização com status Resolvida e fromme: true
      await supabase.from('conversas').insert([{
        numero: numeroNormalizado,
        telefone_formatado: numeroNormalizado,
        mensagem,
        origem: selectedConv.channel === 'whatsapp' ? 'WhatsApp' : selectedConv.channel === 'instagram' ? 'Instagram' : 'Facebook',
        status: 'Resolvida',
        tipo_mensagem: 'text',
        nome_contato: selectedConv.contactName,
        company_id: userRole?.company_id,
        fromme: true, // ⚡ CRÍTICO: Marcar como mensagem enviada para aparecer no lado direito
      }]);

      // CORREÇÃO: Atualizar TODAS as mensagens anteriores desta conversa para status Resolvida
      const telefoneFormatado = numeroNormalizado.replace(/[^0-9]/g, '');
      await supabase
        .from('conversas')
        .update({ status: 'Resolvida' })
        .eq('telefone_formatado', telefoneFormatado)
        .eq('company_id', userRole?.company_id)
        .neq('status', 'Resolvida'); // Só atualizar as que ainda não estão resolvidas

      console.log('✅ Conversa marcada como resolvida no banco');

      // Atualizar estados localmente
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
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar esquerda - tema cinza claro */}
      <div className="w-[380px] flex-shrink-0 bg-muted/30 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 bg-background border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-foreground">Conversas</h1>
            <div className="flex gap-2 items-center">
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
              <Dialog open={cleanHistoryDialogOpen} onOpenChange={setCleanHistoryDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    size="icon" 
                    variant="outline"
                    className="gap-0 text-destructive hover:text-destructive"
                    aria-label="Limpar histórico"
                    title="Limpar histórico de conversas"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-destructive" />
                      Limpar Histórico de Conversas
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-sm text-muted-foreground">
                      Esta ação irá <strong>permanentemente</strong> remover:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                      <li>Todas as mensagens da tabela <code className="bg-muted px-1 rounded">conversas</code> no banco de dados</li>
                      <li>Todos os caches de conversas no navegador (localStorage)</li>
                    </ul>
                    <div className="bg-muted/50 p-3 rounded-md">
                      <p className="text-sm font-semibold mb-1">⚠️ Esta ação NÃO pode ser desfeita!</p>
                      <p className="text-xs text-muted-foreground">
                        Após a limpeza, apenas novas mensagens recebidas/enviadas aparecerão no sistema.
                      </p>
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                      <p className="text-sm font-semibold mb-1 text-blue-900 dark:text-blue-100">✅ Dados preservados:</p>
                      <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-2">
                        <li>• Funil de Vendas (leads, kanban)</li>
                        <li>• Tarefas</li>
                        <li>• Agenda</li>
                        <li>• Todas as outras funcionalidades</li>
                      </ul>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCleanHistoryDialogOpen(false)}
                      disabled={cleaningHistory}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleCleanHistory}
                      disabled={cleaningHistory}
                    >
                      {cleaningHistory ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Limpando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Limpar Histórico
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
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
          {loadingConversations && conversations.length === 0 ? (
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
                
                // ⚡ CORREÇÃO CRÍTICA: Ordenar mensagens por timestamp antes de selecionar
                const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
                  return [...messages].sort((a, b) => {
                    const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                    const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                    return timeA - timeB;
                  });
                };

                // Marcar mensagens como lidas e visualizadas
                // CRÍTICO: Preservar avatarUrl ao atualizar e ordenar mensagens por timestamp
                const sortedMessages = sortMessagesByTimestamp(conv.messages);
                const updatedConv = {
                  ...conv,
                  unread: 0,
                  avatarUrl: conv.avatarUrl, // Garantir que avatar não seja perdido
                  messages: sortedMessages.map(msg => ({
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {selectedConv ? (
          <>
            <div className="sticky top-0 z-50 flex-shrink-0">
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
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* Messages - Área de scroll sem barra lateral visível */}
                <div 
                  id="messages-scroll-container"
                  className="flex-1 overflow-y-auto p-6 bg-[#e5ddd5] messages-scroll-area" 
                  style={{ 
                    backgroundImage: "url('data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d9d9d9' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                  } as React.CSSProperties}
                >
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
                </div>

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
                      <div className="mb-3 space-y-2">
                        {leadVinculado ? (
                          <>
                            <Badge variant="outline" className="w-full justify-center gap-2 py-2 bg-green-500/10 text-green-600 border-green-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="text-xs font-medium">Lead vinculado no CRM</span>
                            </Badge>
                            {/* Botão para editar informações do lead - usando o mesmo componente completo do menu Leads */}
                            <EditarLeadDialog
                              lead={{
                                id: leadVinculado.id,
                                nome: leadVinculado.name || selectedConv.contactName,
                                telefone: leadVinculado.phone || leadVinculado.telefone || selectedConv.phoneNumber || selectedConv.id,
                                email: leadVinculado.email || "",
                                cpf: leadVinculado.cpf || "",
                                value: leadVinculado.value || 0,
                                company: leadVinculado.company || "",
                                company_id: leadVinculado.company_id,
                                source: leadVinculado.source || "",
                                notes: leadVinculado.notes || "",
                                tags: leadVinculado.tags || [],
                                funil_id: leadVinculado.funil_id || undefined,
                                etapa_id: leadVinculado.etapa_id || undefined,
                              }}
                              onLeadUpdated={async () => {
                                // Recarregar informações do lead após atualização
                                if (selectedConv.phoneNumber || selectedConv.id) {
                                  const telefoneFormatado = safeFormatPhoneNumber(selectedConv.phoneNumber || selectedConv.id);
                                  const { data: leadAtualizado } = await supabase
                                    .from('leads')
                                    .select('*')
                                    .or(`phone.eq.${telefoneFormatado},telefone.eq.${telefoneFormatado}`)
                                    .maybeSingle();
                                  
                                  if (leadAtualizado) {
                                    setLeadVinculado(leadAtualizado);
                                    setLeadsVinculados(prev => ({
                                      ...prev,
                                      [selectedConv.id]: leadAtualizado.id,
                                      [safeFormatPhoneNumber(selectedConv.id)]: leadAtualizado.id
                                    }));
                                  }
                                }
                              }}
                              triggerButton={
                                <Button size="sm" variant="outline" className="w-full">
                                  <FileText className="h-3 w-3 mr-2" /> Editar Informações
                                </Button>
                              }
                            />
                          </>
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
                        {(!selectedConv.tags || selectedConv.tags.length === 0) && (
                          <p className="text-sm text-muted-foreground">Nenhuma tag adicionada</p>
                        )}
                      </div>
                      <Dialog onOpenChange={(open) => {
                        if (open) {
                          refreshTags(); // Atualizar tags quando abrir o dialog
                        }
                      }}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="w-full">
                            <Tag className="h-3 w-3 mr-2" /> Adicionar Tag
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Gerenciar Tags</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {/* Campo para criar nova tag */}
                            <div className="space-y-2">
                              <Label>Criar Nova Tag</Label>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Nome da tag"
                                  value={newTag}
                                  onChange={(e) => setNewTag(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newTag.trim()) {
                                      e.preventDefault();
                                      addTag();
                                    }
                                  }}
                                />
                                <Button onClick={addTag} disabled={!newTag.trim()}>
                                  Adicionar
                                </Button>
                              </div>
                            </div>
                            
                            {/* Lista de tags disponíveis para seleção */}
                            {allTags.length > 0 && (
                              <div className="space-y-2">
                                <Label>Tags Disponíveis</Label>
                                <ScrollArea className="h-[200px] border rounded-md p-2">
                                  <div className="flex flex-wrap gap-2">
                                    {allTags.map((tag) => {
                                      const isSelected = selectedConv.tags?.includes(tag) || false;
                                      return (
                                        <Badge
                                          key={tag}
                                          variant={isSelected ? "default" : "outline"}
                                          className="cursor-pointer hover:bg-primary/80"
                                          onClick={() => {
                                            if (isSelected) {
                                              // Remover tag
                                              removeTag(tag);
                                            } else {
                                              // Adicionar tag
                                              addExistingTag(tag);
                                            }
                                          }}
                                        >
                                          {tag}
                                          {isSelected && <X className="h-3 w-3 ml-1" />}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </ScrollArea>
                              </div>
                            )}
                            
                            {allTags.length === 0 && (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Nenhuma tag disponível. Crie uma nova tag acima.
                              </p>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>

                    {/* Funnel Stage */}
                    <div>
                      <h4 className="text-foreground font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Funil de Vendas
                      </h4>
                      {/* ⚡ CORREÇÃO: Verificar se lead está vinculado e tem funil_id */}
                      {leadVinculado?.funil_id ? (
                        <div className="mb-2 p-3 bg-primary/5 rounded-md border border-primary/20">
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Funil de Vendas:</p>
                              <p className="text-sm font-semibold text-foreground">
                                {funis.find(f => f.id === leadVinculado.funil_id)?.nome || "Carregando..."}
                              </p>
                            </div>
                            {leadVinculado.etapa_id && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1">Etapa Atual:</p>
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0" 
                                    style={{ 
                                      backgroundColor: etapas.find(e => e.id === leadVinculado.etapa_id)?.cor || '#3b82f6' 
                                    }}
                                  />
                                  <p className="text-sm font-medium text-foreground">
                                    {etapas.find(e => e.id === leadVinculado.etapa_id)?.nome || "Carregando..."}
                                  </p>
                                </div>
                              </div>
                            )}
                            {!leadVinculado.etapa_id && (
                              <p className="text-xs text-amber-600">Etapa não definida</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="mb-2">
                          <p className="text-sm text-muted-foreground">Não está em nenhum funil</p>
                        </div>
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
                                        <Label>Tipo de Mensagem *</Label>
                                        <Select value={newQuickMessageType} onValueChange={(value: "text" | "image" | "video") => {
                                          setNewQuickMessageType(value);
                                          setNewQuickMediaFile(null);
                                          setNewQuickMediaPreview(null);
                                        }}>
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="text">Texto</SelectItem>
                                            <SelectItem value="image">Imagem</SelectItem>
                                            <SelectItem value="video">Vídeo</SelectItem>
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
                                      {newQuickMessageType === "text" ? (
                                        <div className="space-y-2">
                                          <Label>Mensagem *</Label>
                                          <Textarea
                                            value={newQuickContent}
                                            onChange={(e) => setNewQuickContent(e.target.value)}
                                            placeholder="Digite a mensagem..."
                                            rows={3}
                                          />
                                        </div>
                                      ) : (
                                        <>
                                          <div className="space-y-2">
                                            <Label>Arquivo de {newQuickMessageType === "image" ? "Imagem" : "Vídeo"} *</Label>
                                            <Input
                                              type="file"
                                              accept={newQuickMessageType === "image" ? "image/*" : "video/*"}
                                              onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  setNewQuickMediaFile(file);
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                    setNewQuickMediaPreview(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              }}
                                            />
                                          </div>
                                          {newQuickMediaPreview && (
                                            <div className="space-y-2">
                                              <Label>Preview:</Label>
                                              {newQuickMessageType === "image" ? (
                                                <img src={newQuickMediaPreview} alt="Preview" className="max-w-full h-auto rounded border" style={{ maxHeight: '200px' }} />
                                              ) : (
                                                <video src={newQuickMediaPreview} controls className="max-w-full rounded border" style={{ maxHeight: '200px' }} />
                                              )}
                                            </div>
                                          )}
                                          <div className="space-y-2">
                                            <Label>Legenda (opcional)</Label>
                                            <Textarea
                                              value={newQuickContent}
                                              onChange={(e) => setNewQuickContent(e.target.value)}
                                              placeholder="Digite a legenda da mídia..."
                                              rows={2}
                                            />
                                          </div>
                                        </>
                                      )}
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
                                        // ⚡ CORREÇÃO: Manter ordem original das mensagens ao filtrar por categoria
                                        const categoryMessages = quickMessages
                                          .filter((msg) => msg.category === category.id)
                                          .sort((a, b) => {
                                            // Manter ordem original baseada na posição no array completo
                                            const indexA = quickMessages.findIndex(m => m.id === a.id);
                                            const indexB = quickMessages.findIndex(m => m.id === b.id);
                                            return indexA - indexB;
                                          });
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
                                                  {categoryMessages.map((qm, msgIndex) => (
                                                    <div
                                                      key={qm.id}
                                                      className="flex items-start justify-between p-3 bg-background rounded border"
                                                    >
                                                      {editingMessageId === qm.id ? (
                                                        // Modo de edição
                                                        <div className="flex-1 space-y-2">
                                                          <div className="space-y-2">
                                                            <Label>Tipo de Mensagem *</Label>
                                                            <Select value={editMessageType} onValueChange={(value: "text" | "image" | "video") => {
                                                              setEditMessageType(value);
                                                              if (value === "text") {
                                                                setEditMessageMediaFile(null);
                                                                setEditMessageMediaPreview(null);
                                                              }
                                                            }}>
                                                              <SelectTrigger>
                                                                <SelectValue />
                                                              </SelectTrigger>
                                                              <SelectContent>
                                                                <SelectItem value="text">Texto</SelectItem>
                                                                <SelectItem value="image">Imagem</SelectItem>
                                                                <SelectItem value="video">Vídeo</SelectItem>
                                                              </SelectContent>
                                                            </Select>
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label>Título *</Label>
                                                            <Input
                                                              value={editMessageTitle}
                                                              onChange={(e) => setEditMessageTitle(e.target.value)}
                                                              placeholder="Título da mensagem"
                                                            />
                                                          </div>
                                                          {editMessageType === "text" ? (
                                                            <div className="space-y-2">
                                                              <Label>Mensagem *</Label>
                                                              <Textarea
                                                                value={editMessageContent}
                                                                onChange={(e) => setEditMessageContent(e.target.value)}
                                                                placeholder="Conteúdo da mensagem"
                                                                rows={3}
                                                              />
                                                            </div>
                                                          ) : (
                                                            <>
                                                              <div className="space-y-2">
                                                                <Label>Arquivo de {editMessageType === "image" ? "Imagem" : "Vídeo"} *</Label>
                                                                <Input
                                                                  type="file"
                                                                  accept={editMessageType === "image" ? "image/*" : "video/*"}
                                                                  onChange={(e) => {
                                                                    const file = e.target.files?.[0];
                                                                    if (file) {
                                                                      setEditMessageMediaFile(file);
                                                                      const reader = new FileReader();
                                                                      reader.onloadend = () => {
                                                                        setEditMessageMediaPreview(reader.result as string);
                                                                      };
                                                                      reader.readAsDataURL(file);
                                                                    }
                                                                  }}
                                                                />
                                                                <p className="text-xs text-muted-foreground">
                                                                  Deixe em branco para manter o arquivo atual
                                                                </p>
                                                              </div>
                                                              {editMessageMediaPreview && (
                                                                <div className="space-y-2">
                                                                  <Label>Preview:</Label>
                                                                  {editMessageType === "image" ? (
                                                                    <img src={editMessageMediaPreview} alt="Preview" className="max-w-full h-auto rounded border" style={{ maxHeight: '150px' }} />
                                                                  ) : (
                                                                    <video src={editMessageMediaPreview} controls className="max-w-full rounded border" style={{ maxHeight: '150px' }} />
                                                                  )}
                                                                </div>
                                                              )}
                                                              <div className="space-y-2">
                                                                <Label>Legenda (opcional)</Label>
                                                                <Textarea
                                                                  value={editMessageContent}
                                                                  onChange={(e) => setEditMessageContent(e.target.value)}
                                                                  placeholder="Digite a legenda da mídia..."
                                                                  rows={2}
                                                                />
                                                              </div>
                                                            </>
                                                          )}
                                                          <div className="space-y-2">
                                                            <Label>Categoria *</Label>
                                                            <Select value={editMessageCategory} onValueChange={setEditMessageCategory}>
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
                                                          <div className="flex gap-2">
                                                            <Button size="sm" onClick={saveEditedMessage}>
                                                              Salvar
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={cancelEditMessage}>
                                                              Cancelar
                                                            </Button>
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        // Modo de visualização
                                                        <>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium">{qm.title}</p>
                                                            {qm.type === "image" && qm.mediaUrl && (
                                                              <div className="mt-2 mb-2">
                                                                <img 
                                                                  src={qm.mediaUrl} 
                                                                  alt={qm.title} 
                                                                  className="max-w-full h-auto rounded border" 
                                                                  style={{ maxHeight: '150px' }} 
                                                                />
                                                              </div>
                                                            )}
                                                            {qm.type === "video" && qm.mediaUrl && (
                                                              <div className="mt-2 mb-2">
                                                                <video 
                                                                  src={qm.mediaUrl} 
                                                                  controls 
                                                                  className="max-w-full rounded border" 
                                                                  style={{ maxHeight: '150px' }} 
                                                                />
                                                              </div>
                                                            )}
                                                            <p className="text-xs text-muted-foreground mt-1 break-words">
                                                              {qm.content}
                                                            </p>
                                                          </div>
                                                          <div className="flex gap-1 ml-2">
                                                            <Button
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => moveMessageUp(qm.id, category.id)}
                                                              disabled={msgIndex === 0}
                                                              title="Mover para cima"
                                                            >
                                                              ↑
                                                            </Button>
                                                            <Button
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => moveMessageDown(qm.id, category.id)}
                                                              disabled={msgIndex === categoryMessages.length - 1}
                                                              title="Mover para baixo"
                                                            >
                                                              ↓
                                                            </Button>
                                                            <Button
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => editQuickMessage(qm.id)}
                                                              title="Editar mensagem"
                                                            >
                                                              ✏️
                                                            </Button>
                                                            <Button
                                                              size="sm"
                                                              onClick={() => sendQuickMessage(qm)}
                                                            >
                                                              Enviar
                                                            </Button>
                                                            <Button
                                                              size="sm"
                                                              variant="destructive"
                                                              onClick={() => deleteQuickMessage(qm.id)}
                                                              title="Excluir mensagem"
                                                            >
                                                              ×
                                                            </Button>
                                                          </div>
                                                        </>
                                                      )}
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
                                    {quickCategories.map((cat, catIndex) => {
                                      const messageCount = quickMessages.filter(
                                        (msg) => msg.category === cat.id
                                      ).length;
                                      return (
                                        <div
                                          key={cat.id}
                                          className="flex items-center justify-between p-3 bg-muted rounded border"
                                        >
                                          {editingCategoryId === cat.id ? (
                                            // Modo de edição
                                            <div className="flex-1 flex gap-2 items-center">
                                              <Input
                                                value={editCategoryName}
                                                onChange={(e) => setEditCategoryName(e.target.value)}
                                                placeholder="Nome da categoria"
                                                className="flex-1"
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    saveEditedCategory();
                                                  }
                                                }}
                                              />
                                              <Button size="sm" onClick={saveEditedCategory}>
                                                Salvar
                                              </Button>
                                              <Button size="sm" variant="outline" onClick={cancelEditCategory}>
                                                Cancelar
                                              </Button>
                                            </div>
                                          ) : (
                                            // Modo de visualização
                                            <>
                                              <div className="flex items-center gap-3 flex-1">
                                                <span className="font-medium">{cat.name}</span>
                                                <Badge variant="secondary">
                                                  {messageCount} {messageCount === 1 ? "mensagem" : "mensagens"}
                                                </Badge>
                                              </div>
                                              <div className="flex gap-1">
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => moveCategoryUp(cat.id)}
                                                  disabled={catIndex === 0}
                                                  title="Mover para cima"
                                                >
                                                  ↑
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => moveCategoryDown(cat.id)}
                                                  disabled={catIndex === quickCategories.length - 1}
                                                  title="Mover para baixo"
                                                >
                                                  ↓
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => editQuickCategory(cat.id)}
                                                  title="Editar categoria"
                                                >
                                                  ✏️
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="destructive"
                                                  onClick={() => deleteQuickCategory(cat.id)}
                                                  disabled={messageCount > 0}
                                                  title="Excluir categoria"
                                                >
                                                  Excluir
                                                </Button>
                                              </div>
                                            </>
                                          )}
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
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      ⚡ Agende para qualquer momento futuro - sem limite de tempo!
                                    </p>
                                    <p className="text-xs text-primary/70">
                                      💡 Pode agendar para daqui a 5 minutos, 1 hora, dias ou meses
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
                                
                                {/* ⚡ OPÇÃO DE ENVIAR CONFIRMAÇÃO IMEDIATA */}
                                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                  <div className="space-y-0.5">
                                    <Label className="text-sm font-medium">Enviar confirmação por WhatsApp</Label>
                                    <p className="text-xs text-muted-foreground">
                                      Envia automaticamente a confirmação do agendamento
                                    </p>
                                  </div>
                                  <Switch
                                    checked={enviarConfirmacaoReuniao}
                                    onCheckedChange={setEnviarConfirmacaoReuniao}
                                  />
                                </div>

                                {/* ⚡ OPÇÃO DE CRIAR LEMBRETE AUTOMÁTICO */}
                                <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                      <Label className="text-sm font-medium">Criar lembrete automático</Label>
                                      <p className="text-xs text-muted-foreground">
                                        Envia lembrete antes do compromisso
                                      </p>
                                    </div>
                                    <Switch
                                      checked={enviarLembreteReuniao}
                                      onCheckedChange={setEnviarLembreteReuniao}
                                    />
                                  </div>
                                  
                                  {enviarLembreteReuniao && (
                                    <div className="space-y-2">
                                      <Label className="text-xs">Enviar com antecedência de</Label>
                                       <div className="flex items-center gap-2">
                                         <div className="flex-1">
                                           <Label className="text-xs text-muted-foreground mb-1 block">Horas</Label>
                                           <Select
                                             value={horasAntecedenciaReuniaoHoras}
                                             onValueChange={(value) => {
                                               setHorasAntecedenciaReuniaoHoras(value);
                                             }}
                                           >
                                             <SelectTrigger className="h-9">
                                               <SelectValue />
                                             </SelectTrigger>
                                             <SelectContent>
                                               {Array.from({ length: 25 }, (_, i) => (
                                                 <SelectItem key={i} value={i.toString()}>
                                                   {i} {i === 1 ? 'hora' : 'horas'}
                                                 </SelectItem>
                                               ))}
                                             </SelectContent>
                                           </Select>
                                         </div>
                                         <div className="flex-1">
                                           <Label className="text-xs text-muted-foreground mb-1 block">Minutos</Label>
                                           <Select
                                             value={horasAntecedenciaReuniaoMinutos}
                                             onValueChange={setHorasAntecedenciaReuniaoMinutos}
                                           >
                                             <SelectTrigger className="h-9">
                                               <SelectValue />
                                             </SelectTrigger>
                                             <SelectContent>
                                               {[0, 5, 10, 15, 20, 30, 45].map((min) => (
                                                 <SelectItem key={min} value={min.toString()}>
                                                   {min} {min === 1 ? 'minuto' : 'minutos'}
                                                 </SelectItem>
                                               ))}
                                             </SelectContent>
                                           </Select>
                                         </div>
                                       </div>
                                    </div>
                                  )}
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
