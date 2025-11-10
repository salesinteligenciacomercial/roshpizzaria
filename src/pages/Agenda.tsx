import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Calendar as CalendarIcon, Plus, Clock, User, Filter, Settings, Bell, CheckCircle2, XCircle, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLeadsSync } from "@/hooks/useLeadsSync";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useWorkflowAutomation } from "@/hooks/useWorkflowAutomation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { EditarCompromissoDialog } from "@/components/agenda/EditarCompromissoDialog";
import { AgendaColaboradores } from "@/components/agenda/AgendaColaboradores";

interface Lembrete {
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
  tentativas?: number;
  proxima_tentativa?: string;
  compromisso?: {
    id?: string;
    lead_id?: string;
    titulo?: string;
    data_hora_inicio: string;
    tipo_servico: string;
    lead?: {
      name: string;
      phone?: string;
    };
  };
}

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  capacidade_simultanea: number;
  tempo_medio_servico: number;
  disponibilidade: {
    dias: string[];
    horario_inicio: string;
    horario_fim: string;
  };
  responsavel_id?: string;
}

interface Compromisso {
  id: string;
  titulo?: string;
  agenda_id?: string;
  lead_id?: string;
  usuario_responsavel_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  observacoes?: string;
  custo_estimado?: number;
  lembrete_enviado: boolean;
  lead?: {
    name: string;
    phone?: string;
  };
  agenda?: {
    nome: string;
    tipo: string;
  };
}

interface Lead {
  id: string;
  name: string;
  phone?: string;
  telefone?: string;
  email?: string;
  tags?: string[];
}

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [novoCompromissoOpen, setNovoCompromissoOpen] = useState(false);
  const [configuracoesOpen, setConfiguracoesOpen] = useState(false);
  const [lembretes, setLembretes] = useState<Lembrete[]>([]);
  const [activeTab, setActiveTab] = useState<string>("agenda");
  const [filtroStatusLembrete, setFiltroStatusLembrete] = useState<string>("all");
  const [filtroCanalLembrete, setFiltroCanalLembrete] = useState<string>("all");
  
  // Cache de meses carregados para lazy loading
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
  
  // Cache de avatares dos leads
  const [leadAvatars, setLeadAvatars] = useState<Record<string, string>>({});
  const avatarCacheRef = useRef<Map<string, string>>(new Map());
  const avatarFetchingRef = useRef<Set<string>>(new Set());
  const companyIdRef = useRef<string | null>(null);

  // Sistema de eventos globais para comunicação entre módulos
  const { emitGlobalEvent } = useGlobalSync({
    callbacks: {
      // Receber eventos de outros módulos
      onLeadUpdated: (data) => {
        console.log('🌍 [Agenda] Lead atualizado via evento global:', { id: data.id, name: data.name });
        
        // Validar se dados do lead são válidos
        if (!data || !data.id) {
          console.warn('⚠️ [Agenda] Evento global de lead inválido:', data);
          return;
        }
        
        // Atualizar lista de leads também
        setLeads(prev => prev.map(lead => {
          if (lead.id === data.id) {
            console.log('✅ [Agenda] Lead atualizado na lista via evento global:', data.id);
            return {
              ...lead,
              name: data.name || lead.name,
              phone: data.phone || lead.phone,
              email: data.email || lead.email,
            };
          }
          return lead;
        }));
        
        // Atualizar compromissos relacionados ao lead - VALIDAÇÃO MELHORADA
        setCompromissos(prev => {
          let updated = false;
          const updatedComps = prev.map(comp => {
            // Validar se lead_id existe e corresponde ao lead atualizado
            if (comp.lead_id && comp.lead_id === data.id) {
              console.log('🔄 [Agenda] Atualizando compromisso via evento global:', comp.id, 'com novo lead:', data.name);
              
              // Criar objeto lead completo se não existir
              const leadData = {
                name: data.name || comp.lead?.name || '',
                phone: data.phone || comp.lead?.phone
              };
              
              updated = true;
              return {
                ...comp,
                lead: {
                  ...comp.lead,
                  ...leadData,
                }
              };
            }
            return comp;
          });
          
          if (updated) {
            console.log('✅ [Agenda] Compromissos atualizados via evento global:', updatedComps.filter(c => c.lead_id === data.id).length);
          }
          
          return updatedComps;
        });
      },
      onTaskCreated: (data) => {
        console.log('🌍 [Agenda] Nova tarefa criada, verificar se afeta agenda:', data);
        // Se uma tarefa foi criada, pode afetar disponibilidade
      },
      onMeetingScheduled: (data) => {
        console.log('🌍 [Agenda] Reunião agendada via evento global:', data);
        // Adicionar reunião à lista se for relevante
        // Isso pode vir de outros módulos criando reuniões
      },
      onFunnelStageChanged: (data) => {
        console.log('🌍 [Agenda] Lead movido no funil, verificar compromissos:', data);
        // Atualizar compromissos relacionados ao lead que mudou de etapa
      }
    },
    showNotifications: false
  });

  // Sistema de workflows automatizados
  useWorkflowAutomation({
    showNotifications: true
  });

  // Integrar sincronização de leads em tempo real
  useLeadsSync({
    onInsert: (newLead) => {
      console.log('📡 [Agenda] Novo lead adicionado via sync:', { id: newLead.id, name: newLead.name });
      setLeads(prev => {
        // Verificar se lead já existe para evitar duplicatas
        const existingIndex = prev.findIndex(l => l.id === newLead.id);
        if (existingIndex >= 0) {
          console.log('⚠️ [Agenda] Lead já existe, atualizando:', newLead.id);
          const updated = [...prev];
          updated[existingIndex] = newLead;
          return updated;
        }
        return [newLead, ...prev];
      });
    },
    onUpdate: (updatedLead, oldLead) => {
      console.log('📡 [Agenda] Lead atualizado via sync:', { 
        id: updatedLead.id, 
        name: updatedLead.name, 
        oldName: oldLead?.name,
        phone: updatedLead.phone 
      });
      
      // Atualizar lista de leads
      setLeads(prev => prev.map(lead => {
        if (lead.id === updatedLead.id) {
          console.log('✅ [Agenda] Lead atualizado na lista:', updatedLead.id);
          return updatedLead;
        }
        return lead;
      }));
      
      // Atualizar compromissos relacionados - VALIDAÇÃO MELHORADA
      setCompromissos(prev => {
        let updated = false;
        const updatedComps = prev.map(comp => {
          // Validar se lead_id existe e corresponde ao lead atualizado
          if (comp.lead_id && comp.lead_id === updatedLead.id) {
            console.log('🔄 [Agenda] Atualizando compromisso:', comp.id, 'com novo lead:', updatedLead.name);
            
            // Criar objeto lead completo se não existir
            const leadData = {
              name: updatedLead.name,
              phone: updatedLead.phone || comp.lead?.phone
            };
            
            updated = true;
            return {
              ...comp,
              lead: {
                ...comp.lead,
                ...leadData,
              }
            };
          }
          return comp;
        });
        
        if (updated) {
          console.log('✅ [Agenda] Compromissos atualizados:', updatedComps.filter(c => c.lead_id === updatedLead.id).length);
        }
        
        return updatedComps;
      });
    },
    onDelete: (deletedLead) => {
      console.log('📡 [Agenda] Lead removido via sync:', { id: deletedLead.id, name: deletedLead.name });
      
      // Remover da lista de leads
      setLeads(prev => {
        const filtered = prev.filter(lead => lead.id !== deletedLead.id);
        console.log(`✅ [Agenda] Lead removido da lista. Total antes: ${prev.length}, depois: ${filtered.length}`);
        return filtered;
      });
      
      // Limpar referências em compromissos - VALIDAÇÃO MELHORADA
      setCompromissos(prev => {
        let updated = false;
        const updatedComps = prev.map(comp => {
          // Validar se lead_id existe antes de limpar
          if (comp.lead_id && comp.lead_id === deletedLead.id) {
            console.log('🔄 [Agenda] Limpando referência ao lead no compromisso:', comp.id);
            updated = true;
            return {
              ...comp,
              lead_id: null,
              lead: undefined
            };
          }
          return comp;
        });
        
        if (updated) {
          console.log('✅ [Agenda] Referências ao lead removidas dos compromissos');
        }
        
        return updatedComps;
      });
    },
    showNotifications: false
  });

  // Form states para novo compromisso
  const [formData, setFormData] = useState({
    titulo: "",
    agenda_id: "",
    lead_id: "",
    data: format(new Date(), "yyyy-MM-dd"),
    hora_inicio: "09:00",
    hora_fim: "10:00",
    tipo_servico: "", // IMPORTANTE: deve começar vazio para forçar seleção
    observacoes: "",
    custo_estimado: "",
    enviar_lembrete: true,
    horas_antecedencia: "24",
    destinatario_lembrete: "lead",
  });
  
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadName, setSelectedLeadName] = useState("");

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const search = leadSearch.toLowerCase();
    return leads.filter((lead) => {
      const name = lead.name?.toLowerCase() || "";
      const phone = lead.phone?.toLowerCase() || "";
      const telefone = lead.telefone?.toLowerCase() || "";
      const tags = (lead.tags || []).join(" ").toLowerCase();
      return name.includes(search) || phone.includes(search) || telefone.includes(search) || tags.includes(search);
    });
  }, [leads, leadSearch]);

      // Função otimizada para carregar compromissos com range de datas
  const carregarCompromissos = useCallback(async (startDate?: Date, endDate?: Date) => {
    try {
      let query = supabase
        .from('compromissos')
        .select(`
          *,
          lead:leads(name, phone),
          agenda:agendas(nome, tipo)
        `)
        .order('data_hora_inicio', { ascending: true });

      // Se range de datas fornecido, filtrar
      if (startDate && endDate) {
        query = query
          .gte('data_hora_inicio', startDate.toISOString())
          .lte('data_hora_inicio', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      if (startDate && endDate) {
        // Lazy loading: adicionar ao cache existente
        setCompromissos(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newCompromissos = (data || []).filter(c => !existingIds.has(c.id));
          return [...prev, ...newCompromissos];
        });
      } else {
        // Carregamento inicial: substituir todos
        setCompromissos(data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar compromissos:', error);
      toast.error("Erro ao carregar compromissos");
    }
  }, []);

  // Função para carregar compromissos do mês atual ou específico
  const carregarCompromissosDoMes = useCallback(async (month?: Date) => {
    const targetMonth = month || selectedDate;
    const monthKey = format(targetMonth, 'yyyy-MM');
    
    // Verificar se o mês já foi carregado usando função de setter
    setLoadedMonths(prev => {
      if (prev.has(monthKey)) {
        console.log(`📅 [Performance] Mês ${monthKey} já carregado, pulando...`);
        return prev; // Não atualizar se já existe
      }
      
      console.log(`📅 [Performance] Carregando compromissos do mês ${monthKey}...`);
      
      const inicio = startOfMonth(targetMonth);
      const fim = endOfMonth(targetMonth);
      
      // Carregar compromissos de forma assíncrona
      carregarCompromissos(inicio, fim).then(() => {
        // Marcar mês como carregado após carregar
        setLoadedMonths(current => new Set(current).add(monthKey));
      });
      
      return prev; // Retornar estado atual enquanto carrega
    });
  }, [selectedDate]);

  // Função para normalizar telefone brasileiro
  const normalizePhoneBR = (phone: string): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return null;
    if (cleaned.length === 10) return `55${cleaned}`;
    if (cleaned.length === 11) return `55${cleaned}`;
    if (cleaned.startsWith("55") && cleaned.length === 13) return cleaned;
    if (cleaned.startsWith("55") && cleaned.length === 12) return cleaned;
    return cleaned;
  };

  // Função para buscar avatar do lead com cache
  const buscarAvatarLead = useCallback(async (lead: { id: string; name: string; phone?: string; telefone?: string }) => {
    const telefone = lead.phone || lead.telefone;
    if (!telefone) {
      // Sem telefone, usar fallback
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=32&bold=true`;
      setLeadAvatars(prev => ({ ...prev, [lead.id]: fallbackUrl }));
      return fallbackUrl;
    }

    // Verificar cache em memória
    if (leadAvatars[lead.id]) return leadAvatars[lead.id];

    // Verificar cache do Map
    const cacheKey = `lead-${lead.id}`;
    if (avatarCacheRef.current.has(cacheKey)) {
      const cached = avatarCacheRef.current.get(cacheKey)!;
      setLeadAvatars(prev => ({ ...prev, [lead.id]: cached }));
      return cached;
    }

    // Evitar múltiplos fetches simultâneos
    if (avatarFetchingRef.current.has(lead.id)) {
      return leadAvatars[lead.id] || `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=32&bold=true`;
    }

    avatarFetchingRef.current.add(lead.id);

    try {
      // Obter company_id se ainda não tiver
      if (!companyIdRef.current) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: userRole } = await supabase
            .from('user_roles')
            .select('company_id')
            .eq('user_id', user.id)
            .single();
          companyIdRef.current = userRole?.company_id || null;
        }
      }

      const telefoneNormalizado = normalizePhoneBR(telefone);
      if (!telefoneNormalizado) {
        throw new Error('Telefone inválido');
      }

      // Buscar foto com timeout de 5s
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      const fetchPromise = supabase.functions.invoke('get-profile-picture', {
        body: { number: telefoneNormalizado, company_id: companyIdRef.current }
      });

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (!error && data?.profilePictureUrl) {
        const avatarUrl = data.profilePictureUrl;
        setLeadAvatars(prev => ({ ...prev, [lead.id]: avatarUrl }));
        avatarCacheRef.current.set(cacheKey, avatarUrl);
        avatarFetchingRef.current.delete(lead.id);
        return avatarUrl;
      } else {
        throw new Error('Avatar não encontrado');
      }
    } catch (error) {
      // Fallback para avatar gerado
      const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(lead.name)}&background=10b981&color=fff&size=32&bold=true`;
      setLeadAvatars(prev => ({ ...prev, [lead.id]: fallbackUrl }));
      avatarCacheRef.current.set(cacheKey, fallbackUrl);
      avatarFetchingRef.current.delete(lead.id);
      return fallbackUrl;
    }
  }, [leadAvatars]);

  // Buscar avatares dos leads quando compromissos são carregados
  useEffect(() => {
    const buscarAvatares = async () => {
      const leadsComTelefone = compromissos
        .filter(c => c.lead_id && c.lead && c.lead.phone)
        .map(c => ({ 
          id: c.lead_id!, 
          name: c.lead!.name, 
          phone: c.lead!.phone
        }))
        .filter((lead, index, self) => 
          index === self.findIndex(l => l.id === lead.id)
        );

      for (const lead of leadsComTelefone) {
        const cacheKey = lead.id;
        if (!leadAvatars[cacheKey] && !avatarFetchingRef.current.has(cacheKey)) {
          buscarAvatarLead(lead);
        }
      }
    };

    if (compromissos.length > 0) {
      buscarAvatares();
    }
  }, [compromissos, buscarAvatarLead, leadAvatars]);

  // Buscar avatares dos leads quando lembretes são carregados
  useEffect(() => {
    const buscarAvataresLembretes = async () => {
      const leadsComTelefone = lembretes
        .filter(l => l.compromisso?.lead_id && l.compromisso?.lead && (l.compromisso.lead.phone || l.compromisso.lead.phone))
        .map(l => ({ 
          id: l.compromisso!.lead_id!, 
          name: l.compromisso!.lead!.name, 
          phone: l.compromisso!.lead!.phone
        }))
        .filter((lead, index, self) => 
          index === self.findIndex(l => l.id === lead.id)
        );

      for (const lead of leadsComTelefone) {
        const cacheKey = lead.id;
        if (!leadAvatars[cacheKey] && !avatarFetchingRef.current.has(cacheKey)) {
          buscarAvatarLead(lead);
        }
      }
    };

    if (lembretes.length > 0) {
      buscarAvataresLembretes();
    }
  }, [lembretes, buscarAvatarLead, leadAvatars]);

  useEffect(() => {
    // Carregar apenas compromissos do mês atual inicialmente (otimização)
    carregarCompromissosDoMes();
    carregarLeads();
    carregarAgendas();
    carregarLembretes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    
    // Subscrever para atualizações em tempo real
    const compromissosChannel = supabase
      .channel('compromissos_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compromissos'
        },
        () => {
          // Ao receber atualização em tempo real, recarregar apenas mês atual
          carregarCompromissosDoMes();
        }
      )
      .subscribe();

    // Subscrever lembretes em tempo real
    const lembretesChannel = supabase
      .channel('lembretes_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lembretes'
        },
        () => {
          carregarLembretes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(compromissosChannel);
      supabase.removeChannel(lembretesChannel);
    };
  }, [carregarCompromissosDoMes]);
  
  // Efeito para carregar compromissos quando mudar de mês
  useEffect(() => {
    const currentMonth = format(selectedDate, 'yyyy-MM');
    const monthKey = format(startOfMonth(selectedDate), 'yyyy-MM');
    
    // Verificar se precisa carregar o mês atual
    if (!loadedMonths.has(monthKey)) {
      console.log(`📅 [Performance] Mês atual não carregado: ${monthKey}, carregando...`);
      carregarCompromissosDoMes(selectedDate);
    }
  }, [selectedDate, loadedMonths, carregarCompromissosDoMes]);


  const carregarLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, telefone, email, tags')
        .order('name');

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    }
  };

  const carregarAgendas = async () => {
    try {
      const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .eq('status', 'ativo')
        .order('nome');

      if (error) throw error;
      setAgendas((data || []) as unknown as Agenda[]);
    } catch (error) {
      console.error('Erro ao carregar agendas:', error);
    }
  };

  const carregarLembretes = async () => {
    try {
      const { data, error } = await supabase
        .from('lembretes')
        .select(`
          *,
          compromisso:compromissos(
            id,
            lead_id,
            data_hora_inicio,
            tipo_servico,
            lead:leads(name, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLembretes((data || []) as unknown as Lembrete[]);
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
      toast.error("Erro ao carregar lembretes");
    }
  };

  const criarCompromisso = async () => {
    try {
      // === VALIDAÇÕES FRONTEND ===
      
      // 1. Validar tipo de serviço (obrigatório)
      if (!formData.tipo_servico || formData.tipo_servico.trim() === '') {
        toast.error("Por favor, selecione o tipo de serviço");
        return;
      }

      // 2. Validar data e horários
      if (!formData.data || !formData.hora_inicio || !formData.hora_fim) {
        toast.error("Por favor, preencha data e horários");
        return;
      }

      const dataHoraInicio = new Date(`${formData.data}T${formData.hora_inicio}:00`);
      const dataHoraFim = new Date(`${formData.data}T${formData.hora_fim}:00`);
      
      // 3. Validar se data/hora não está no passado (com margem de 1 minuto para evitar falsos positivos)
      const agora = new Date();
      const umMinutoAtras = new Date(agora.getTime() - 60000); // 1 minuto de margem
      
      if (dataHoraInicio < umMinutoAtras) {
        toast.error("Não é possível agendar compromissos no passado");
        return;
      }

      // 4. Validar se hora fim é depois da hora início
      if (dataHoraFim <= dataHoraInicio) {
        toast.error("O horário de término deve ser após o horário de início");
        return;
      }

      // 5. Validar duração mínima (15 minutos)
      const duracaoMinutos = (dataHoraFim.getTime() - dataHoraInicio.getTime()) / (1000 * 60);
      if (duracaoMinutos < 15) {
        toast.error("O compromisso deve ter no mínimo 15 minutos de duração");
        return;
      }

      // 6. Validar valor estimado se preenchido
      if (formData.custo_estimado && parseFloat(formData.custo_estimado) < 0) {
        toast.error("O valor estimado não pode ser negativo");
        return;
      }

      // === AUTENTICAÇÃO ===
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar autenticado para criar um compromisso");
        throw new Error("Usuário não autenticado");
      }

      console.log('🔍 [DEBUG] Criando compromisso para usuário:', user.id);

      // Obter company_id do usuário ANTES de criar compromisso
      const { data: userRole, error: userRoleError } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (userRoleError) {
        console.error('❌ [DEBUG] Erro ao buscar user_role:', userRoleError);
        throw new Error(`Erro ao obter informações da empresa: ${userRoleError.message}`);
      }

      if (!userRole || !userRole.company_id) {
        console.error('❌ [DEBUG] userRole ou company_id não encontrado:', { userRole });
        toast.error("Erro: Usuário não está associado a nenhuma empresa. Por favor, entre em contato com o administrador.");
        throw new Error("Usuário não está associado a nenhuma empresa. company_id é obrigatório.");
      }

      console.log('✅ [DEBUG] company_id obtido:', userRole.company_id);
      console.log('📋 [DEBUG] Dados do formulário:', {
        titulo: formData.titulo,
        tipo_servico: formData.tipo_servico,
        data: formData.data,
        hora_inicio: formData.hora_inicio,
        hora_fim: formData.hora_fim,
        agenda_id: formData.agenda_id || 'nenhuma',
        lead_id: formData.lead_id || 'nenhum',
        custo_estimado: formData.custo_estimado || '0'
      });

      // Validar agenda se selecionada
      if (formData.agenda_id) {
        // Carregar agendas se ainda não foram carregadas
        let agendasDisponiveis = agendas;
        if (agendasDisponiveis.length === 0) {
          const { data: agendasData } = await supabase
            .from('agendas')
            .select('*')
            .eq('status', 'ativo');
          agendasDisponiveis = (agendasData || []) as unknown as Agenda[];
        }
        
        const agendaSelecionada = agendasDisponiveis.find(a => a.id === formData.agenda_id);
        
        if (!agendaSelecionada) {
          toast.error("Agenda selecionada não encontrada");
          return;
        }

        // Validar disponibilidade - dia da semana
        const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const diaSemana = diasSemana[dataHoraInicio.getDay()];
        
        if (!agendaSelecionada.disponibilidade?.dias?.includes(diaSemana)) {
          toast.error(`A agenda "${agendaSelecionada.nome}" não está disponível neste dia da semana`);
          return;
        }

        // Validar disponibilidade - horário
        const [horaInicioDisponivel, minutoInicioDisponivel] = agendaSelecionada.disponibilidade.horario_inicio.split(':').map(Number);
        const [horaFimDisponivel, minutoFimDisponivel] = agendaSelecionada.disponibilidade.horario_fim.split(':').map(Number);
        const inicioDisponivel = horaInicioDisponivel * 60 + minutoInicioDisponivel;
        const fimDisponivel = horaFimDisponivel * 60 + minutoFimDisponivel;
        
        const [horaInicio, minutoInicio] = formData.hora_inicio.split(':').map(Number);
        const [horaFim, minutoFim] = formData.hora_fim.split(':').map(Number);
        const inicioSolicitado = horaInicio * 60 + minutoInicio;
        const fimSolicitado = horaFim * 60 + minutoFim;

        if (inicioSolicitado < inicioDisponivel || fimSolicitado > fimDisponivel) {
          toast.error(`O horário está fora do horário de funcionamento da agenda (${agendaSelecionada.disponibilidade.horario_inicio} - ${agendaSelecionada.disponibilidade.horario_fim})`);
          return;
        }

        // Validar capacidade simultânea
        const { data: compromissosAgenda, error: capacidadeError } = await supabase
          .from('compromissos')
          .select('id')
          .eq('agenda_id', formData.agenda_id)
          .eq('status', 'agendado')
          .lt('data_hora_inicio', dataHoraFim.toISOString())
          .gt('data_hora_fim', dataHoraInicio.toISOString());

        if (capacidadeError) {
          console.error('❌ [DEBUG] Erro ao verificar capacidade:', capacidadeError);
          throw capacidadeError;
        }

        const ocupacaoAtual = compromissosAgenda?.length || 0;
        if (ocupacaoAtual >= agendaSelecionada.capacidade_simultanea) {
          toast.error(`A agenda "${agendaSelecionada.nome}" já está com capacidade máxima (${agendaSelecionada.capacidade_simultanea} compromissos simultâneos)`);
          return;
        }
      }

      // Checar conflito de horários (por usuário responsável, status agendado)
      // Se agenda_id foi selecionado, também verificar conflitos na agenda
      const conflitosQuery = supabase
        .from('compromissos')
        .select('id, data_hora_inicio, data_hora_fim')
        .eq('status', 'agendado')
        .lt('data_hora_inicio', dataHoraFim.toISOString())
        .gte('data_hora_fim', dataHoraInicio.toISOString());

      if (formData.agenda_id) {
        conflitosQuery.eq('agenda_id', formData.agenda_id);
      } else {
        conflitosQuery.eq('usuario_responsavel_id', user.id);
      }

      const { data: conflitos, error: conflitoError } = await conflitosQuery;

      if (conflitoError) {
        console.error('❌ [DEBUG] Erro ao verificar conflitos:', conflitoError);
        throw conflitoError;
      }

      if (conflitos && conflitos.length > 0) {
        const mensagem = formData.agenda_id 
          ? "Conflito de horário: já existe um compromisso nessa agenda nesse intervalo"
          : "Conflito de horário: já existe um compromisso nesse intervalo";
        toast.error(mensagem);
        return;
      }

      // Criar compromisso COM company_id e agenda_id
      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .insert({
          titulo: formData.titulo?.trim() || null,
          agenda_id: formData.agenda_id || null,
          lead_id: formData.lead_id || null,
          usuario_responsavel_id: user.id,
          owner_id: user.id,
          company_id: userRole.company_id, // Adicionar company_id ao compromisso
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico: formData.tipo_servico,
          observacoes: formData.observacoes,
          custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : null,
          status: 'agendado',
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [DEBUG] Erro ao criar compromisso:', error);
        
        // Mensagens de erro mais específicas
        if (error.message.includes('company_id')) {
          toast.error("Erro: Empresa não identificada. Entre em contato com o suporte.");
        } else if (error.message.includes('usuario_responsavel_id')) {
          toast.error("Erro: Usuário responsável não identificado.");
        } else if (error.message.includes('tipo_servico')) {
          toast.error("Erro: Tipo de serviço é obrigatório.");
        } else if (error.message.includes('violates check constraint')) {
          toast.error("Erro: Os dados fornecidos não atendem aos requisitos.");
        } else {
          toast.error(`Erro ao criar compromisso: ${error.message}`);
        }
        
        throw error;
      }

      console.log('✅ [DEBUG] Compromisso criado com sucesso:', compromisso?.id);

      // Criar lembrete se solicitado
      if (formData.enviar_lembrete && compromisso) {
        console.log('📝 [DEBUG] Criando lembrete para compromisso:', compromisso.id);

        // Validar que company_id existe (já obtido anteriormente)
        if (!userRole.company_id) {
          console.error('❌ [DEBUG] company_id não disponível para criar lembrete');
          toast.error("Erro: Não foi possível criar o lembrete. Usuário não está associado a uma empresa.");
          throw new Error("company_id é obrigatório para criar lembretes.");
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // Calcular data de envio do lembrete
        const dataEnvio = new Date(dataHoraInicio);
        dataEnvio.setHours(dataEnvio.getHours() - parseInt(formData.horas_antecedencia));

        const leadSelecionado = leads.find(l => l.id === formData.lead_id);

        const lembreteData = {
          compromisso_id: compromisso.id,
          canal: 'whatsapp',
          horas_antecedencia: parseInt(formData.horas_antecedencia),
          mensagem: `Olá! Lembramos do seu compromisso agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
          status_envio: 'pendente',
          data_envio: dataEnvio.toISOString(),
          destinatario: formData.destinatario_lembrete,
          telefone_responsavel: profile?.full_name || user?.email,
          company_id: userRole.company_id, // Usar company_id validado
        };

        console.log('📝 [DEBUG] Dados do lembrete:', { ...lembreteData, mensagem: '[oculta]' });

        const { error: lembreteError } = await supabase
          .from('lembretes')
          .insert(lembreteData);

        if (lembreteError) {
          console.error('❌ [DEBUG] Erro ao criar lembrete:', lembreteError);
          toast.error("Compromisso criado, mas houve erro ao criar o lembrete. Por favor, tente novamente.");
          throw lembreteError;
        }

        console.log('✅ [DEBUG] Lembrete criado com sucesso para compromisso:', compromisso.id);
      }

      toast.success("Compromisso criado com sucesso!");

      // Emitir evento global para sincronização
      if (compromisso) {
        emitGlobalEvent({
          type: 'meeting-scheduled',
          data: {
            ...compromisso,
            lead_id: formData.lead_id,
            title: formData.tipo_servico,
            date: dataHoraInicio.toISOString(),
            duration: (dataHoraFim.getTime() - dataHoraInicio.getTime()) / (1000 * 60), // duração em minutos
            status: 'scheduled',
            description: formData.observacoes
          },
          source: 'Agenda'
        });
      }

      setNovoCompromissoOpen(false);
      limparFormulario();
      // Realtime já atualizará a lista; evitar recarga completa
    } catch (error: any) {
      console.error('❌ [ERRO DETALHADO] Erro ao criar compromisso:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        formData: {
          tipo_servico: formData.tipo_servico,
          data: formData.data,
          horarios: `${formData.hora_inicio} - ${formData.hora_fim}`,
          agenda: formData.agenda_id || 'nenhuma',
          lead: formData.lead_id || 'nenhum'
        }
      });
      
      // Se não mostrou mensagem específica antes, mostrar genérica
      if (!error?.message?.includes('Erro:')) {
        toast.error("Erro ao criar compromisso. Verifique os campos e tente novamente.");
      }
    }
  };

  const atualizarStatus = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('compromissos')
        .update({ status: novoStatus })
        .eq('id', id);

      if (error) throw error;
      toast.success("Status atualizado!");
      // Atualização otimista; realtime confirmará
      setCompromissos(prev => prev.map(c => c.id === id ? { ...c, status: novoStatus } : c));
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error("Erro ao atualizar status");
    }
  };

  const deletarCompromisso = async (id: string) => {
    try {
      // Primeiro deletar lembretes associados
      await supabase
        .from('lembretes')
        .delete()
        .eq('compromisso_id', id);

      // Depois deletar o compromisso
      const { error } = await supabase
        .from('compromissos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Compromisso deletado com sucesso!");
      // Atualização otimista; realtime confirmará
      setCompromissos(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Erro ao deletar compromisso:', error);
      toast.error("Erro ao deletar compromisso");
    }
  };

  const limparFormulario = () => {
    console.log('🧹 [DEBUG] Limpando formulário de agendamento');
    setFormData({
      titulo: "",
      agenda_id: "",
      lead_id: "",
      data: format(new Date(), "yyyy-MM-dd"),
      hora_inicio: "09:00",
      hora_fim: "10:00",
      tipo_servico: "", // Limpar para forçar nova seleção
      observacoes: "",
      custo_estimado: "",
      enviar_lembrete: true,
      horas_antecedencia: "24",
      destinatario_lembrete: "lead",
    });
    setLeadSearch("");
    setSelectedLeadName("");
  };

  // Limpar formulário quando fechar o dialog
  useEffect(() => {
    if (!novoCompromissoOpen) {
      limparFormulario();
    }
  }, [novoCompromissoOpen]);

  // Memoizar compromissos do mês para evitar recálculos desnecessários
  const compromissosDoMes = useMemo(() => {
    const inicio = startOfMonth(selectedDate);
    const fim = endOfMonth(selectedDate);
    
    return compromissos.filter((c) => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return dataCompromisso >= inicio && dataCompromisso <= fim;
    });
  }, [compromissos, selectedDate]);

  // Memoizar compromissos do dia com filtro de status
  const compromissosDoDia = useMemo(() => {
    return compromissos.filter((c) => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return isSameDay(dataCompromisso, selectedDate);
    }).filter(c => {
      if (filterStatus === "all") return true;
      return c.status === filterStatus;
    });
  }, [compromissos, selectedDate, filterStatus]);

  const getStatusBadge = (status: string) => {
    const badges = {
      agendado: <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>,
      concluido: <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>,
      cancelado: <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>,
    };
    return badges[status] || badges.agendado;
  };

  const reenviarLembrete = async (lembreteId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('enviar-lembretes', {
        body: { lembrete_id: lembreteId, force: true }
      });

      if (error) throw error;

      toast.success("Lembrete reenviado com sucesso!");
      carregarLembretes();
    } catch (error) {
      console.error('Erro ao reenviar lembrete:', error);
      toast.error("Erro ao reenviar lembrete");
    }
  };

  const lembretesFiltrados = lembretes.filter((lembrete) => {
    if (filtroStatusLembrete !== "all" && lembrete.status_envio !== filtroStatusLembrete) return false;
    if (filtroCanalLembrete !== "all" && lembrete.canal !== filtroCanalLembrete) return false;
    return true;
  });

  // Memoizar estatísticas para evitar recálculos
  const estatisticas = useMemo(() => ({
    total: compromissosDoMes.length,
    agendados: compromissosDoMes.filter(c => c.status === 'agendado').length,
    concluidos: compromissosDoMes.filter(c => c.status === 'concluido').length,
    cancelados: compromissosDoMes.filter(c => c.status === 'cancelado').length,
  }), [compromissosDoMes]);

  const estatisticasLembretes = {
    total: lembretes.length,
    enviados: lembretes.filter(l => l.status_envio === 'enviado').length,
    pendentes: lembretes.filter(l => l.status_envio === 'pendente').length,
    erro: lembretes.filter(l => l.status_envio === 'erro').length,
    retry: lembretes.filter(l => l.status_envio === 'retry').length,
    taxaSucesso: lembretes.length > 0 ? Math.round((lembretes.filter(l => l.status_envio === 'enviado').length / lembretes.length) * 100) : 0,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agenda</h1>
          <p className="text-muted-foreground">Gerencie seus compromissos e agendamentos</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={configuracoesOpen} onOpenChange={setConfiguracoesOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configurações de Agenda</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tempo médio padrão (minutos)</Label>
                  <Input type="number" defaultValue="30" />
                </div>
                <div className="space-y-2">
                  <Label>Horário comercial</Label>
                  <div className="flex gap-2">
                    <Input type="time" defaultValue="08:00" />
                    <Input type="time" defaultValue="18:00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Canal de lembrete padrão</Label>
                  <Select defaultValue="whatsapp">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="push">Notificação Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full">Salvar Configurações</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={novoCompromissoOpen} onOpenChange={setNovoCompromissoOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    placeholder="Assunto do compromisso (opcional)"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Agenda (Opcional)</Label>
                  <Select value={formData.agenda_id || "none"} onValueChange={(value) => setFormData({ ...formData, agenda_id: value === "none" ? "" : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma agenda ou deixe vazio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma agenda</SelectItem>
                      {agendas.map((agenda) => (
                        <SelectItem key={agenda.id} value={agenda.id}>
                          {agenda.nome} ({agenda.tipo}) - {agenda.disponibilidade?.horario_inicio} às {agenda.disponibilidade?.horario_fim}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.agenda_id && (
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const agenda = agendas.find(a => a.id === formData.agenda_id);
                        return agenda ? `Capacidade: ${agenda.capacidade_simultanea} simultâneos | Dias: ${agenda.disponibilidade?.dias?.join(', ')}` : '';
                      })()}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Cliente / Lead</Label>
                  <Input
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Buscar por nome, telefone ou tag..."
                  />
                  {leadSearch && (
                    <div className="border rounded-md max-h-40 overflow-y-auto">
                      {filteredLeads.length > 0 ? (
                        filteredLeads.map((lead) => (
                          <button
                            key={lead.id}
                            type="button"
                            onClick={() => {
                              setFormData({...formData, lead_id: lead.id});
                              setSelectedLeadName(lead.name);
                              setLeadSearch("");
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                          >
                            <div className="font-medium">{lead.name}</div>
                            {(lead.phone || lead.telefone) && (
                              <div className="text-xs text-muted-foreground">
                                {lead.phone || lead.telefone}
                              </div>
                            )}
                            {lead.tags && lead.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {lead.tags.slice(0, 3).map((tag: string) => (
                                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhum lead encontrado
                        </div>
                      )}
                    </div>
                  )}
                  {selectedLeadName && (
                    <div className="flex items-center justify-between p-2 bg-primary/10 rounded-md">
                      <span className="text-sm font-medium">{selectedLeadName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData({...formData, lead_id: ""});
                          setSelectedLeadName("");
                        }}
                        className="h-6 px-2"
                      >
                        Remover
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data <span className="text-destructive">*</span></Label>
                    <Input 
                      type="date" 
                      value={formData.data}
                      min={format(new Date(), "yyyy-MM-dd")}
                      onChange={(e) => setFormData({...formData, data: e.target.value})}
                      className={!formData.data ? "border-amber-500" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário de início <span className="text-destructive">*</span></Label>
                    <Input 
                      type="time" 
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})}
                      className={!formData.hora_inicio ? "border-amber-500" : ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Horário de término <span className="text-destructive">*</span></Label>
                  <Input 
                    type="time" 
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({...formData, hora_fim: e.target.value})}
                    className={!formData.hora_fim ? "border-amber-500" : ""}
                  />
                  <p className="text-xs text-muted-foreground">
                    Duração mínima de 15 minutos
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de serviço <span className="text-destructive">*</span></Label>
                  <Select 
                    value={formData.tipo_servico} 
                    onValueChange={(value) => setFormData({...formData, tipo_servico: value})}
                  >
                    <SelectTrigger className={!formData.tipo_servico ? "border-amber-500" : ""}>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reuniao">Reunião</SelectItem>
                      <SelectItem value="consultoria">Consultoria</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="visita">Visita</SelectItem>
                      <SelectItem value="apresentacao">Apresentação</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  {!formData.tipo_servico && (
                    <p className="text-xs text-amber-600">Campo obrigatório</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Valor estimado (R$)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={formData.custo_estimado}
                    onChange={(e) => setFormData({...formData, custo_estimado: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    placeholder="Observações internas sobre o compromisso..."
                    value={formData.observacoes}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label>Enviar lembrete automático</Label>
                    <p className="text-xs text-muted-foreground">
                      O cliente receberá um lembrete via WhatsApp
                    </p>
                  </div>
                  <Switch 
                    checked={formData.enviar_lembrete}
                    onCheckedChange={(checked) => setFormData({...formData, enviar_lembrete: checked})}
                  />
                </div>

                {formData.enviar_lembrete && (
                  <>
                    <div className="space-y-2">
                      <Label>Enviar lembrete para</Label>
                      <Select value={formData.destinatario_lembrete} onValueChange={(value) => setFormData({...formData, destinatario_lembrete: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Apenas o Lead</SelectItem>
                          <SelectItem value="responsavel">Apenas o Responsável</SelectItem>
                          <SelectItem value="ambos">Lead e Responsável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Horas de antecedência</Label>
                      <Select value={formData.horas_antecedencia} onValueChange={(value) => setFormData({...formData, horas_antecedencia: value})}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 hora antes</SelectItem>
                          <SelectItem value="3">3 horas antes</SelectItem>
                          <SelectItem value="24">24 horas antes</SelectItem>
                          <SelectItem value="48">48 horas antes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Button 
                  className="w-full" 
                  onClick={criarCompromisso}
                  disabled={!formData.tipo_servico || !formData.data || !formData.hora_inicio || !formData.hora_fim}
                >
                  {!formData.tipo_servico || !formData.data || !formData.hora_inicio || !formData.hora_fim 
                    ? "Preencha os campos obrigatórios"
                    : "Criar Agendamento"
                  }
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  <span className="text-destructive">*</span> Campos obrigatórios
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{estatisticas.total}</div>
            <p className="text-xs text-muted-foreground">Compromissos do mês</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{estatisticas.agendados}</div>
            <p className="text-xs text-muted-foreground">Agendados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{estatisticas.concluidos}</div>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{estatisticas.cancelados}</div>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas de Lembretes */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{estatisticasLembretes.total}</div>
            <p className="text-xs text-muted-foreground">Total de lembretes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{estatisticasLembretes.enviados}</div>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{estatisticasLembretes.pendentes}</div>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{estatisticasLembretes.retry}</div>
            <p className="text-xs text-muted-foreground">Em retry</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{estatisticasLembretes.erro}</div>
            <p className="text-xs text-muted-foreground">Com erro</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">{estatisticasLembretes.taxaSucesso}%</div>
            <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs principais */}
      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="lista">Lista de Compromissos</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
          <TabsTrigger value="minhas-agendas">Minhas Agendas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendário */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Calendário
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      // Lazy loading: carregar compromissos do mês quando mudar de data
                      const newMonth = format(date, 'yyyy-MM');
                      const currentMonth = format(selectedDate, 'yyyy-MM');
                      if (newMonth !== currentMonth) {
                        console.log(`📅 [Performance] Mudança de mês detectada: ${currentMonth} -> ${newMonth}`);
                        carregarCompromissosDoMes(date);
                      }
                    }
                  }}
                  onMonthChange={(date) => {
                    // Lazy loading: carregar compromissos quando usuário navegar para novo mês
                    console.log(`📅 [Performance] Navegação para mês: ${format(date, 'yyyy-MM')}`);
                    carregarCompromissosDoMes(date);
                  }}
                  locale={ptBR}
                  className="rounded-md border"
                />
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-sm">Agendado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm">Concluído</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm">Cancelado</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compromissos do dia */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="agendado">Agendados</SelectItem>
                      <SelectItem value="concluido">Concluídos</SelectItem>
                      <SelectItem value="cancelado">Cancelados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {compromissosDoDia.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum compromisso para este dia</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {compromissosDoDia.map((compromisso) => (
                        <Card key={compromisso.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-2">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{compromisso.titulo || compromisso.tipo_servico}</span>
                                  {getStatusBadge(compromisso.status)}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(parseISO(compromisso.data_hora_inicio), "HH:mm")} - {format(parseISO(compromisso.data_hora_fim), "HH:mm")}
                                </p>
                                {compromisso.agenda && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CalendarIcon className="h-3 w-3" />
                                    {compromisso.agenda.nome} ({compromisso.agenda.tipo})
                                  </p>
                                )}
                                {compromisso.lead && (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage 
                                        src={compromisso.lead_id ? leadAvatars[compromisso.lead_id] : undefined} 
                                        alt={compromisso.lead.name}
                                        onError={(e) => {
                                          // Se falhar, tentar buscar
                                          if (compromisso.lead_id && compromisso.lead) {
                                            buscarAvatarLead({
                                              id: compromisso.lead_id,
                                              name: compromisso.lead.name,
                                              phone: compromisso.lead.phone,
                                              telefone: compromisso.lead.phone
                                            });
                                          }
                                        }}
                                      />
                                      <AvatarFallback className="h-6 w-6 text-xs bg-primary/10">
                                        {compromisso.lead.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm">{compromisso.lead.name}</span>
                                  </div>
                                )}
                                {compromisso.observacoes && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {compromisso.observacoes}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <EditarCompromissoDialog
                                  compromisso={compromisso}
                                  onCompromissoUpdated={carregarCompromissos}
                                />
                                {compromisso.status === 'agendado' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => atualizarStatus(compromisso.id, 'concluido')}
                                      title="Marcar como concluído"
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => atualizarStatus(compromisso.id, 'cancelado')}
                                      title="Cancelar compromisso"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      title="Deletar compromisso"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja deletar este compromisso? Esta ação não pode ser desfeita e todos os lembretes associados também serão removidos.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deletarCompromisso(compromisso.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Deletar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lista">
          <Card>
            <CardHeader>
              <CardTitle>Todos os Compromissos</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {compromissos.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum compromisso cadastrado</p>
                    </div>
                  ) : (
                    compromissos.map((compromisso) => (
                      <Card key={compromisso.id} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{compromisso.titulo || compromisso.tipo_servico}</span>
                                {getStatusBadge(compromisso.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              {compromisso.agenda && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <CalendarIcon className="h-3 w-3" />
                                  {compromisso.agenda.nome} ({compromisso.agenda.tipo})
                                </p>
                              )}
                              {compromisso.lead && (
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage 
                                      src={compromisso.lead_id ? leadAvatars[compromisso.lead_id] : undefined} 
                                      alt={compromisso.lead.name}
                                      onError={(e) => {
                                        if (compromisso.lead_id && compromisso.lead) {
                                          buscarAvatarLead({
                                            id: compromisso.lead_id,
                                            name: compromisso.lead.name,
                                            phone: compromisso.lead.phone,
                                            telefone: compromisso.lead.phone
                                          });
                                        }
                                      }}
                                    />
                                    <AvatarFallback className="h-6 w-6 text-xs bg-primary/10">
                                      {compromisso.lead.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{compromisso.lead.name}</span>
                                </div>
                              )}
                              {compromisso.custo_estimado && (
                                <p className="text-sm font-medium text-primary">
                                  R$ {compromisso.custo_estimado.toFixed(2)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <EditarCompromissoDialog
                                compromisso={compromisso}
                                onCompromissoUpdated={carregarCompromissos}
                              />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Deletar compromisso"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tem certeza que deseja deletar este compromisso? Esta ação não pode ser desfeita e todos os lembretes associados também serão removidos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletarCompromisso(compromisso.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Deletar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lembretes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Histórico de Lembretes
              </CardTitle>
              <div className="flex gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filtroStatusLembrete} onValueChange={setFiltroStatusLembrete}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="enviado">Enviado</SelectItem>
                      <SelectItem value="erro">Erro</SelectItem>
                      <SelectItem value="retry">Retry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={filtroCanalLembrete} onValueChange={setFiltroCanalLembrete}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {lembretesFiltrados.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>{lembretes.length === 0 ? "Nenhum lembrete criado" : "Nenhum lembrete encontrado com os filtros aplicados"}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lembretesFiltrados.map((lembrete) => (
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
                                    {lembrete.compromisso?.titulo || lembrete.compromisso?.tipo_servico || 'Compromisso'}
                                  </span>
                                  <Badge variant={
                                    lembrete.status_envio === 'enviado' ? 'default' :
                                    lembrete.status_envio === 'pendente' ? 'secondary' :
                                    lembrete.status_envio === 'retry' ? 'outline' :
                                    'destructive'
                                  }>
                                    {lembrete.status_envio === 'enviado' ? '✓ Enviado' :
                                     lembrete.status_envio === 'pendente' ? '⏳ Pendente' :
                                     lembrete.status_envio === 'retry' ? '🔄 Retry' :
                                     '✗ Erro'}
                                  </Badge>
                                  {(lembrete.status_envio === 'erro' || lembrete.status_envio === 'retry') && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => reenviarLembrete(lembrete.id)}
                                      className="h-6 px-2 text-xs"
                                    >
                                      Reenviar
                                    </Button>
                                  )}
                                </div>
                                {lembrete.compromisso?.lead && (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage 
                                        src={lembrete.compromisso.lead_id ? leadAvatars[lembrete.compromisso.lead_id] : undefined} 
                                        alt={lembrete.compromisso.lead.name}
                                        onError={(e) => {
                                          if (lembrete.compromisso?.lead_id && lembrete.compromisso.lead) {
                                            buscarAvatarLead({
                                              id: lembrete.compromisso.lead_id,
                                              name: lembrete.compromisso.lead.name,
                                              phone: lembrete.compromisso.lead.phone,
                                              telefone: lembrete.compromisso.lead.phone
                                            });
                                          }
                                        }}
                                      />
                                      <AvatarFallback className="h-6 w-6 text-xs bg-primary/10">
                                        {lembrete.compromisso.lead.name.charAt(0).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm text-muted-foreground">{lembrete.compromisso.lead.name}</span>
                                  </div>
                                )}
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
                                  <strong>Canal:</strong> {lembrete.canal.toUpperCase()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  <strong>Antecedência:</strong> {lembrete.horas_antecedencia}h
                                </p>
                                {lembrete.tentativas && lembrete.tentativas > 0 && (
                                  <p className="text-sm text-muted-foreground">
                                    <strong>Tentativas:</strong> {lembrete.tentativas}/3
                                  </p>
                                )}
                                {lembrete.proxima_tentativa && lembrete.status_envio === 'retry' && (
                                  <p className="text-sm text-orange-600">
                                    <strong>Próxima tentativa:</strong> {format(parseISO(lembrete.proxima_tentativa), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                )}
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="minhas-agendas">
          <AgendaColaboradores />
        </TabsContent>
      </Tabs>
    </div>
  );
}
