import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Bell, CheckSquare, FileText, Clock, User, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProductivityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
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

      // Fetch all data in parallel
      const [compromissosRes, lembretesRes, tarefasRes, prontuariosRes, mensagensRes] = await Promise.all([
        supabase
          .from("compromissos")
          .select("id, owner_id")
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
          .select("id, owner_id")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("lead_attachments")
          .select("id, uploaded_by")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("scheduled_whatsapp_messages")
          .select("id, owner_id")
          .eq("company_id", companyId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
      ]);

      const compromissos = compromissosRes.data || [];
      const lembretes = lembretesRes.data || [];
      const tarefas = tarefasRes.data || [];
      const prontuarios = prontuariosRes.data || [];
      const mensagens = mensagensRes.data || [];

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

      // Calculate per-user productivity
      const userMap = new Map<string, ProductivityData>();
      
      // Initialize map with all team members
      members.forEach(member => {
        userMap.set(member.id, {
          compromissos: 0,
          lembretes: 0,
          tarefas: 0,
          prontuarios: 0,
          mensagensAgendadas: 0,
        });
      });

      // Count per user
      compromissos.forEach(item => {
        if (item.owner_id && userMap.has(item.owner_id)) {
          userMap.get(item.owner_id)!.compromissos++;
        }
      });
      lembretes.forEach(item => {
        if (item.created_by && userMap.has(item.created_by)) {
          userMap.get(item.created_by)!.lembretes++;
        }
      });
      tarefas.forEach(item => {
        if (item.owner_id && userMap.has(item.owner_id)) {
          userMap.get(item.owner_id)!.tarefas++;
        }
      });
      prontuarios.forEach(item => {
        if (item.uploaded_by && userMap.has(item.uploaded_by)) {
          userMap.get(item.uploaded_by)!.prontuarios++;
        }
      });
      mensagens.forEach(item => {
        if (item.owner_id && userMap.has(item.owner_id)) {
          userMap.get(item.owner_id)!.mensagensAgendadas++;
        }
      });

      // Convert to array and sort by total activity
      const userProductivityArray: UserProductivity[] = [];
      userMap.forEach((data, userId) => {
        const member = members.find(m => m.id === userId);
        if (member) {
          userProductivityArray.push({
            userId,
            userName: member.full_name || member.email,
            data,
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
                    <Calendar className="h-4 w-4 text-blue-500" />
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
                    <Bell className="h-4 w-4 text-yellow-500" />
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
                    <CheckSquare className="h-4 w-4 text-green-500" />
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
                    <FileText className="h-4 w-4 text-purple-500" />
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
                    <Clock className="h-4 w-4 text-orange-500" />
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
                      <Card key={user.userId} className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{user.userName}</p>
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mt-1">
                              {user.data.compromissos > 0 && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-blue-500" />
                                  {user.data.compromissos}
                                </span>
                              )}
                              {user.data.lembretes > 0 && (
                                <span className="flex items-center gap-1">
                                  <Bell className="h-3 w-3 text-yellow-500" />
                                  {user.data.lembretes}
                                </span>
                              )}
                              {user.data.tarefas > 0 && (
                                <span className="flex items-center gap-1">
                                  <CheckSquare className="h-3 w-3 text-green-500" />
                                  {user.data.tarefas}
                                </span>
                              )}
                              {user.data.prontuarios > 0 && (
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3 text-purple-500" />
                                  {user.data.prontuarios}
                                </span>
                              )}
                              {user.data.mensagensAgendadas > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-orange-500" />
                                  {user.data.mensagensAgendadas}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{userTotal}</p>
                            <p className="text-xs text-muted-foreground">atividades</p>
                          </div>
                        </div>
                      </Card>
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
