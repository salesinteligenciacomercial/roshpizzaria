import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter, Trophy, XCircle, DollarSign, FileText, Cake, CalendarIcon, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type FilterType = "ganhos" | "perdidos" | "valores" | "prontuarios" | "aniversariantes" | null;
type DatePeriod = "today" | "week" | "month" | "custom";

interface FilteredLead {
  id: string;
  name: string;
  phone: string | null;
  telefone: string | null;
  value: number | null;
  status: string;
  won_at: string | null;
  lost_at: string | null;
  data_nascimento: string | null;
  profile_picture_url: string | null;
  tags: string[] | null;
  attachmentsCount?: number;
}

interface LeadsAdvancedFilterProps {
  onApplyFilter: (leadIds: string[] | null) => void;
  activeFilter: boolean;
}

export function LeadsAdvancedFilter({ onApplyFilter, activeFilter }: LeadsAdvancedFilterProps) {
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>(null);
  const [datePeriod, setDatePeriod] = useState<DatePeriod>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FilteredLead[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCompanyId = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user?.id) return;

      const { data: role } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (role?.company_id) {
        setCompanyId(role.company_id);
      }
    };
    fetchCompanyId();
  }, []);

  const getDateRange = (): { start: Date; end: Date } => {
    const now = new Date();
    switch (datePeriod) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "custom":
        if (customDate) {
          return { start: startOfDay(customDate), end: endOfDay(customDate) };
        }
        return { start: startOfDay(now), end: endOfDay(now) };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const fetchFilteredLeads = async () => {
    if (!filterType || !companyId) return;

    setLoading(true);
    setResults([]);

    try {
      const { start, end } = getDateRange();
      let data: FilteredLead[] = [];

      switch (filterType) {
        case "ganhos":
          const { data: ganhos, error: erroGanhos } = await supabase
            .from("leads")
            .select("id, name, phone, telefone, value, status, won_at, lost_at, data_nascimento, profile_picture_url, tags")
            .eq("company_id", companyId)
            .eq("status", "ganho")
            .gte("won_at", start.toISOString())
            .lte("won_at", end.toISOString())
            .order("won_at", { ascending: false });
          
          if (erroGanhos) throw erroGanhos;
          data = ganhos || [];
          break;

        case "perdidos":
          const { data: perdidos, error: erroPerdidos } = await supabase
            .from("leads")
            .select("id, name, phone, telefone, value, status, won_at, lost_at, data_nascimento, profile_picture_url, tags")
            .eq("company_id", companyId)
            .eq("status", "perdido")
            .gte("lost_at", start.toISOString())
            .lte("lost_at", end.toISOString())
            .order("lost_at", { ascending: false });
          
          if (erroPerdidos) throw erroPerdidos;
          data = perdidos || [];
          break;

        case "valores":
          const { data: comValores, error: erroValores } = await supabase
            .from("leads")
            .select("id, name, phone, telefone, value, status, won_at, lost_at, data_nascimento, profile_picture_url, tags")
            .eq("company_id", companyId)
            .gt("value", 0)
            .order("value", { ascending: false });
          
          if (erroValores) throw erroValores;
          data = comValores || [];
          break;

        case "prontuarios":
          // Primeiro buscar IDs dos leads que possuem anexos
          const { data: attachments, error: erroAttachments } = await supabase
            .from("lead_attachments")
            .select("lead_id")
            .eq("company_id", companyId);
          
          if (erroAttachments) throw erroAttachments;

          const leadIdsWithAttachments = [...new Set((attachments || []).map(a => a.lead_id).filter(Boolean))];
          
          if (leadIdsWithAttachments.length > 0) {
            // Buscar os leads
            const { data: leadsComProntuario, error: erroLeads } = await supabase
              .from("leads")
              .select("id, name, phone, telefone, value, status, won_at, lost_at, data_nascimento, profile_picture_url, tags")
              .eq("company_id", companyId)
              .in("id", leadIdsWithAttachments);
            
            if (erroLeads) throw erroLeads;

            // Contar anexos por lead
            const countByLead: Record<string, number> = {};
            (attachments || []).forEach(a => {
              if (a.lead_id) {
                countByLead[a.lead_id] = (countByLead[a.lead_id] || 0) + 1;
              }
            });

            data = (leadsComProntuario || []).map(l => ({
              ...l,
              attachmentsCount: countByLead[l.id] || 0
            }));
          }
          break;

        case "aniversariantes":
          // Buscar todos os leads com data de nascimento e filtrar no frontend
          const { data: todosLeads, error: erroTodos } = await supabase
            .from("leads")
            .select("id, name, phone, telefone, value, status, won_at, lost_at, data_nascimento, profile_picture_url, tags")
            .eq("company_id", companyId)
            .not("data_nascimento", "is", null);
          
          if (erroTodos) throw erroTodos;

          // Filtrar aniversariantes no período
          data = (todosLeads || []).filter(lead => {
            if (!lead.data_nascimento) return false;
            const nascimento = new Date(lead.data_nascimento);
            const nascimentoMes = nascimento.getMonth();
            const nascimentoDia = nascimento.getDate();

            // Verificar se cai no período
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              if (d.getMonth() === nascimentoMes && d.getDate() === nascimentoDia) {
                return true;
              }
            }
            return false;
          });
          break;
      }

      setResults(data);
    } catch (error) {
      console.error("Erro ao buscar leads filtrados:", error);
      toast({
        variant: "destructive",
        title: "Erro ao filtrar",
        description: "Não foi possível buscar os leads. Tente novamente."
      });
    } finally {
      setLoading(false);
    }
  };

  // Buscar quando filtro ou período mudar
  useEffect(() => {
    if (filterType && companyId) {
      fetchFilteredLeads();
    }
  }, [filterType, datePeriod, customDate, companyId]);

  const handleApplyFilter = () => {
    if (results.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum resultado",
        description: "Não há leads para aplicar este filtro."
      });
      return;
    }

    const leadIds = results.map(r => r.id);
    onApplyFilter(leadIds);
    setOpen(false);
    toast({
      title: "Filtro aplicado",
      description: `${results.length} leads filtrados.`
    });
  };

  const handleClearFilter = () => {
    setFilterType(null);
    setResults([]);
    onApplyFilter(null);
    setOpen(false);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const filterButtons = [
    { type: "ganhos" as FilterType, label: "Ganhos", icon: Trophy, color: "text-green-600" },
    { type: "perdidos" as FilterType, label: "Perdidos", icon: XCircle, color: "text-red-600" },
    { type: "valores" as FilterType, label: "Valores", icon: DollarSign, color: "text-yellow-600" },
    { type: "prontuarios" as FilterType, label: "Prontuários", icon: FileText, color: "text-blue-600" },
    { type: "aniversariantes" as FilterType, label: "Aniversário", icon: Cake, color: "text-pink-600" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={activeFilter ? "default" : "outline"} 
          size="sm"
          className={cn(activeFilter && "bg-primary")}
        >
          <Filter className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Filtros Avançados</span>
          {activeFilter && <Badge variant="secondary" className="ml-2 bg-primary-foreground text-primary">Ativo</Badge>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Tipo de Filtro */}
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">Filtrar por:</p>
            <div className="flex flex-wrap gap-2">
              {filterButtons.map(({ type, label, icon: Icon, color }) => (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType(type)}
                  className="flex items-center gap-1"
                >
                  <Icon className={cn("h-4 w-4", filterType !== type && color)} />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Seletor de Período (não mostrar para "valores" e "prontuários") */}
          {filterType && !["valores", "prontuarios"].includes(filterType) && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Período:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={datePeriod === "today" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDatePeriod("today")}
                >
                  Hoje
                </Button>
                <Button
                  variant={datePeriod === "week" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDatePeriod("week")}
                >
                  Esta Semana
                </Button>
                <Button
                  variant={datePeriod === "month" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDatePeriod("month")}
                >
                  Este Mês
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={datePeriod === "custom" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDatePeriod("custom")}
                    >
                      <CalendarIcon className="h-4 w-4 mr-1" />
                      {datePeriod === "custom" && customDate
                        ? format(customDate, "dd/MM/yyyy")
                        : "Personalizado"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customDate}
                      onSelect={(date) => {
                        setCustomDate(date);
                        setDatePeriod("custom");
                      }}
                      initialFocus
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Resultados */}
          {filterType && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {loading ? "Buscando..." : `📊 Encontrados: ${results.length} leads`}
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mb-2 opacity-50" />
                  <p>Nenhum lead encontrado com esses filtros</p>
                </div>
              ) : (
                <ScrollArea className="flex-1 max-h-[300px] border rounded-lg">
                  <div className="p-2 space-y-2">
                    {results.map(lead => (
                      <div
                        key={lead.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={lead.profile_picture_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(lead.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {filterType === "ganhos" && lead.won_at && (
                              <>Ganho em {format(new Date(lead.won_at), "dd/MM/yyyy 'às' HH:mm")}</>
                            )}
                            {filterType === "perdidos" && lead.lost_at && (
                              <>Perdido em {format(new Date(lead.lost_at), "dd/MM/yyyy 'às' HH:mm")}</>
                            )}
                            {filterType === "valores" && (
                              <>Status: {lead.status}</>
                            )}
                            {filterType === "prontuarios" && (
                              <>{lead.attachmentsCount} arquivo(s) anexado(s)</>
                            )}
                            {filterType === "aniversariantes" && lead.data_nascimento && (
                              <>{format(new Date(lead.data_nascimento), "dd/MM")} - {calculateAge(lead.data_nascimento)} anos</>
                            )}
                          </p>
                        </div>
                        {(filterType === "ganhos" || filterType === "perdidos" || filterType === "valores") && (
                          <Badge variant="outline" className="shrink-0">
                            {formatCurrency(lead.value)}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClearFilter}>
            Limpar Filtro
          </Button>
          <Button onClick={handleApplyFilter} disabled={loading || results.length === 0}>
            Aplicar Filtro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
