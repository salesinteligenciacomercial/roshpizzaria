import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, Plus, Clock, User, Filter, Settings, Bell, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

interface Compromisso {
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
  lead?: {
    name: string;
    phone?: string;
  };
}

interface Lead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week" | "day">("month");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [novoCompromissoOpen, setNovoCompromissoOpen] = useState(false);
  const [configuracoesOpen, setConfiguracoesOpen] = useState(false);
  
  // Form states para novo compromisso
  const [formData, setFormData] = useState({
    lead_id: "",
    data: format(new Date(), "yyyy-MM-dd"),
    hora_inicio: "09:00",
    hora_fim: "10:00",
    tipo_servico: "",
    observacoes: "",
    custo_estimado: "",
    enviar_lembrete: true,
    horas_antecedencia: "24",
  });

  useEffect(() => {
    carregarCompromissos();
    carregarLeads();
    
    // Subscrever para atualizações em tempo real
    const channel = supabase
      .channel('compromissos_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'compromissos'
        },
        () => {
          carregarCompromissos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const carregarCompromissos = async () => {
    try {
      const { data, error } = await supabase
        .from('compromissos')
        .select(`
          *,
          lead:leads(name, phone)
        `)
        .order('data_hora_inicio', { ascending: true });

      if (error) throw error;
      setCompromissos(data || []);
    } catch (error) {
      console.error('Erro ao carregar compromissos:', error);
      toast.error("Erro ao carregar compromissos");
    }
  };

  const carregarLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, email')
        .order('name');

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    }
  };

  const criarCompromisso = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const dataHoraInicio = new Date(`${formData.data}T${formData.hora_inicio}`);
      const dataHoraFim = new Date(`${formData.data}T${formData.hora_fim}`);

      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .insert({
          lead_id: formData.lead_id || null,
          usuario_responsavel_id: user.id,
          owner_id: user.id,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico: formData.tipo_servico,
          observacoes: formData.observacoes,
          custo_estimado: formData.custo_estimado ? parseFloat(formData.custo_estimado) : null,
          status: 'agendado',
        })
        .select()
        .single();

      if (error) throw error;

      // Criar lembrete se solicitado
      if (formData.enviar_lembrete && compromisso) {
        await supabase.from('lembretes').insert({
          compromisso_id: compromisso.id,
          canal: 'whatsapp',
          horas_antecedencia: parseInt(formData.horas_antecedencia),
          mensagem: `Olá! Lembramos do seu compromisso agendado para ${format(dataHoraInicio, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.`,
          status_envio: 'pendente',
        });
      }

      toast.success("Compromisso criado com sucesso!");
      setNovoCompromissoOpen(false);
      limparFormulario();
      carregarCompromissos();
    } catch (error) {
      console.error('Erro ao criar compromisso:', error);
      toast.error("Erro ao criar compromisso");
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
      carregarCompromissos();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error("Erro ao atualizar status");
    }
  };

  const limparFormulario = () => {
    setFormData({
      lead_id: "",
      data: format(new Date(), "yyyy-MM-dd"),
      hora_inicio: "09:00",
      hora_fim: "10:00",
      tipo_servico: "",
      observacoes: "",
      custo_estimado: "",
      enviar_lembrete: true,
      horas_antecedencia: "24",
    });
  };

  const compromissosDoMes = compromissos.filter((c) => {
    const dataCompromisso = parseISO(c.data_hora_inicio);
    const inicio = startOfMonth(selectedDate);
    const fim = endOfMonth(selectedDate);
    return dataCompromisso >= inicio && dataCompromisso <= fim;
  });

  const compromissosDoDia = compromissos.filter((c) => {
    const dataCompromisso = parseISO(c.data_hora_inicio);
    return isSameDay(dataCompromisso, selectedDate);
  }).filter(c => {
    if (filterStatus === "all") return true;
    return c.status === filterStatus;
  });

  const getStatusBadge = (status: string) => {
    const badges = {
      agendado: <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>,
      concluido: <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</Badge>,
      cancelado: <Badge className="bg-red-500"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>,
    };
    return badges[status] || badges.agendado;
  };

  const estatisticas = {
    total: compromissosDoMes.length,
    agendados: compromissosDoMes.filter(c => c.status === 'agendado').length,
    concluidos: compromissosDoMes.filter(c => c.status === 'concluido').length,
    cancelados: compromissosDoMes.filter(c => c.status === 'cancelado').length,
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
                  <Label>Cliente / Lead</Label>
                  <Select value={formData.lead_id} onValueChange={(value) => setFormData({...formData, lead_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.name} {lead.phone && `(${lead.phone})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input 
                      type="date" 
                      value={formData.data}
                      onChange={(e) => setFormData({...formData, data: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário de início</Label>
                    <Input 
                      type="time" 
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Horário de término</Label>
                  <Input 
                    type="time" 
                    value={formData.hora_fim}
                    onChange={(e) => setFormData({...formData, hora_fim: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de serviço</Label>
                  <Select value={formData.tipo_servico} onValueChange={(value) => setFormData({...formData, tipo_servico: value})}>
                    <SelectTrigger>
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
                )}

                <Button className="w-full" onClick={criarCompromisso}>
                  Criar Agendamento
                </Button>
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
            <p className="text-xs text-muted-foreground">Total do mês</p>
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
                  onSelect={(date) => date && setSelectedDate(date)}
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
                                  <span className="font-medium">{compromisso.tipo_servico}</span>
                                  {getStatusBadge(compromisso.status)}
                                </div>
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(parseISO(compromisso.data_hora_inicio), "HH:mm")} - {format(parseISO(compromisso.data_hora_fim), "HH:mm")}
                                </p>
                                {compromisso.lead && (
                                  <p className="text-sm flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {compromisso.lead.name}
                                  </p>
                                )}
                                {compromisso.observacoes && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    {compromisso.observacoes}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {compromisso.status === 'agendado' && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => atualizarStatus(compromisso.id, 'concluido')}
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => atualizarStatus(compromisso.id, 'cancelado')}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
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
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{compromisso.tipo_servico}</span>
                                {getStatusBadge(compromisso.status)}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(parseISO(compromisso.data_hora_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                              {compromisso.lead && (
                                <p className="text-sm flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {compromisso.lead.name}
                                </p>
                              )}
                            </div>
                            {compromisso.custo_estimado && (
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  R$ {compromisso.custo_estimado.toFixed(2)}
                                </p>
                              </div>
                            )}
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
                Lembretes Programados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Funcionalidade de lembretes em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="minhas-agendas">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Agenda Individual</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Configurações individuais em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
