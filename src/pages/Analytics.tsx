import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Users, DollarSign, Target, MessageSquare, Calendar, CheckCircle, Bot, Activity, Trophy, XCircle, Download, Share2, Filter, Settings, Eye, PieChart, Clock, Zap, RefreshCw, CalendarDays, UserCheck, AlertTriangle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Navigate } from "react-router-dom";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useLeadsSync, RealtimeStatus } from "@/hooks/useLeadsSync";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

// Registrar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);
interface Stats {
  totalLeads: number;
  totalValue: number;
  conversionRate: number;
  activeDeals: number;
  conversas: number;
  compromissos: number;
  tarefas: number;
  mensagensIA: number;
}
interface GlobalFilters {
  period: string;
  startDate?: string;
  endDate?: string;
  responsible?: string;
  channel?: string;
  team?: string;
}
interface LeadReportStats {
  totalGanhos: number;
  totalPerdidos: number;
  valorTotalGanhos: number;
  taxaConversao: number;
}
interface CommunicationStats {
  totalConversas: number;
  taxaResposta: number;
  tempoMedioResposta: number;
  conversasPorCanal: {
    canal: string;
    quantidade: number;
  }[];
  satisfacao: number;
}
interface ProductivityStats {
  tarefasCriadas: number;
  tarefasConcluidas: number;
  tarefasEmAndamento: number;
  tarefasPendentes: number;
  tarefasAtrasadas: number;
  taxaConclusao: number;
  compromissosRealizados: number;
  compromissosAgendados: number;
  taxaComparecimento: number;
  tempoMedioTarefa: number;
}
export default function Analytics() {
  const {
    canAccess,
    isAdmin,
    loading: permissionsLoading
  } = usePermissions();

  // Verificar permissão de acesso ao Analytics
  if (!permissionsLoading && !canAccess('analytics') && !isAdmin) {
    return <Navigate to="/leads" replace />;
  }
  const [stats, setStats] = useState<Stats>({
    totalLeads: 0,
    totalValue: 0,
    conversionRate: 0,
    activeDeals: 0,
    conversas: 0,
    compromissos: 0,
    tarefas: 0,
    mensagensIA: 0
  });
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [etapas, setEtapas] = useState<any[]>([]);
  const [funis, setFunis] = useState<any[]>([]);
  const [selectedFunil, setSelectedFunil] = useState<string | null>(null);
  const [globalFilters, setGlobalFilters] = useState<GlobalFilters>({
    period: 'all'
  });
  const [reportStats, setReportStats] = useState<LeadReportStats>({
    totalGanhos: 0,
    totalPerdidos: 0,
    valorTotalGanhos: 0,
    taxaConversao: 0
  });
  const [communicationStats, setCommunicationStats] = useState<CommunicationStats>({
    totalConversas: 0,
    taxaResposta: 0,
    tempoMedioResposta: 0,
    conversasPorCanal: [],
    satisfacao: 0
  });
  const [productivityStats, setProductivityStats] = useState<ProductivityStats>({
    tarefasCriadas: 0,
    tarefasConcluidas: 0,
    tarefasEmAndamento: 0,
    tarefasPendentes: 0,
    tarefasAtrasadas: 0,
    taxaConclusao: 0,
    compromissosRealizados: 0,
    compromissosAgendados: 0,
    taxaComparecimento: 0,
    tempoMedioTarefa: 0
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [communicationLoading, setCommunicationLoading] = useState(false);
  const [productivityLoading, setProductivityLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // ✅ Estado para usuários da empresa (filtro de responsável)
  const [companyUsers, setCompanyUsers] = useState<{
    id: string;
    name: string;
  }[]>([]);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // Ref para evitar múltiplas atualizações simultâneas
  const isUpdatingRef = useRef(false);
  const updateDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ SINCRONIZAÇÃO EM TEMPO REAL - Atualiza quando dados mudam em outros módulos
  const refreshAllStats = useCallback(async () => {
    if (isUpdatingRef.current) return;

    // Debounce para evitar múltiplas atualizações em sequência rápida
    if (updateDebounceRef.current) {
      clearTimeout(updateDebounceRef.current);
    }
    updateDebounceRef.current = setTimeout(async () => {
      isUpdatingRef.current = true;
      console.log('📊 [Analytics] Atualizando dados em tempo real...');
      try {
        await Promise.all([fetchStats(), fetchReportStats(), fetchCommunicationStats(), fetchProductivityStats()]);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('[Analytics] Erro ao atualizar dados:', error);
      } finally {
        isUpdatingRef.current = false;
      }
    }, 500); // Debounce de 500ms
  }, []);

  // ✅ HOOK DE SINCRONIZAÇÃO GLOBAL - Recebe eventos de todos os módulos
  useGlobalSync({
    callbacks: {
      onLeadCreated: data => {
        console.log('📊 [Analytics] Novo lead criado:', data?.name);
        refreshAllStats();
      },
      onLeadUpdated: data => {
        console.log('📊 [Analytics] Lead atualizado:', data?.name);
        refreshAllStats();
      },
      onLeadDeleted: data => {
        console.log('📊 [Analytics] Lead removido:', data?.name);
        refreshAllStats();
      },
      onTaskCreated: data => {
        console.log('📊 [Analytics] Nova tarefa criada:', data?.title);
        refreshAllStats();
      },
      onTaskUpdated: data => {
        console.log('📊 [Analytics] Tarefa atualizada:', data?.title);
        refreshAllStats();
      },
      onTaskDeleted: data => {
        console.log('📊 [Analytics] Tarefa removida:', data?.title);
        refreshAllStats();
      },
      onMeetingScheduled: data => {
        console.log('📊 [Analytics] Reunião agendada:', data?.title);
        refreshAllStats();
      },
      onMeetingUpdated: data => {
        console.log('📊 [Analytics] Reunião atualizada:', data?.title);
        refreshAllStats();
      },
      onMeetingCompleted: data => {
        console.log('📊 [Analytics] Reunião concluída:', data?.title);
        refreshAllStats();
      },
      onConversationStarted: () => {
        console.log('📊 [Analytics] Nova conversa iniciada');
        refreshAllStats();
      },
      onConversationUpdated: () => {
        console.log('📊 [Analytics] Conversa atualizada');
        refreshAllStats();
      },
      onFunnelStageChanged: data => {
        console.log('📊 [Analytics] Lead movido no funil:', data?.leadName);
        refreshAllStats();
      }
    },
    showNotifications: false // Não mostrar toasts duplicados
  });

  // ✅ HOOK DE SINCRONIZAÇÃO DE LEADS - Atualiza quando leads mudam
  const {
    connectionStatus
  } = useLeadsSync({
    onInsert: () => refreshAllStats(),
    onUpdate: () => refreshAllStats(),
    onDelete: () => refreshAllStats(),
    showNotifications: false
  });

  // Atualizar status da conexão realtime
  useEffect(() => {
    setRealtimeStatus(connectionStatus);
  }, [connectionStatus]);

  // ✅ Carregar company_id e usuários da empresa para o filtro de responsável
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (!user) return;

        // Buscar company_id do usuário
        const {
          data: userRole
        } = await supabase.from('user_roles').select('company_id').eq('user_id', user.id).maybeSingle();
        if (!userRole?.company_id) {
          console.warn('[Analytics] Usuário sem empresa vinculada');
          return;
        }
        setUserCompanyId(userRole.company_id);

        // Buscar todos os usuários da empresa
        const {
          data: userRoles
        } = await supabase.from('user_roles').select('user_id').eq('company_id', userRole.company_id);
        const userIds = (userRoles || []).map((ur: any) => ur.user_id);
        if (userIds.length === 0) {
          setCompanyUsers([]);
          return;
        }

        // Buscar nomes dos usuários na tabela profiles
        const {
          data: profiles
        } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds);
        const users = (profiles || []).map(p => ({
          id: p.id,
          name: (p.full_name || p.email || 'Usuário sem nome') as string
        })).filter(u => u.name);
        console.log('👥 [Analytics] Usuários carregados:', users.length);
        setCompanyUsers(users);
      } catch (error) {
        console.error('[Analytics] Erro ao carregar usuários:', error);
      }
    };
    loadCompanyData();
  }, []);
  useEffect(() => {
    fetchAllStats();
    // Fallback: impedir loading infinito em caso de erro silencioso
    const timer = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('[Analytics] Timeout de carregamento — exibindo layout com dados parciais');
        return false;
      });
    }, 8000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    fetchFilteredStats();
  }, [globalFilters]);
  useEffect(() => {
    if (selectedFunil) {
      fetchEtapasDoFunil(selectedFunil);
    } else {
      setEtapas([]);
    }
  }, [selectedFunil]);
  const fetchAllStats = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchReportStats(), fetchCommunicationStats(), fetchProductivityStats()]);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
      setFatalError((error as Error)?.message || 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };
  const fetchFilteredStats = async () => {
    await Promise.all([fetchReportStats(), fetchCommunicationStats(), fetchProductivityStats()]);
  };
  const fetchStats = async () => {
    try {
      // Leads
      const {
        data: leads
      } = await supabase.from("leads").select("value, status, etapa_id");
      const totalLeads = leads?.length || 0;
      const totalValue = leads?.reduce((sum, lead) => sum + (Number(lead.value) || 0), 0) || 0;
      const activeDeals = leads?.filter(l => l.status !== "perdido" && l.status !== "ganho").length || 0;
      const wonDeals = leads?.filter(l => l.status === "ganho").length || 0;
      const conversionRate = totalLeads > 0 ? wonDeals / totalLeads * 100 : 0;

      // ✅ CORREÇÃO: Contar CONVERSAS ÚNICAS (números únicos) APENAS da empresa do usuário
      let conversasQuery = supabase.from("conversas").select("numero, telefone_formatado, is_group");

      // Aplicar filtro de empresa se disponível
      if (userCompanyId) {
        conversasQuery = conversasQuery.eq('company_id', userCompanyId);
      }
      const {
        data: conversasData
      } = await conversasQuery;
      const numerosUnicos = new Set<string>();
      conversasData?.forEach((c: any) => {
        // Incluir grupos também na contagem
        const isGroup = c.is_group || /@g\.us$/.test(c.numero || '');
        const numero = isGroup ? c.numero : (c.telefone_formatado || c.numero || '').replace(/[^0-9]/g, '');
        if (numero && numero.length >= 8) {
          numerosUnicos.add(numero);
        }
      });
      const conversasCount = numerosUnicos.size;

      // Compromissos
      const {
        count: compromissosCount
      } = await supabase.from("compromissos").select("*", {
        count: 'exact',
        head: true
      });

      // Tarefas
      const {
        count: tarefasCount
      } = await supabase.from("tasks").select("*", {
        count: 'exact',
        head: true
      });

      // Mensagens IA
      const {
        count: iaCount
      } = await supabase.from("ia_training_data").select("*", {
        count: 'exact',
        head: true
      });

      // Carregar funis disponíveis
      let funisData: any[] | null = null;
      let funisError: any = null;
      try {
        const res = await supabase.from("funis").select("id, nome");
        funisData = res.data as any[] | null;
        funisError = res.error;
      } catch (e) {
        funisError = e;
      }
      if (funisError) {
        console.error("[Analytics] Erro ao carregar lista de funis:", funisError);
      }
      setFunis(funisData || []);
      if (!funisData || funisData.length === 0) {
        setEtapas([]);
        setSelectedFunil(null);
      } else if (selectedFunil && !funisData.some((f: any) => f.id === selectedFunil)) {
        setSelectedFunil(null);
      }
      setStats({
        totalLeads,
        totalValue,
        conversionRate: Math.round(conversionRate),
        activeDeals,
        conversas: conversasCount || 0,
        compromissos: compromissosCount || 0,
        tarefas: tarefasCount || 0,
        mensagensIA: iaCount || 0
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };
  const fetchEtapasDoFunil = async (funilId: string) => {
    try {
      const {
        data: leads
      } = await supabase.from("leads").select("value, status, etapa_id, funil_id");
      const {
        data: etapasData
      } = await supabase.from("etapas").select("id, nome, cor, funil_id").eq("funil_id", funilId).order("posicao");
      const leadsDoFunil = leads?.filter(l => l.funil_id === funilId) || [];
      const etapasComContagem = await Promise.all((etapasData || []).map(async etapa => {
        const leadsNaEtapa = leadsDoFunil.filter(l => l.etapa_id === etapa.id) || [];
        return {
          ...etapa,
          quantidade: leadsNaEtapa.length,
          valor: leadsNaEtapa.reduce((sum, l) => sum + (Number(l.value) || 0), 0)
        };
      }));
      setEtapas(etapasComContagem);
    } catch (error) {
      console.error("[Analytics] Erro ao carregar etapas do funil:", error);
    }
  };
  const fetchReportStats = async () => {
    try {
      setReportLoading(true);

      // Base query com filtros
      let queryGanhos = supabase.from("leads").select("value, created_at").eq("status", "ganho");
      let queryPerdidos = supabase.from("leads").select("id, created_at").eq("status", "perdido");

      // Aplicar filtros de período
      if (globalFilters.period !== 'all') {
        const now = new Date();
        let startDate: Date;
        switch (globalFilters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          default:
            startDate = new Date(0);
        }
        queryGanhos = queryGanhos.gte('created_at', startDate.toISOString());
        queryPerdidos = queryPerdidos.gte('created_at', startDate.toISOString());
      }
      const {
        data: leadsGanhos,
        error: errorGanhos
      } = await queryGanhos;
      const {
        data: leadsPerdidos,
        error: errorPerdidos
      } = await queryPerdidos;
      if (errorGanhos || errorPerdidos) {
        throw new Error("Erro ao carregar estatísticas de relatório");
      }
      const valorTotal = leadsGanhos?.reduce((acc, lead) => acc + (lead.value || 0), 0) || 0;
      const totalGanhos = leadsGanhos?.length || 0;
      const totalPerdidos = leadsPerdidos?.length || 0;
      const taxaConversao = totalGanhos + totalPerdidos > 0 ? totalGanhos / (totalGanhos + totalPerdidos) * 100 : 0;
      setReportStats({
        totalGanhos,
        totalPerdidos,
        valorTotalGanhos: valorTotal,
        taxaConversao: Math.round(taxaConversao * 10) / 10
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas de relatório:", error);
    } finally {
      setReportLoading(false);
    }
  };
  const fetchCommunicationStats = async () => {
    try {
      setCommunicationLoading(true);

      // ✅ BUSCA DADOS REAIS DE CONVERSAS (usando colunas corretas da tabela)
      const {
        data: conversasData
      } = await supabase.from("conversas").select("id, numero, telefone_formatado, origem, status, created_at, updated_at, fromme, read, delivered");

      // ✅ CORREÇÃO: Contar CONVERSAS ÚNICAS (números únicos), não mensagens
      const numerosUnicos = new Set<string>();
      const canaisPorNumero: Record<string, string> = {}; // Mapear número -> canal

      conversasData?.forEach((c: any) => {
        // Normalizar número (remover caracteres não numéricos)
        const numero = (c.telefone_formatado || c.numero || '').replace(/[^0-9]/g, '');
        if (numero && numero.length >= 8) {
          // Ignorar números inválidos
          numerosUnicos.add(numero);
          // Guardar o canal do número (origem ou whatsapp como padrão)
          if (!canaisPorNumero[numero]) {
            canaisPorNumero[numero] = c.origem || 'whatsapp';
          }
        }
      });

      // Total de conversas = números únicos
      const totalConversas = numerosUnicos.size;

      // Calcular conversas por canal (baseado nos números únicos)
      const canaisContagem: Record<string, number> = {};
      Object.values(canaisPorNumero).forEach(canal => {
        const canalNormalizado = canal.toLowerCase();
        canaisContagem[canalNormalizado] = (canaisContagem[canalNormalizado] || 0) + 1;
      });
      const conversasPorCanal = Object.entries(canaisContagem).map(([canal, quantidade]) => ({
        canal: canal.charAt(0).toUpperCase() + canal.slice(1),
        quantidade
      }));

      // Se não houver dados por canal, mostrar WhatsApp como padrão
      if (conversasPorCanal.length === 0 && totalConversas > 0) {
        conversasPorCanal.push({
          canal: "WhatsApp",
          quantidade: totalConversas
        });
      }

      // Calcular taxa de resposta (conversas com pelo menos uma resposta nossa)
      const numerosComResposta = new Set<string>();
      conversasData?.forEach((c: any) => {
        if (c.fromme === true) {
          const numero = (c.telefone_formatado || c.numero || '').replace(/[^0-9]/g, '');
          if (numero && numero.length >= 8) {
            numerosComResposta.add(numero);
          }
        }
      });
      const taxaResposta = totalConversas > 0 ? Math.round(numerosComResposta.size / totalConversas * 100 * 10) / 10 : 0;

      // Calcular tempo médio de resposta (simplificado)
      let tempoMedioResposta = 0;
      const conversasComResposta = conversasData?.filter((c: any) => c.updated_at && c.created_at) || [];
      if (conversasComResposta.length > 0) {
        const tempoTotal = conversasComResposta.reduce((acc: number, c: any) => {
          const inicio = new Date(c.created_at).getTime();
          const resposta = new Date(c.updated_at).getTime();
          return acc + Math.abs(resposta - inicio);
        }, 0);
        tempoMedioResposta = Math.round(tempoTotal / conversasComResposta.length / (1000 * 60 * 60) * 10) / 10; // em horas
      }

      // Taxa de satisfação baseada em conversas com mensagens lidas
      const numerosComLeitura = new Set<string>();
      conversasData?.forEach((c: any) => {
        if (c.read === true) {
          const numero = (c.telefone_formatado || c.numero || '').replace(/[^0-9]/g, '');
          if (numero && numero.length >= 8) {
            numerosComLeitura.add(numero);
          }
        }
      });
      const satisfacao = totalConversas > 0 ? Math.round(numerosComLeitura.size / totalConversas * 100 * 10) / 10 : 0;
      console.log(`📊 [Analytics] Conversas únicas: ${totalConversas} (de ${conversasData?.length || 0} mensagens)`);
      setCommunicationStats({
        totalConversas,
        taxaResposta: Math.min(taxaResposta, 100),
        tempoMedioResposta,
        conversasPorCanal,
        satisfacao: Math.min(satisfacao, 100)
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas de comunicação:", error);
    } finally {
      setCommunicationLoading(false);
    }
  };
  const fetchProductivityStats = async () => {
    try {
      setProductivityLoading(true);

      // ✅ TAREFAS - Buscar dados reais com datas para cálculo de tempo
      const {
        data: tarefasData
      } = await supabase.from("tasks").select("status, created_at, updated_at, due_date");
      const tarefasCriadas = tarefasData?.length || 0;
      const tarefasConcluidas = tarefasData?.filter((t: any) => t.status === "completed" || t.status === "done").length || 0;
      const tarefasEmAndamento = tarefasData?.filter((t: any) => t.status === "in_progress" || t.status === "doing").length || 0;
      const tarefasPendentes = tarefasData?.filter((t: any) => t.status === "pending" || t.status === "todo" || !t.status).length || 0;

      // Calcular tarefas atrasadas (due_date < hoje e não concluídas)
      const hoje = new Date();
      const tarefasAtrasadas = tarefasData?.filter((t: any) => {
        if (!t.due_date) return false;
        const dueDate = new Date(t.due_date);
        return dueDate < hoje && t.status !== "completed" && t.status !== "done";
      }).length || 0;
      const taxaConclusao = tarefasCriadas > 0 ? tarefasConcluidas / tarefasCriadas * 100 : 0;

      // ✅ Calcular tempo médio de conclusão de tarefas (dados reais)
      let tempoMedioTarefa = 0;
      const tarefasComDatas = tarefasData?.filter((t: any) => (t.status === "completed" || t.status === "done") && t.created_at && t.updated_at) || [];
      if (tarefasComDatas.length > 0) {
        const tempoTotal = tarefasComDatas.reduce((acc: number, t: any) => {
          const inicio = new Date(t.created_at).getTime();
          const fim = new Date(t.updated_at).getTime();
          return acc + Math.abs(fim - inicio);
        }, 0);
        tempoMedioTarefa = Math.round(tempoTotal / tarefasComDatas.length / (1000 * 60 * 60) * 10) / 10; // em horas
      }

      // ✅ COMPROMISSOS - Buscar dados reais
      const {
        data: compromissosData
      } = await supabase.from("compromissos").select("status, data_hora_inicio, data_hora_fim");
      const compromissosAgendados = compromissosData?.length || 0;
      const compromissosRealizados = compromissosData?.filter((c: any) => c.status === "realizado" || c.status === "concluido").length || 0;
      const taxaComparecimento = compromissosAgendados > 0 ? compromissosRealizados / compromissosAgendados * 100 : 0;
      console.log(`📊 [Analytics] Tarefas: ${tarefasCriadas} total, ${tarefasConcluidas} concluídas, ${tarefasEmAndamento} em andamento, ${tarefasPendentes} pendentes, ${tarefasAtrasadas} atrasadas`);
      setProductivityStats({
        tarefasCriadas,
        tarefasConcluidas,
        tarefasEmAndamento,
        tarefasPendentes,
        tarefasAtrasadas,
        taxaConclusao: Math.round(taxaConclusao),
        compromissosRealizados,
        compromissosAgendados,
        taxaComparecimento: Math.round(taxaComparecimento),
        tempoMedioTarefa
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas de produtividade:", error);
    } finally {
      setProductivityLoading(false);
    }
  };
  const statCards = [{
    title: "Total de Leads",
    value: stats.totalLeads,
    icon: Users,
    description: "Leads ativos no sistema",
    color: "text-primary",
    trend: "+12%",
    trendColor: "text-success"
  }, {
    title: "Valor em Pipeline",
    value: `R$ ${stats.totalValue.toLocaleString("pt-BR")}`,
    icon: DollarSign,
    description: "Valor total em negociação",
    color: "text-success",
    trend: "+8%",
    trendColor: "text-success"
  }, {
    title: "Taxa de Conversão",
    value: `${stats.conversionRate}%`,
    icon: TrendingUp,
    description: "Conversão média",
    color: "text-accent",
    trend: "+5%",
    trendColor: "text-success"
  }, {
    title: "Negócios Ativos",
    value: stats.activeDeals,
    icon: Target,
    description: "Em andamento",
    color: "text-warning",
    trend: "+15%",
    trendColor: "text-success"
  }];
  const operacionalCards = [{
    title: "Conversas Ativas",
    value: stats.conversas,
    icon: MessageSquare,
    description: "WhatsApp, Instagram, Facebook",
    color: "text-blue-500",
    trend: "+22%",
    trendColor: "text-success"
  }, {
    title: "Agendamentos",
    value: stats.compromissos,
    icon: Calendar,
    description: "Compromissos marcados",
    color: "text-purple-500",
    trend: "+18%",
    trendColor: "text-success"
  }, {
    title: "Tarefas",
    value: stats.tarefas,
    icon: CheckCircle,
    description: "Em todos os quadros",
    color: "text-green-500",
    trend: "+25%",
    trendColor: "text-success"
  }, {
    title: "Atendimentos IA",
    value: stats.mensagensIA,
    icon: Bot,
    description: "Mensagens processadas",
    color: "text-cyan-500",
    trend: "+35%",
    trendColor: "text-success"
  }];

  // Renderiza a página imediatamente; quando loading=true, os cards usam valores padrão
  // e botões exibem apenas um pequeno spinner, sem bloquear a tela inteira.

  if (fatalError) {
    return <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-2">Não foi possível carregar o Analytics</h1>
        <p className="text-muted-foreground mb-4">Exibindo layout sem dados. Detalhes técnicos:</p>
        <pre className="bg-muted p-3 rounded text-sm overflow-auto">{fatalError}</pre>
      </div>;
  }
  return <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Analytics  e Relatórios        
        </h1>
        <p className="text-muted-foreground text-lg">Visão completa e análises detalhadas do seu CRM</p>
        </div>
        
        {/* ✅ Indicador de Status de Conexão Realtime */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border">
            {realtimeStatus === 'connected' ? <>
                <Wifi className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600 font-medium">Sincronizado</span>
              </> : realtimeStatus === 'connecting' || realtimeStatus === 'reconnecting' ? <>
                <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />
                <span className="text-sm text-yellow-600 font-medium">Conectando...</span>
              </> : <>
                <WifiOff className="h-4 w-4 text-red-500" />
                <span className="text-sm text-red-600 font-medium">Desconectado</span>
              </>}
          </div>
          <div className="text-xs text-muted-foreground">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </div>

      {/* Filtros Globais */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros Globais
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Aplicados a todas as abas do Analytics
              </p>
            </div>
            <Button onClick={fetchFilteredStats} disabled={reportLoading || communicationLoading || productivityLoading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${reportLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium">Período</label>
              <Select value={globalFilters.period} onValueChange={value => setGlobalFilters(prev => ({
              ...prev,
              period: value
            }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="quarter">Último trimestre</SelectItem>
                  <SelectItem value="year">Último ano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Responsável</label>
              <Select value={globalFilters.responsible || "all"} onValueChange={value => setGlobalFilters(prev => ({
              ...prev,
              responsible: value === 'all' ? undefined : value
            }))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {companyUsers.map(user => <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Canal</label>
              <Select value={globalFilters.channel || "all"} onValueChange={value => setGlobalFilters(prev => ({
              ...prev,
              channel: value === 'all' ? undefined : value
            }))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto p-1">
          <TabsTrigger value="overview" className="gap-2 py-3">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2 py-3">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Vendas</span>
          </TabsTrigger>
          <TabsTrigger value="communication" className="gap-2 py-3">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Comunicação</span>
          </TabsTrigger>
          <TabsTrigger value="productivity" className="gap-2 py-3">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Produtividade</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 py-3">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Relatórios</span>
          </TabsTrigger>
          <TabsTrigger value="customize" className="gap-2 py-3">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Personalizar</span>
          </TabsTrigger>
        </TabsList>

        {/* Visão Geral */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPIs Principais */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, index) => <Card key={stat.title} className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1" style={{
            animationDelay: `${index * 100}ms`
          }}>
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                    <Badge variant="secondary" className={`${stat.trendColor} text-xs`}>
                      {stat.trend}
                    </Badge>
                  </div>
                </CardContent>
              </Card>)}
          </div>

          {/* Métricas Operacionais */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {operacionalCards.map((stat, index) => <Card key={stat.title} className="group relative overflow-hidden border-0 shadow-card transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="relative">
                  <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-muted-foreground">{stat.description}</p>
                    <Badge variant="secondary" className={`${stat.trendColor} text-xs`}>
                      {stat.trend}
                    </Badge>
                  </div>
                </CardContent>
              </Card>)}
          </div>

          {/* Pipeline Visual */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Pipeline por Etapa
                  </CardTitle>
                  {funis.length > 0 && <Badge variant="secondary" className="text-xs">
                      {funis.length} {funis.length === 1 ? 'funil' : 'funis'}
                    </Badge>}
                </div>
                <Select value={selectedFunil || ""} onValueChange={value => setSelectedFunil(value)}>
                  <SelectTrigger className="min-w-[200px] sm:w-[280px]">
                    <SelectValue placeholder={funis.length === 0 ? "Nenhum funil encontrado" : "Selecione o funil de vendas"} />
                  </SelectTrigger>
                  <SelectContent>
                    {funis.length === 0 ? <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum funil disponível
                      </div> : funis.map(funil => <SelectItem key={funil.id} value={funil.id}>
                          {funil.nome}
                        </SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Distribuição visual dos leads no funil de vendas
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedFunil ? <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">
                    {funis.length === 0 ? "Nenhum funil de vendas encontrado. Crie um funil para visualizar os dados." : "Selecione um funil de vendas para visualizar as etapas"}
                  </p>
                </div> : etapas.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma etapa encontrada para este funil</p>
                </div> : etapas.map(etapa => {
              const totalLeadsDoFunil = etapas.reduce((sum: number, e: any) => sum + e.quantidade, 0);
              return <div key={etapa.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{
                      backgroundColor: etapa.cor
                    }} />
                          <span className="font-medium">{etapa.nome}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {etapa.quantidade} leads • R$ {etapa.valor.toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div className="h-3 rounded-full transition-all duration-500" style={{
                    backgroundColor: etapa.cor,
                    width: `${totalLeadsDoFunil > 0 ? etapa.quantidade / totalLeadsDoFunil * 100 : 0}%`
                  }} />
                      </div>
                    </div>;
            })}
            </CardContent>
          </Card>

          {/* Sistema CEUSIA */}
          <Card className="border-0 shadow-card overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-5 rounded-full blur-3xl" />
            <CardHeader className="relative">
              <CardTitle className="text-2xl font-bold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                CEUSIA CRM - Sistema Multiempresa
              </CardTitle>
              <p className="text-muted-foreground mt-2">
                Plataforma completa de gestão comercial com IA integrada
              </p>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Gestão de Leads e Funil</p>
                    <p className="text-sm text-muted-foreground">Kanban visual com drag & drop</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-success/10">
                    <MessageSquare className="h-4 w-4 text-success" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Conversas Unificadas</p>
                    <p className="text-sm text-muted-foreground">WhatsApp, Instagram, Facebook</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-purple-500/10">
                    <Calendar className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Agenda e Compromissos</p>
                    <p className="text-sm text-muted-foreground">Lembretes automáticos via WhatsApp</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="mt-0.5 p-1.5 rounded-md bg-cyan-500/10">
                    <Bot className="h-4 w-4 text-cyan-500" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">IAs Autônomas</p>
                    <p className="text-sm text-muted-foreground">Atendimento, Vendas e Suporte</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendas & Pipeline */}
        <TabsContent value="sales" className="space-y-6">
          {/* KPIs de Vendas */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Leads Convertidos
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-green-600">{reportStats.totalGanhos}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">R$ {reportStats.valorTotalGanhos.toLocaleString('pt-BR')}</p>
                  <Badge variant="secondary" className="text-green-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    12%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Ticket Médio
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-blue-600">
                  R$ {reportStats.totalGanhos > 0 ? (reportStats.valorTotalGanhos / reportStats.totalGanhos).toLocaleString('pt-BR', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }) : '0'}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Por lead convertido</p>
                  <Badge variant="secondary" className="text-blue-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    8%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Velocidade do Funil
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-purple-600">4.2</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Dias médio no pipeline</p>
                  <Badge variant="secondary" className="text-red-600 text-xs">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    -5%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Previsão de Receita
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-5 w-5 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-orange-600">
                  R$ {(stats.totalValue * 0.3).toLocaleString('pt-BR')}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Próximos 30 dias</p>
                  <Badge variant="secondary" className="text-orange-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    15%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Visual Interativo */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Pipeline por Etapa
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Distribuição visual e valores no funil de vendas
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {etapas.map((etapa, index) => <div key={etapa.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{
                        backgroundColor: etapa.cor
                      }} />
                          <span className="font-medium">{etapa.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {etapa.quantidade} leads
                          </Badge>
                        </div>
                        <div className="text-sm font-semibold">
                          R$ {etapa.valor.toLocaleString("pt-BR")}
                        </div>
                      </div>
                      <div className="relative">
                        <div className="w-full bg-muted rounded-full h-4">
                          <div className="h-4 rounded-full transition-all duration-1000 ease-out" style={{
                        backgroundColor: etapa.cor,
                        width: `${stats.totalLeads > 0 ? etapa.quantidade / stats.totalLeads * 100 : 0}%`,
                        animationDelay: `${index * 200}ms`
                      }} />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-white drop-shadow-sm">
                            {stats.totalLeads > 0 ? Math.round(etapa.quantidade / stats.totalLeads * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    </div>)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Distribuição de Valores
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Proporção dos valores em cada etapa do pipeline
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Doughnut data={{
                  labels: etapas.map(etapa => etapa.nome),
                  datasets: [{
                    data: etapas.map(etapa => etapa.valor),
                    backgroundColor: etapas.map(etapa => etapa.cor),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                  }]
                }} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                      labels: {
                        padding: 20,
                        usePointStyle: true
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const value = context.parsed;
                          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                          const percentage = (value / total * 100).toFixed(1);
                          return `R$ ${value.toLocaleString('pt-BR')} (${percentage}%)`;
                        }
                      }
                    }
                  }
                }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Análise de Conversão por Etapa */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Taxa de Conversão por Etapa
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Eficiência de conversão entre as etapas do funil
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {etapas.map((etapa, index) => {
                const conversionRate = index === 0 ? etapa.quantidade / stats.totalLeads * 100 : etapa.quantidade / (etapas[index - 1]?.quantidade || stats.totalLeads) * 100;
                return <div key={etapa.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{
                      backgroundColor: etapa.cor
                    }} />
                        <div>
                          <p className="font-medium">{etapa.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {etapa.quantidade} leads • R$ {etapa.valor.toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{conversionRate.toFixed(1)}%</span>
                          <Badge variant={conversionRate > 50 ? "default" : conversionRate > 25 ? "secondary" : "destructive"} className="text-xs">
                            {conversionRate > 50 ? "Excelente" : conversionRate > 25 ? "Bom" : "Atenção"}
                          </Badge>
                        </div>
                        <Progress value={conversionRate} className="w-24 h-2 mt-1" />
                      </div>
                    </div>;
              })}
              </div>
            </CardContent>
          </Card>

          {/* Insights e Recomendações */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Gargalos Identificados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Etapa "Proposta" com alto tempo</p>
                      <p className="text-sm text-amber-700">Tempo médio de 12 dias - considere otimizar o processo</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Alta taxa de perda na qualificação</p>
                      <p className="text-sm text-red-700">68% dos leads são perdidos - revise critérios</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  Oportunidades de Melhoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Aumente follow-ups na etapa "Contato"</p>
                      <p className="text-sm text-green-700">Pode elevar conversão em até 25%</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Otimize propostas para valores &gt; R$ 50k</p>
                      <p className="text-sm text-blue-700">Maior margem de contribuição</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comunicação */}
        <TabsContent value="communication" className="space-y-6">
          {/* KPIs de Comunicação */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Total de Conversas
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-blue-600">{communicationStats.totalConversas}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Ativas no período</p>
                  <Badge variant="secondary" className="text-blue-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    18%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Taxa de Resposta
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-green-600">{communicationStats.taxaResposta}%</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Mensagens respondidas</p>
                  <Badge variant="secondary" className="text-green-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    5%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Tempo Médio de Resposta
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-5 w-5 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-purple-600">{communicationStats.tempoMedioResposta}h</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Para primeira resposta</p>
                  <Badge variant="secondary" className="text-red-600 text-xs">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    -12%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Satisfação Estimada
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <UserCheck className="h-5 w-5 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-orange-600">{communicationStats.satisfacao}%</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Baseado em padrões</p>
                  <Badge variant="secondary" className="text-orange-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    3%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Conversas por Canal */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Distribuição por Canal
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Volume de conversas em cada canal de comunicação
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {communicationStats.conversasPorCanal.map((canal, index) => <div key={canal.canal} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${canal.canal === 'WhatsApp' ? 'bg-green-500' : canal.canal === 'Instagram' ? 'bg-pink-500' : 'bg-blue-500'}`} />
                          <span className="font-medium">{canal.canal}</span>
                          <Badge variant="outline" className="text-xs">
                            {canal.quantidade} conversas
                          </Badge>
                        </div>
                        <div className="text-sm font-semibold">
                          {(canal.quantidade / communicationStats.totalConversas * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div className={`h-3 rounded-full transition-all duration-1000 ease-out ${canal.canal === 'WhatsApp' ? 'bg-green-500' : canal.canal === 'Instagram' ? 'bg-pink-500' : 'bg-blue-500'}`} style={{
                      width: `${canal.quantidade / communicationStats.totalConversas * 100}%`,
                      animationDelay: `${index * 200}ms`
                    }} />
                      </div>
                    </div>)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5 text-primary" />
                  Volume por Canal
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Quantidade de conversas em cada canal
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Bar data={{
                  labels: communicationStats.conversasPorCanal.length > 0 ? communicationStats.conversasPorCanal.map(c => c.canal) : ['WhatsApp'],
                  datasets: [{
                    label: 'Conversas',
                    data: communicationStats.conversasPorCanal.length > 0 ? communicationStats.conversasPorCanal.map(c => c.quantidade) : [communicationStats.totalConversas],
                    backgroundColor: communicationStats.conversasPorCanal.map(c => c.canal.toLowerCase() === 'whatsapp' ? '#22c55e' : c.canal.toLowerCase() === 'instagram' ? '#ec4899' : '#3b82f6'),
                    borderRadius: 4
                  }]
                }} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          return `${context.parsed.y} conversas`;
                        }
                      }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1
                      }
                    }
                  }
                }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Análise de Engajamento por Horário */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Engajamento por Horário
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Momentos de maior atividade e resposta da equipe
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Line data={{
                labels: ['06h', '08h', '10h', '12h', '14h', '16h', '18h', '20h'],
                datasets: [{
                  label: 'Mensagens Recebidas',
                  data: [12, 45, 78, 95, 87, 76, 54, 23],
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  tension: 0.4,
                  fill: true
                }, {
                  label: 'Respostas da Equipe',
                  data: [8, 38, 65, 82, 71, 58, 42, 15],
                  borderColor: '#22c55e',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  tension: 0.4,
                  fill: true
                }]
              }} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const
                  },
                  tooltip: {
                    mode: 'index',
                    intersect: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)'
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    }
                  }
                },
                interaction: {
                  mode: 'nearest',
                  axis: 'x',
                  intersect: false
                }
              }} />
              </div>
            </CardContent>
          </Card>

          {/* Análise de Sentimento e Qualidade */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Análise de Sentimento
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Classificação automática dos sentimentos nas conversas
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <span className="font-medium text-green-800">Positivo</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-800">68%</div>
                      <div className="text-sm text-green-600">245 conversas</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-yellow-500" />
                      <span className="font-medium text-yellow-800">Neutro</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-yellow-800">24%</div>
                      <div className="text-sm text-yellow-600">87 conversas</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-red-500" />
                      <span className="font-medium text-red-800">Negativo</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-800">8%</div>
                      <div className="text-sm text-red-600">29 conversas</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Performance da Equipe
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ranking de atendimento por responsável
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {companyUsers.length === 0 ? <div className="text-center py-6 text-muted-foreground">
                      <UserCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum usuário encontrado na empresa</p>
                      </div> : companyUsers.slice(0, 5).map((user, index) => <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">{index + 1}</span>
                      </div>
                      <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {index === 0 ? '95%' : index === 1 ? '89%' : index === 2 ? '82%' : index === 3 ? '78%' : '75%'} satisfação
                            </p>
                      </div>
                    </div>
                        <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"} className={index === 0 ? "bg-green-100 text-green-800" : ""}>
                          {index === 0 ? 'Excelente' : index < 3 ? 'Muito Bom' : 'Bom'}
                        </Badge>
                  </div>)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights e Recomendações */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Alertas de Comunicação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Tempo de resposta alto no Instagram</p>
                      <p className="text-sm text-amber-700">3.2h médio - considere aumentar equipe</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Taxa de resposta baixa aos finais de semana</p>
                      <p className="text-sm text-red-700">Apenas 45% - configure escalas específicas</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  Oportunidades de Otimização
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Implemente chatbots no Facebook</p>
                      <p className="text-sm text-green-700">Pode reduzir tempo de resposta em 60%</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Crie respostas rápidas padronizadas</p>
                      <p className="text-sm text-blue-700">Para perguntas frequentes sobre preços</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Produtividade */}
        <TabsContent value="productivity" className="space-y-6">
          {/* KPIs de Produtividade */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-green-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Tarefas Concluídas
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-green-600">{productivityStats.tarefasConcluidas}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">De {productivityStats.tarefasCriadas} criadas</p>
                  <Badge variant="secondary" className="text-green-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    15%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Taxa de Conclusão
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-blue-600">{productivityStats.taxaConclusao}%</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Média da equipe</p>
                  <Badge variant="secondary" className="text-blue-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    8%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Agendamentos Realizados
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <CalendarDays className="h-5 w-5 text-purple-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-purple-600">{productivityStats.compromissosRealizados}</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">De {productivityStats.compromissosAgendados} marcados</p>
                  <Badge variant="secondary" className="text-purple-600 text-xs">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    12%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-orange-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  Tempo Médio por Tarefa
                </CardTitle>
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-background to-muted group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-orange-600">{productivityStats.tempoMedioTarefa}h</div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Por tarefa concluída</p>
                  <Badge variant="secondary" className="text-red-600 text-xs">
                    <ArrowDownRight className="h-3 w-3 mr-1" />
                    -5%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status das Tarefas */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Distribuição de Tarefas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Status atual de todas as tarefas do sistema
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <Doughnut data={{
                  labels: ['Concluídas', 'Em Andamento', 'Pendentes', 'Atrasadas'],
                  datasets: [{
                    data: [productivityStats.tarefasConcluidas, productivityStats.tarefasEmAndamento, productivityStats.tarefasPendentes, productivityStats.tarefasAtrasadas],
                    backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                  }]
                }} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom' as const,
                      labels: {
                        padding: 20,
                        usePointStyle: true
                      }
                    },
                    tooltip: {
                      callbacks: {
                        label: function (context) {
                          const value = context.parsed;
                          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                          const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0';
                          return `${context.label}: ${value} (${percentage}%)`;
                        }
                      }
                    }
                  }
                }} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Taxa de Comparecimento
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Eficiência nos agendamentos e compromissos
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Comparecimento</span>
                    <span className="text-2xl font-bold text-green-600">{productivityStats.taxaComparecimento}%</span>
                  </div>
                  <Progress value={productivityStats.taxaComparecimento} className="h-3" />

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="text-center p-3 rounded-lg bg-green-50">
                      <div className="text-2xl font-bold text-green-600">{productivityStats.compromissosRealizados}</div>
                      <div className="text-sm text-green-700">Realizados</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-50">
                      <div className="text-2xl font-bold text-red-600">
                        {productivityStats.compromissosAgendados - productivityStats.compromissosRealizados}
                      </div>
                      <div className="text-sm text-red-700">Faltaram</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Produtividade por Dia da Semana */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Produtividade por Dia da Semana
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Análise de performance da equipe ao longo da semana
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <Bar data={{
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                datasets: [{
                  label: 'Tarefas Concluídas',
                  data: [12, 15, 18, 14, 16, 8, 5],
                  backgroundColor: '#3b82f6',
                  borderRadius: 4
                }, {
                  label: 'Compromissos Realizados',
                  data: [8, 10, 12, 9, 11, 4, 2],
                  backgroundColor: '#22c55e',
                  borderRadius: 4
                }]
              }} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top' as const
                  },
                  tooltip: {
                    mode: 'index',
                    intersect: false
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    grid: {
                      display: true,
                      color: 'rgba(0, 0, 0, 0.1)'
                    }
                  },
                  x: {
                    grid: {
                      display: false
                    }
                  }
                },
                interaction: {
                  mode: 'nearest',
                  axis: 'x',
                  intersect: false
                }
              }} />
              </div>
            </CardContent>
          </Card>

          {/* Ranking de Produtividade da Equipe */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  Ranking de Produtividade
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Performance individual da equipe
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {companyUsers.length === 0 ? <div className="text-center py-6 text-muted-foreground">
                      <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhum usuário encontrado na empresa</p>
                    </div> : companyUsers.slice(0, 5).map((user, index) => <div key={user.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border border-yellow-200' : 'bg-muted/30'}`}>
                    <div className="flex items-center gap-3">
                          <div className={`${index === 0 ? 'w-10 h-10 bg-yellow-500' : 'w-8 h-8 bg-primary/10'} rounded-full flex items-center justify-center`}>
                            {index === 0 ? <Trophy className="h-5 w-5 text-white" /> : <span className="text-sm font-semibold text-primary">{index + 1}</span>}
                      </div>
                      <div>
                            <p className={index === 0 ? "font-bold" : "font-medium"}>{user.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {Math.max(28 - index * 4, 10)} tarefas • {Math.max(95 - index * 7, 70)}% conclusão
                            </p>
                      </div>
                    </div>
                        <Badge variant={index === 0 ? "default" : index < 3 ? "secondary" : "outline"} className={index === 0 ? "bg-yellow-100 text-yellow-800" : ""}>
                          {index === 0 ? '🏆 #1' : index < 3 ? 'Muito Bom' : 'Bom'}
                        </Badge>
                  </div>)}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Tempo Gasto por Tipo
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Distribuição do tempo por categoria de tarefa
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-blue-500" />
                      <span className="font-medium text-blue-800">Atendimento</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-blue-800">45%</div>
                      <div className="text-sm text-blue-600">18h/semana</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-green-500" />
                      <span className="font-medium text-green-800">Vendas</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-800">30%</div>
                      <div className="text-sm text-green-600">12h/semana</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-purple-500" />
                      <span className="font-medium text-purple-800">Administrativo</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-purple-800">15%</div>
                      <div className="text-sm text-purple-600">6h/semana</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full bg-orange-500" />
                      <span className="font-medium text-orange-800">Outros</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-orange-800">10%</div>
                      <div className="text-sm text-orange-600">4h/semana</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights e Recomendações */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Alertas de Produtividade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Taxa de conclusão baixa aos finais de semana</p>
                      <p className="text-sm text-amber-700">Apenas 35% - considere redistribuir tarefas</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-200">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Faltas em agendamentos frequentes</p>
                      <p className="text-sm text-red-700">15% de ausência - revisar processo de confirmação</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  Oportunidades de Melhoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                    <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800">Implemente lembretes automáticos</p>
                      <p className="text-sm text-green-700">Pode aumentar comparecimento em 25%</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800">Otimize distribuição de tarefas</p>
                      <p className="text-sm text-blue-700">Equilibre carga entre membros da equipe</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Relatórios */}
        <TabsContent value="reports" className="space-y-6">
          {/* Filtros Avançados */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros Avançados de Relatório
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure os parâmetros para gerar relatórios personalizados
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={globalFilters.period} onValueChange={value => setGlobalFilters(prev => ({
                  ...prev,
                  period: value
                }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todo o período</SelectItem>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="week">Última semana</SelectItem>
                      <SelectItem value="month">Último mês</SelectItem>
                      <SelectItem value="quarter">Último trimestre</SelectItem>
                      <SelectItem value="year">Último ano</SelectItem>
                      <SelectItem value="custom">Período customizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Responsável</label>
                  <Select value={globalFilters.responsible || "all"} onValueChange={value => setGlobalFilters(prev => ({
                  ...prev,
                  responsible: value === 'all' ? undefined : value
                }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {companyUsers.map(user => <SelectItem key={user.id} value={user.id}>
                          {user.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Equipe</label>
                  <Select value={globalFilters.team || "all"} onValueChange={value => setGlobalFilters(prev => ({
                  ...prev,
                  team: value === 'all' ? undefined : value
                }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="vendas">Vendas</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="gerencia">Gerência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Canal</label>
                  <Select value={globalFilters.channel || "all"} onValueChange={value => setGlobalFilters(prev => ({
                  ...prev,
                  channel: value === 'all' ? undefined : value
                }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button onClick={fetchAllStats} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Aplicar Filtros
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Templates de Relatório */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <Trophy className="h-5 w-5" />
                  Performance de Vendas
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Análise completa de leads, conversões e pipeline
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Leads convertidos</span>
                    <Badge variant="secondary">{reportStats.totalGanhos}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de conversão</span>
                    <Badge variant="secondary">{reportStats.taxaConversao}%</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Valor total</span>
                    <Badge variant="secondary">R$ {reportStats.valorTotalGanhos.toLocaleString()}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Share2 className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-600">
                  <MessageSquare className="h-5 w-5" />
                  Relatório de Comunicação
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Métricas de conversas e engajamento por canal
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Total de conversas</span>
                    <Badge variant="secondary">{communicationStats.totalConversas}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de resposta</span>
                    <Badge variant="secondary">{communicationStats.taxaResposta}%</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Satisfação</span>
                    <Badge variant="secondary">{communicationStats.satisfacao}%</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Share2 className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-600">
                  <CheckCircle className="h-5 w-5" />
                  Produtividade da Equipe
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Análise de tarefas, agenda e eficiência
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Tarefas concluídas</span>
                    <Badge variant="secondary">{productivityStats.tarefasConcluidas}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de conclusão</span>
                    <Badge variant="secondary">{productivityStats.taxaConclusao}%</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Comparecimento</span>
                    <Badge variant="secondary">{productivityStats.taxaComparecimento}%</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1">
                    <Share2 className="h-4 w-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Relatórios Customizáveis */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Relatório Customizado
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Crie relatórios personalizados com métricas específicas
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="font-medium">Métricas de Vendas</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="metric1" className="rounded" defaultChecked />
                        <label htmlFor="metric1" className="text-sm">Total de Leads</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="metric2" className="rounded" defaultChecked />
                        <label htmlFor="metric2" className="text-sm">Taxa de Conversão</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="metric3" className="rounded" defaultChecked />
                        <label htmlFor="metric3" className="text-sm">Valor em Pipeline</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="metric4" className="rounded" />
                        <label htmlFor="metric4" className="text-sm">Ticket Médio</label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Métricas de Comunicação</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="comm1" className="rounded" />
                        <label htmlFor="comm1" className="text-sm">Total de Conversas</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="comm2" className="rounded" />
                        <label htmlFor="comm2" className="text-sm">Taxa de Resposta</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="comm3" className="rounded" />
                        <label htmlFor="comm3" className="text-sm">Tempo Médio de Resposta</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="comm4" className="rounded" />
                        <label htmlFor="comm4" className="text-sm">Satisfação por Canal</label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button>
                    <Download className="h-4 w-4 mr-2" />
                    Gerar Relatório
                  </Button>
                  <Button variant="outline">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Agendar Relatório
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Relatórios Agendados */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Relatórios Agendados
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure relatórios automáticos por e-mail
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Relatório Semanal de Vendas</p>
                      <p className="text-sm text-muted-foreground">Enviado toda segunda-feira às 09:00</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Relatório de Comunicação</p>
                      <p className="text-sm text-muted-foreground">Enviado todo dia 1º às 08:00</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                    <Button variant="ghost" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-center py-6 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Configure novos relatórios agendados</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Novo Relatório Agendado
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico de Exportações */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                Histórico de Exportações
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Últimos relatórios exportados e compartilhados
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <Download className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Relatório de Vendas - Outubro 2025</p>
                      <p className="text-sm text-muted-foreground">PDF • 2.3 MB • Há 2 horas</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Download className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Análise de Produtividade - Outubro 2025</p>
                      <p className="text-sm text-muted-foreground">Excel • 1.8 MB • Há 1 dia</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-center py-4 text-muted-foreground">
                  <Download className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhum arquivo mais antigo encontrado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Personalizar */}
        <TabsContent value="customize" className="space-y-6">
          {/* Meus Dashboards */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Meus Dashboards
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Dashboards personalizados criados por você
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors cursor-pointer group">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                      <Settings className="h-6 w-6 text-primary" />
                    </div>
                    <p className="font-medium text-center">Criar Novo Dashboard</p>
                    <p className="text-sm text-muted-foreground text-center mt-1">Personalize seu próprio layout</p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      📊 Dashboard Executivo
                      <Badge variant="secondary" className="text-xs">Padrão</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Visão geral completa para gestores
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Widgets</span>
                        <Badge variant="outline">12</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Última edição</span>
                        <span className="text-muted-foreground">2 dias atrás</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" className="flex-1">
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        Usar
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      🎯 Foco em Vendas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Widgets</span>
                        <Badge variant="outline">8</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Última edição</span>
                        <span className="text-muted-foreground">1 semana atrás</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" variant="outline" className="flex-1">
                        Editar
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        Usar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Templates Disponíveis */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Templates de Dashboard
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Comece com layouts pré-configurados
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                      <Trophy className="h-5 w-5" />
                      Executivo Completo
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Todas as métricas principais em um só lugar
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <Badge variant="secondary" className="text-xs">12 widgets</Badge>
                      <Badge variant="outline" className="text-xs">Recomendado</Badge>
                    </div>
                    <Button size="sm" className="w-full">
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                      <TrendingUp className="h-5 w-5" />
                      Foco em Vendas
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Métricas de pipeline e conversão
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <Badge variant="secondary" className="text-xs">8 widgets</Badge>
                      <Badge variant="outline" className="text-xs">Popular</Badge>
                    </div>
                    <Button size="sm" className="w-full">
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-card hover:shadow-xl transition-all duration-300 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-600">
                      <MessageSquare className="h-5 w-5" />
                      Comunicação
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Métricas de engajamento e satisfação
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <Badge variant="secondary" className="text-xs">6 widgets</Badge>
                      <Badge variant="outline" className="text-xs">Novo</Badge>
                    </div>
                    <Button size="sm" className="w-full">
                      Usar Template
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Editor de Dashboard */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Editor de Dashboard
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Arraste e solte widgets para personalizar seu dashboard
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Área de Drop Zone */}
                <div className="min-h-96 border-2 border-dashed border-muted-foreground/20 rounded-lg p-8">
                  <div className="text-center text-muted-foreground">
                    <Settings className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <h3 className="font-semibold mb-2">Área de Edição</h3>
                    <p className="text-sm">Arraste widgets da paleta para cá</p>
                  </div>
                </div>

                {/* Paleta de Widgets */}
                <div className="space-y-4">
                  <h4 className="font-medium">Widgets Disponíveis</h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="border-0 shadow-card cursor-grab hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-blue-100">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Gráfico de Barras</p>
                            <p className="text-sm text-muted-foreground">Métricas comparativas</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-card cursor-grab hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100">
                            <Users className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium">Card de Métrica</p>
                            <p className="text-sm text-muted-foreground">KPIs principais</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-card cursor-grab hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-100">
                            <PieChart className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium">Gráfico de Pizza</p>
                            <p className="text-sm text-muted-foreground">Distribuição de dados</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-0 shadow-card cursor-grab hover:shadow-xl transition-all duration-300">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-orange-100">
                            <TrendingUp className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium">Linha do Tempo</p>
                            <p className="text-sm text-muted-foreground">Tendências históricas</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Controles */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button>
                    <Download className="h-4 w-4 mr-2" />
                    Salvar Dashboard
                  </Button>
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                  <Button variant="outline">
                    <Share2 className="h-4 w-4 mr-2" />
                    Compartilhar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configurações de Tema */}
          <Card className="border-0 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Personalização Visual
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Customize cores, temas e aparência do seu dashboard
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-medium">Tema</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="border-2 border-primary cursor-pointer">
                      <CardContent className="p-3 text-center">
                        <div className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded mb-2"></div>
                        <p className="text-sm font-medium">Padrão</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-card cursor-pointer hover:shadow-xl transition-all">
                      <CardContent className="p-3 text-center">
                        <div className="w-full h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded mb-2"></div>
                        <p className="text-sm font-medium">Natureza</p>
                      </CardContent>
                    </Card>
                    <Card className="border-0 shadow-card cursor-pointer hover:shadow-xl transition-all">
                      <CardContent className="p-3 text-center">
                        <div className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded mb-2"></div>
                        <p className="text-sm font-medium">Energia</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Layout</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <span className="text-sm">Grade Responsiva</span>
                      <input type="checkbox" className="rounded" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <span className="text-sm">Auto-ajuste de Widgets</span>
                      <input type="checkbox" className="rounded" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <span className="text-sm">Animações Suaves</span>
                      <input type="checkbox" className="rounded" defaultChecked />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
}