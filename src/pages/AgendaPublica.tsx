import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Calendar as CalendarIcon, Clock, User, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Compromisso {
  id: string;
  agenda_id?: string;
  lead_id?: string;
  usuario_responsavel_id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  observacoes?: string;
  custo_estimado?: number;
  lead?: {
    name: string;
    phone?: string;
  };
  agenda?: {
    nome: string;
    tipo: string;
  };
}

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  slug: string;
  responsavel_id?: string;
}

export default function AgendaPublica() {
  const { slug } = useParams<{ slug: string }>();
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Slug não fornecido");
      setLoading(false);
      return;
    }

    carregarAgenda();
  }, [slug]);

  const carregarAgenda = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar agenda pelo slug
      const { data: agendaData, error: agendaError } = await supabase
        .from('agendas')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'ativo')
        .single();

      if (agendaError || !agendaData) {
        setError("Agenda não encontrada ou inativa");
        setLoading(false);
        return;
      }

      setAgenda(agendaData);

      // Buscar compromissos da agenda ou do responsável
      const query = supabase
        .from('compromissos')
        .select(`
          *,
          lead:leads(id, name, phone),
          agenda:agendas(id, nome, tipo)
        `)
        .order('data_hora_inicio', { ascending: true });

      // Se a agenda tem responsavel_id, filtrar por ele
      // Caso contrário, filtrar por agenda_id
      if (agendaData.responsavel_id) {
        query.eq('usuario_responsavel_id', agendaData.responsavel_id);
      } else {
        query.eq('agenda_id', agendaData.id);
      }

      const { data: compromissosData, error: compromissosError } = await query;

      if (compromissosError) {
        console.error('Erro ao carregar compromissos:', compromissosError);
        setError("Erro ao carregar compromissos");
        return;
      }

      setCompromissos(compromissosData || []);
    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
      setError("Erro ao carregar agenda");
    } finally {
      setLoading(false);
    }
  };

  // Compromissos do mês para o calendário
  const compromissosDoMes = useMemo(() => {
    const inicioMes = startOfMonth(selectedDate);
    const fimMes = endOfMonth(selectedDate);
    
    return compromissos.filter((c) => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return dataCompromisso >= inicioMes && dataCompromisso <= fimMes;
    });
  }, [compromissos, selectedDate]);

  // Compromissos do dia selecionado
  const compromissosDoDia = useMemo(() => {
    return compromissos.filter((c) => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return isSameDay(dataCompromisso, selectedDate);
    });
  }, [compromissos, selectedDate]);

  // Compromissos da semana
  const compromissosDaSemana = useMemo(() => {
    const inicioSemana = startOfWeek(selectedDate, { locale: ptBR });
    const fimSemana = endOfWeek(selectedDate, { locale: ptBR });
    
    return compromissos.filter((c) => {
      const dataCompromisso = parseISO(c.data_hora_inicio);
      return dataCompromisso >= inicioSemana && dataCompromisso <= fimSemana;
    });
  }, [compromissos, selectedDate]);

  const getStatusBadge = (status: string) => {
    const badges = {
      agendado: <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>,
      concluido: <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>,
      cancelado: <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>,
    };
    return badges[status as keyof typeof badges] || badges.agendado;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando agenda...</p>
        </div>
      </div>
    );
  }

  if (error || !agenda) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Agenda não encontrada</h2>
              <p className="text-muted-foreground">
                {error || "A agenda solicitada não existe ou está inativa."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header simples */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{agenda.nome}</h1>
              <p className="text-muted-foreground mt-1">
                Agenda {agenda.tipo === 'colaborador' ? 'do Colaborador' : 'Principal'}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {compromissos.length} {compromissos.length === 1 ? 'compromisso' : 'compromissos'}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="calendario" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calendario">Calendário</TabsTrigger>
            <TabsTrigger value="semana">Esta Semana</TabsTrigger>
            <TabsTrigger value="mes">Este Mês</TabsTrigger>
          </TabsList>

          <TabsContent value="calendario" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendário */}
              <Card>
                <CardHeader>
                  <CardTitle>Calendário</CardTitle>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    locale={ptBR}
                    className="rounded-md border"
                    modifiers={{
                      hasCompromissos: compromissosDoMes
                        .filter(c => c.status === 'agendado')
                        .map(c => {
                          const date = parseISO(c.data_hora_inicio);
                          return new Date(date.getFullYear(), date.getMonth(), date.getDate());
                        }),
                    }}
                    modifiersClassNames={{
                      hasCompromissos: "bg-blue-100 text-blue-900 font-semibold hover:bg-blue-200",
                    }}
                  />
                </CardContent>
              </Card>

              {/* Compromissos do dia */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                  </CardTitle>
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
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{compromisso.tipo_servico}</span>
                                  {getStatusBadge(compromisso.status)}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(parseISO(compromisso.data_hora_inicio), "HH:mm")} - {format(parseISO(compromisso.data_hora_fim), "HH:mm")}
                                </p>
                                {compromisso.lead && (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
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

          <TabsContent value="semana" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  Semana de {format(startOfWeek(selectedDate, { locale: ptBR }), "dd/MM")} a {format(endOfWeek(selectedDate, { locale: ptBR }), "dd/MM/yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {compromissosDaSemana.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum compromisso nesta semana</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {compromissosDaSemana.map((compromisso) => (
                        <Card key={compromisso.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{compromisso.tipo_servico}</span>
                                  {getStatusBadge(compromisso.status)}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CalendarIcon className="h-4 w-4" />
                                  <span>{format(parseISO(compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                  <span>•</span>
                                  <Clock className="h-4 w-4" />
                                  <span>
                                    {format(parseISO(compromisso.data_hora_inicio), "HH:mm")} - {format(parseISO(compromisso.data_hora_fim), "HH:mm")}
                                  </span>
                                </div>
                                {compromisso.lead && (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
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

          <TabsContent value="mes" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  {compromissosDoMes.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum compromisso neste mês</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {compromissosDoMes.map((compromisso) => (
                        <Card key={compromisso.id} className="border-l-4 border-l-blue-500">
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{compromisso.tipo_servico}</span>
                                  {getStatusBadge(compromisso.status)}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <CalendarIcon className="h-4 w-4" />
                                  <span>{format(parseISO(compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                                  <span>•</span>
                                  <Clock className="h-4 w-4" />
                                  <span>
                                    {format(parseISO(compromisso.data_hora_inicio), "HH:mm")} - {format(parseISO(compromisso.data_hora_fim), "HH:mm")}
                                  </span>
                                </div>
                                {compromisso.lead && (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
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
        </Tabs>
      </div>
    </div>
  );
}

