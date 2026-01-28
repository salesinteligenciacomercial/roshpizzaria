import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, Bell, CheckSquare, FileText, Clock, User, BarChart3, Loader2, ChevronDown, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProductivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface LeadActivity {
  leadId: string;
  leadName: string;
  compromissos: number;
  lembretes: number;
  tarefas: number;
  prontuarios: number;
  mensagensAgendadas: number;
}

interface ProductivityData {
  compromissos: number;
  lembretes: number;
  tarefas: number;
  prontuarios: number;
  mensagensAgendadas: number;
}

interface UserProductivity {
  userId: string;
  userName: string;
  data: ProductivityData;
  leadsWorked: LeadActivity[];
}

type PeriodType = "today" | "week" | "month";

export function ProductivityPanel({ open, onOpenChange, companyId }: ProductivityPanelProps) {
  const [period, setPeriod] = useState<PeriodType>("today");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState<ProductivityData>({
    compromissos: 0,
    lembretes: 0,
    tarefas: 0,
    prontuarios: 0,
    mensagensAgendadas: 0,
  });
  const [userProductivity, setUserProductivity] = useState<UserProductivity[]>([]);

  const { members } = useTeamMembers();

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  }, [period]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case "today":
        return "Hoje";
      case "week":
        return "Esta Semana";
      case "month":
        return "Este Mês";
      default:
        return "";
    }
  }, [period]);

  useEffect(() => {
    if (open && companyId) {
      fetchProductivityData();
    }
  }, [open, companyId, dateRange, selectedUserId]);

  const fetchProductivityData = async () => {
    setLoading(true);
    try {
      const startDate = dateRange.start.toISOString();
      const endDate = dateRange.end.toISOString();

      // Fetch all data in parallel - now including lead info
      const [compromissosRes, lembretesRes, tarefasRes, prontuariosRes, mensagensRes, leadsRes] = await Promise.all([
        supabase
          .from("compromissos")
          .select("id, owner_id, lead_id")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("lembretes")
          .select("id, created_by")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("tasks")
          .select("id, owner_id, lead_id")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("lead_attachments")
          .select("id, uploaded_by, lead_id")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("scheduled_whatsapp_messages")
          .select("id, owner_id")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("leads")
          .select("id, name")
          .eq("company_id", companyId),
      ]);

      const compromissos = compromissosRes.data || [];
      const lembretes = lembretesRes.data || [];
      const tarefas = tarefasRes.data || [];
      const prontuarios = prontuariosRes.data || [];
      const mensagens = mensagensRes.data || [];
      const leads = leadsRes.data || [];

      // Create lead name lookup
      const leadNameMap = new Map<string, string>();
      leads.forEach(lead => {
        leadNameMap.set(lead.id, lead.name || "Lead sem nome");
      });

      // Filter by selected user if not "all"
      const filterByUser = (items: any[], userField: string) => {
        if (selectedUserId === "all") return items;
        return items.filter(item => item[userField] === selectedUserId);
      };

      const filteredCompromissos = filterByUser(compromissos, "owner_id");
      const filteredLembretes = filterByUser(lembretes, "created_by");
      const filteredTarefas = filterByUser(tarefas, "owner_id");
      const filteredProntuarios = filterByUser(prontuarios, "uploaded_by");
      const filteredMensagens = filterByUser(mensagens, "owner_id");

      // Calculate totals
      setTotals({
        compromissos: filteredCompromissos.length,
        lembretes: filteredLembretes.length,
        tarefas: filteredTarefas.length,
        prontuarios: filteredProntuarios.length,
        mensagensAgendadas: filteredMensagens.length,
      });

      // Calculate per-user productivity with lead tracking
      const userMap = new Map<string, { data: ProductivityData; leadActivities: Map<string, LeadActivity> }>();
      
      // Initialize map with all team members
      members.forEach(member => {
        userMap.set(member.id, {
          data: {
            compromissos: 0,
            lembretes: 0,
            tarefas: 0,
            prontuarios: 0,
            mensagensAgendadas: 0,
          },
          leadActivities: new Map(),
        });
      });

      // Helper to track lead activity
      const trackLeadActivity = (userId: string, leadId: string | null, activityType: keyof ProductivityData) => {
        if (!userId || !userMap.has(userId)) return;
        
        const userData = userMap.get(userId)!;
        userData.data[activityType]++;
        
        if (leadId) {
          if (!userData.leadActivities.has(leadId)) {
            userData.leadActivities.set(leadId, {
              leadId,
              leadName: leadNameMap.get(leadId) || "Lead desconhecido",
              compromissos: 0,
              lembretes: 0,
              tarefas: 0,
              prontuarios: 0,
              mensagensAgendadas: 0,
            });
          }
          userData.leadActivities.get(leadId)![activityType]++;
        }
      };

      // Count per user with lead tracking
      compromissos.forEach(item => {
        trackLeadActivity(item.owner_id, item.lead_id, "compromissos");
      });
      lembretes.forEach(item => {
        // Lembretes não tem lead_id, apenas contabilizar
        if (item.created_by && userMap.has(item.created_by)) {
          userMap.get(item.created_by)!.data.lembretes++;
        }
      });
      tarefas.forEach(item => {
        trackLeadActivity(item.owner_id, item.lead_id, "tarefas");
      });
      prontuarios.forEach(item => {
        trackLeadActivity(item.uploaded_by, item.lead_id, "prontuarios");
      });
      mensagens.forEach(item => {
        // Mensagens agendadas não tem lead_id, apenas contabilizar
        if (item.owner_id && userMap.has(item.owner_id)) {
          userMap.get(item.owner_id)!.data.mensagensAgendadas++;
        }
      });

      // Convert to array and sort by total activity
      const userProductivityArray: UserProductivity[] = [];
      userMap.forEach((userData, userId) => {
        const member = members.find(m => m.id === userId);
        if (member) {
          // Convert lead activities map to array and sort by total
          const leadsWorked = Array.from(userData.leadActivities.values()).sort((a, b) => {
            const totalA = a.compromissos + a.lembretes + a.tarefas + a.prontuarios + a.mensagensAgendadas;
            const totalB = b.compromissos + b.lembretes + b.tarefas + b.prontuarios + b.mensagensAgendadas;
            return totalB - totalA;
          });

          userProductivityArray.push({
            userId,
            userName: member.full_name || member.email,
            data: userData.data,
            leadsWorked,
          });
        }
      });

      // Sort by total productivity descending
      userProductivityArray.sort((a, b) => {
        const totalA = a.data.compromissos + a.data.lembretes + a.data.tarefas + a.data.prontuarios + a.data.mensagensAgendadas;
        const totalB = b.data.compromissos + b.data.lembretes + b.data.tarefas + b.data.prontuarios + b.data.mensagensAgendadas;
        return totalB - totalA;
      });
      // Filter if specific user selected
      if (selectedUserId !== "all") {
        setUserProductivity(userProductivityArray.filter(u => u.userId === selectedUserId));
      } else {
        setUserProductivity(userProductivityArray);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de produtividade:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalActivities = totals.compromissos + totals.lembretes + totals.tarefas + totals.prontuarios + totals.mensagensAgendadas;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório de Produtividade
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Período:</span>
            <div className="flex gap-1">
              <Button
                variant={period === "today" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("today")}
              >
                Hoje
              </Button>
              <Button
                variant={period === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("week")}
              >
                Esta Semana
              </Button>
              <Button
                variant={period === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriod("month")}
              >
                Este Mês
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Usuário:</span>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">Todos os usuários</SelectItem>
                {members.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Compromissos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.compromissos}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Lembretes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.lembretes}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-primary" />
                    Tarefas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.tarefas}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Prontuários
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.prontuarios}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Msg Agendadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{totals.mensagensAgendadas}</p>
                </CardContent>
              </Card>
            </div>

            {/* Total Summary */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Total de atividades ({periodLabel})
                </span>
                <span className="text-xl font-bold">{totalActivities}</span>
              </div>
            </div>

            {/* User Breakdown */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Detalhamento por Usuário
              </h3>
              
              {userProductivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma atividade registrada no período selecionado.
                </div>
              ) : (
                <div className="space-y-2">
                  {userProductivity.map((user) => {
                    const userTotal = user.data.compromissos + user.data.lembretes + user.data.tarefas + user.data.prontuarios + user.data.mensagensAgendadas;
                    if (userTotal === 0) return null;
                    
                    return (
                      <Collapsible key={user.userId}>
                        <Card className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{user.userName}</p>
                              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                                {user.data.compromissos > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 text-primary" />
                                    {user.data.compromissos}
                                  </span>
                                )}
                                {user.data.lembretes > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Bell className="h-3 w-3 text-primary" />
                                    {user.data.lembretes}
                                  </span>
                                )}
                                {user.data.tarefas > 0 && (
                                  <span className="flex items-center gap-1">
                                    <CheckSquare className="h-3 w-3 text-primary" />
                                    {user.data.tarefas}
                                  </span>
                                )}
                                {user.data.prontuarios > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3 text-primary" />
                                    {user.data.prontuarios}
                                  </span>
                                )}
                                {user.data.mensagensAgendadas > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-primary" />
                                    {user.data.mensagensAgendadas}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                              <div>
                                <p className="text-lg font-bold">{userTotal}</p>
                                <p className="text-xs text-muted-foreground">atividades</p>
                              </div>
                              {user.leadsWorked.length > 0 && (
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </CollapsibleTrigger>
                              )}
                            </div>
                          </div>
                          
                          {/* Leads trabalhados - Expandível */}
                          {user.leadsWorked.length > 0 && (
                            <CollapsibleContent className="mt-4 pt-4 border-t">
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  Leads Trabalhados ({user.leadsWorked.length})
                                </p>
                                <div className="grid gap-2 max-h-48 overflow-y-auto">
                                  {user.leadsWorked.slice(0, 10).map((lead) => {
                                    const leadTotal = lead.compromissos + lead.tarefas + lead.prontuarios;
                                    return (
                                      <div key={lead.leadId} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-2">
                                        <span className="text-sm font-medium truncate max-w-[200px]">
                                          {lead.leadName}
                                        </span>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          {lead.compromissos > 0 && (
                                            <span className="flex items-center gap-0.5">
                                              <Calendar className="h-3 w-3" />
                                              {lead.compromissos}
                                            </span>
                                          )}
                                          {lead.tarefas > 0 && (
                                            <span className="flex items-center gap-0.5">
                                              <CheckSquare className="h-3 w-3" />
                                              {lead.tarefas}
                                            </span>
                                          )}
                                          {lead.prontuarios > 0 && (
                                            <span className="flex items-center gap-0.5">
                                              <FileText className="h-3 w-3" />
                                              {lead.prontuarios}
                                            </span>
                                          )}
                                          <Badge variant="secondary" className="text-xs">
                                            {leadTotal}
                                          </Badge>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {user.leadsWorked.length > 10 && (
                                    <p className="text-xs text-muted-foreground text-center">
                                      +{user.leadsWorked.length - 10} leads adicionais
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CollapsibleContent>
                          )}
                        </Card>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
