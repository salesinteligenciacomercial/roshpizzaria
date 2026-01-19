import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Cake, 
  Send, 
  MessageSquare, 
  Calendar, 
  Settings, 
  History, 
  Plus, 
  Trash2, 
  Edit,
  Clock,
  CheckCircle,
  XCircle,
  Gift,
  Users,
  Image
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInYears, isSameDay, isSameMonth, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Lead {
  id: string;
  name: string;
  phone?: string;
  telefone?: string;
  email?: string;
  data_nascimento?: string;
  company_id?: string;
}

interface MensagemAniversario {
  id: string;
  titulo: string;
  mensagem: string;
  midia_url?: string;
  canal: string;
  ativo: boolean;
  horario_envio: string;
}

interface HistoricoEnvio {
  id: string;
  lead_id: string;
  data_envio: string;
  status: string;
  ano: number;
  lead?: Lead;
}

export function AniversariantesManager() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mensagens, setMensagens] = useState<MensagemAniversario[]>([]);
  const [historico, setHistorico] = useState<HistoricoEnvio[]>([]);
  const [editingMensagem, setEditingMensagem] = useState<MensagemAniversario | null>(null);
  const [novaMensagem, setNovaMensagem] = useState({
    titulo: "",
    mensagem: "",
    midia_url: "",
    horario_envio: "09:00",
    ativo: true
  });
  const [enviando, setEnviando] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      carregarDados();
    }
  }, [open]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;
      setCompanyId(userRole.company_id);

      // Carregar leads com data de nascimento
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, phone, telefone, email, data_nascimento, company_id")
        .eq("company_id", userRole.company_id)
        .not("data_nascimento", "is", null);

      setLeads(leadsData || []);

      // Carregar mensagens de aniversário
      const { data: mensagensData } = await supabase
        .from("aniversario_mensagens")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("created_at", { ascending: false });

      setMensagens((mensagensData || []).map(m => ({
        ...m,
        horario_envio: m.horario_envio || "09:00:00"
      })));

      // Carregar histórico de envios
      const { data: historicoData } = await supabase
        .from("aniversario_envios")
        .select("*")
        .eq("company_id", userRole.company_id)
        .order("data_envio", { ascending: false })
        .limit(100);

      // Enriquecer histórico com dados do lead
      if (historicoData && leadsData) {
        const historicoEnriquecido = historicoData.map(h => ({
          ...h,
          lead: leadsData.find(l => l.id === h.lead_id)
        }));
        setHistorico(historicoEnriquecido);
      }

    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados de aniversariantes");
    } finally {
      setLoading(false);
    }
  };

  const calcularIdade = (dataNascimento: string): number => {
    return differenceInYears(new Date(), parseISO(dataNascimento));
  };

  const isAniversarianteHoje = (dataNascimento: string): boolean => {
    const hoje = new Date();
    const nascimento = parseISO(dataNascimento);
    return isSameDay(
      new Date(hoje.getFullYear(), nascimento.getMonth(), nascimento.getDate()),
      hoje
    );
  };

  const isAniversarianteSemana = (dataNascimento: string): boolean => {
    const hoje = new Date();
    const nascimento = parseISO(dataNascimento);
    for (let i = 0; i <= 7; i++) {
      const dia = addDays(hoje, i);
      if (nascimento.getDate() === dia.getDate() && nascimento.getMonth() === dia.getMonth()) {
        return true;
      }
    }
    return false;
  };

  const isAniversarianteMes = (dataNascimento: string): boolean => {
    const hoje = new Date();
    const nascimento = parseISO(dataNascimento);
    return nascimento.getMonth() === hoje.getMonth();
  };

  const aniversariantesHoje = leads.filter(l => l.data_nascimento && isAniversarianteHoje(l.data_nascimento));
  const aniversariantesSemana = leads.filter(l => l.data_nascimento && isAniversarianteSemana(l.data_nascimento));
  const aniversariantesMes = leads.filter(l => l.data_nascimento && isAniversarianteMes(l.data_nascimento));

  const enviarMensagemIndividual = async (lead: Lead) => {
    if (!companyId) return;
    
    const mensagemAtiva = mensagens.find(m => m.ativo);
    if (!mensagemAtiva) {
      toast.error("Configure uma mensagem de aniversário antes de enviar");
      return;
    }

    const telefone = lead.phone || lead.telefone;
    if (!telefone) {
      toast.error("Lead não possui telefone cadastrado");
      return;
    }

    setEnviando(prev => ({ ...prev, [lead.id]: true }));

    try {
      const idade = lead.data_nascimento ? calcularIdade(lead.data_nascimento) : "";
      const mensagemFormatada = mensagemAtiva.mensagem
        .replace(/{nome}/g, lead.name.split(" ")[0])
        .replace(/{idade}/g, String(idade))
        .replace(/{nome_completo}/g, lead.name);

      // Enviar via WhatsApp
      const { error } = await supabase.functions.invoke("enviar-whatsapp", {
        body: {
          numero: telefone.replace(/\D/g, ""),
          mensagem: mensagemFormatada,
          company_id: companyId,
          mediaUrl: mensagemAtiva.midia_url || undefined
        }
      });

      if (error) throw error;

      // Registrar envio
      await supabase.from("aniversario_envios").insert({
        company_id: companyId,
        lead_id: lead.id,
        mensagem_id: mensagemAtiva.id,
        status: "enviado",
        ano: new Date().getFullYear()
      });

      toast.success(`Mensagem de aniversário enviada para ${lead.name}!`);
      carregarDados();

    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      toast.error("Erro ao enviar mensagem de aniversário");
    } finally {
      setEnviando(prev => ({ ...prev, [lead.id]: false }));
    }
  };

  const enviarMensagemEmMassa = async (listaLeads: Lead[]) => {
    if (!companyId) return;
    
    const mensagemAtiva = mensagens.find(m => m.ativo);
    if (!mensagemAtiva) {
      toast.error("Configure uma mensagem de aniversário antes de enviar");
      return;
    }

    const leadsComTelefone = listaLeads.filter(l => l.phone || l.telefone);
    if (leadsComTelefone.length === 0) {
      toast.error("Nenhum lead possui telefone cadastrado");
      return;
    }

    toast.info(`Enviando mensagens para ${leadsComTelefone.length} contatos...`);

    let enviados = 0;
    let erros = 0;

    for (const lead of leadsComTelefone) {
      try {
        const telefone = lead.phone || lead.telefone;
        const idade = lead.data_nascimento ? calcularIdade(lead.data_nascimento) : "";
        const mensagemFormatada = mensagemAtiva.mensagem
          .replace(/{nome}/g, lead.name.split(" ")[0])
          .replace(/{idade}/g, String(idade))
          .replace(/{nome_completo}/g, lead.name);

        await supabase.functions.invoke("enviar-whatsapp", {
          body: {
            numero: telefone!.replace(/\D/g, ""),
            mensagem: mensagemFormatada,
            company_id: companyId,
            mediaUrl: mensagemAtiva.midia_url || undefined
          }
        });

        await supabase.from("aniversario_envios").insert({
          company_id: companyId,
          lead_id: lead.id,
          mensagem_id: mensagemAtiva.id,
          status: "enviado",
          ano: new Date().getFullYear()
        });

        enviados++;
        // Delay entre envios para não sobrecarregar
        await new Promise(r => setTimeout(r, 1000));
      } catch (error) {
        console.error(`Erro ao enviar para ${lead.name}:`, error);
        erros++;
      }
    }

    toast.success(`${enviados} mensagens enviadas com sucesso!${erros > 0 ? ` (${erros} falharam)` : ""}`);
    carregarDados();
  };

  const salvarMensagem = async () => {
    if (!companyId || !novaMensagem.titulo || !novaMensagem.mensagem) {
      toast.error("Preencha o título e a mensagem");
      return;
    }

    try {
      if (editingMensagem) {
        await supabase
          .from("aniversario_mensagens")
          .update({
            titulo: novaMensagem.titulo,
            mensagem: novaMensagem.mensagem,
            midia_url: novaMensagem.midia_url || null,
            horario_envio: novaMensagem.horario_envio,
            ativo: novaMensagem.ativo,
            updated_at: new Date().toISOString()
          })
          .eq("id", editingMensagem.id);

        toast.success("Mensagem atualizada!");
      } else {
        await supabase.from("aniversario_mensagens").insert({
          company_id: companyId,
          titulo: novaMensagem.titulo,
          mensagem: novaMensagem.mensagem,
          midia_url: novaMensagem.midia_url || null,
          horario_envio: novaMensagem.horario_envio,
          ativo: novaMensagem.ativo
        });

        toast.success("Mensagem criada!");
      }

      setNovaMensagem({ titulo: "", mensagem: "", midia_url: "", horario_envio: "09:00", ativo: true });
      setEditingMensagem(null);
      carregarDados();

    } catch (error) {
      console.error("Erro ao salvar mensagem:", error);
      toast.error("Erro ao salvar mensagem");
    }
  };

  const editarMensagem = (msg: MensagemAniversario) => {
    setEditingMensagem(msg);
    setNovaMensagem({
      titulo: msg.titulo,
      mensagem: msg.mensagem,
      midia_url: msg.midia_url || "",
      horario_envio: msg.horario_envio?.substring(0, 5) || "09:00",
      ativo: msg.ativo
    });
  };

  const excluirMensagem = async (id: string) => {
    try {
      await supabase.from("aniversario_mensagens").delete().eq("id", id);
      toast.success("Mensagem excluída!");
      carregarDados();
    } catch (error) {
      toast.error("Erro ao excluir mensagem");
    }
  };

  const toggleAtivoMensagem = async (msg: MensagemAniversario) => {
    try {
      // Desativar todas as outras se estiver ativando esta
      if (!msg.ativo) {
        await supabase
          .from("aniversario_mensagens")
          .update({ ativo: false })
          .eq("company_id", companyId);
      }

      await supabase
        .from("aniversario_mensagens")
        .update({ ativo: !msg.ativo })
        .eq("id", msg.id);

      carregarDados();
    } catch (error) {
      toast.error("Erro ao atualizar mensagem");
    }
  };

  const renderLeadCard = (lead: Lead, showSendButton = true) => (
    <Card key={lead.id} className="mb-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {lead.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{lead.name}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {lead.data_nascimento && format(parseISO(lead.data_nascimento), "dd/MM/yyyy")}
                <Badge variant="outline" className="ml-2">
                  <Gift className="h-3 w-3 mr-1" />
                  {lead.data_nascimento && calcularIdade(lead.data_nascimento)} anos
                </Badge>
              </div>
            </div>
          </div>
          {showSendButton && (
            <Button 
              size="sm" 
              onClick={() => enviarMensagemIndividual(lead)}
              disabled={enviando[lead.id]}
            >
              {enviando[lead.id] ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Enviar
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Cake className="h-4 w-4 md:mr-2" />
          <span className="hidden md:inline">Aniversariantes</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-500" />
            Gestão de Aniversariantes
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="hoje" className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="hoje" className="relative">
                Hoje
                {aniversariantesHoje.length > 0 && (
                  <Badge className="ml-1 h-5 w-5 p-0 text-xs absolute -top-1 -right-1 bg-pink-500">
                    {aniversariantesHoje.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="semana">
                Semana
                {aniversariantesSemana.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 p-0 px-1 text-xs">
                    {aniversariantesSemana.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mes">
                Mês
                {aniversariantesMes.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 min-w-5 p-0 px-1 text-xs">
                    {aniversariantesMes.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="mensagens">
                <Settings className="h-4 w-4 mr-1" />
                Mensagens
              </TabsTrigger>
              <TabsTrigger value="historico">
                <History className="h-4 w-4 mr-1" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 h-[500px] mt-4">
              <TabsContent value="hoje" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Cake className="h-5 w-5 text-pink-500" />
                      Aniversariantes de Hoje
                    </h3>
                    {aniversariantesHoje.length > 0 && (
                      <Button onClick={() => enviarMensagemEmMassa(aniversariantesHoje)}>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar para Todos
                      </Button>
                    )}
                  </div>
                  {aniversariantesHoje.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Cake className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum aniversariante hoje</p>
                    </div>
                  ) : (
                    aniversariantesHoje.map(lead => renderLeadCard(lead))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="semana" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Próximos 7 Dias</h3>
                    {aniversariantesSemana.length > 0 && (
                      <Button variant="outline" onClick={() => enviarMensagemEmMassa(aniversariantesSemana)}>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar para Todos
                      </Button>
                    )}
                  </div>
                  {aniversariantesSemana.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum aniversariante nos próximos 7 dias</p>
                    </div>
                  ) : (
                    aniversariantesSemana.map(lead => renderLeadCard(lead))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mes" className="mt-0">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Aniversariantes do Mês</h3>
                    {aniversariantesMes.length > 0 && (
                      <Button variant="outline" onClick={() => enviarMensagemEmMassa(aniversariantesMes)}>
                        <Send className="h-4 w-4 mr-2" />
                        Enviar para Todos
                      </Button>
                    )}
                  </div>
                  {aniversariantesMes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum aniversariante neste mês</p>
                    </div>
                  ) : (
                    aniversariantesMes.map(lead => renderLeadCard(lead))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mensagens" className="mt-0">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {editingMensagem ? "Editar Mensagem" : "Nova Mensagem de Aniversário"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Título</Label>
                        <Input
                          value={novaMensagem.titulo}
                          onChange={(e) => setNovaMensagem({ ...novaMensagem, titulo: e.target.value })}
                          placeholder="Ex: Feliz Aniversário!"
                        />
                      </div>
                      <div>
                        <Label>Mensagem</Label>
                        <Textarea
                          value={novaMensagem.mensagem}
                          onChange={(e) => setNovaMensagem({ ...novaMensagem, mensagem: e.target.value })}
                          placeholder="Use {nome} para o primeiro nome, {idade} para idade, {nome_completo} para nome completo"
                          rows={4}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Variáveis: {"{nome}"}, {"{idade}"}, {"{nome_completo}"}
                        </p>
                      </div>
                      <div>
                        <Label>URL da Imagem/Vídeo (opcional)</Label>
                        <Input
                          value={novaMensagem.midia_url}
                          onChange={(e) => setNovaMensagem({ ...novaMensagem, midia_url: e.target.value })}
                          placeholder="https://exemplo.com/imagem.jpg"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Horário de Envio Automático</Label>
                          <Input
                            type="time"
                            value={novaMensagem.horario_envio}
                            onChange={(e) => setNovaMensagem({ ...novaMensagem, horario_envio: e.target.value })}
                            className="w-32"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Label>Ativo</Label>
                          <Switch
                            checked={novaMensagem.ativo}
                            onCheckedChange={(checked) => setNovaMensagem({ ...novaMensagem, ativo: checked })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={salvarMensagem}>
                          {editingMensagem ? "Atualizar" : "Salvar Mensagem"}
                        </Button>
                        {editingMensagem && (
                          <Button variant="outline" onClick={() => {
                            setEditingMensagem(null);
                            setNovaMensagem({ titulo: "", mensagem: "", midia_url: "", horario_envio: "09:00", ativo: true });
                          }}>
                            Cancelar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-2">
                    <h4 className="font-semibold">Mensagens Cadastradas</h4>
                    {mensagens.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhuma mensagem cadastrada</p>
                    ) : (
                      mensagens.map(msg => (
                        <Card key={msg.id} className={msg.ativo ? "border-green-500" : ""}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-medium">{msg.titulo}</h5>
                                  {msg.ativo && (
                                    <Badge variant="default" className="bg-green-500">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Ativo
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {msg.mensagem}
                                </p>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {msg.horario_envio?.substring(0, 5)}
                                  </span>
                                  {msg.midia_url && (
                                    <span className="flex items-center gap-1">
                                      <Image className="h-3 w-3" />
                                      Com mídia
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={msg.ativo}
                                  onCheckedChange={() => toggleAtivoMensagem(msg)}
                                />
                                <Button variant="ghost" size="icon" onClick={() => editarMensagem(msg)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => excluirMensagem(msg.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="historico" className="mt-0">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Histórico de Envios</h3>
                  {historico.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum envio registrado</p>
                    </div>
                  ) : (
                    historico.map(h => (
                      <Card key={h.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {h.status === "enviado" ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <div>
                                <p className="font-medium">{h.lead?.name || "Lead removido"}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(h.data_envio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            <Badge variant={h.status === "enviado" ? "default" : "destructive"}>
                              {h.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
