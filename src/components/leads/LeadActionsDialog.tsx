import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MessageSquare, CheckSquare, MoreVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LeadActionsDialogProps {
  lead: {
    id: string;
    name: string;
    telefone?: string | null;
    phone?: string | null;
    email?: string | null;
  };
}

export function LeadActionsDialog({ lead }: LeadActionsDialogProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para Compromisso
  const [tipoServico, setTipoServico] = useState("");
  const [dataHoraInicio, setDataHoraInicio] = useState("");
  const [dataHoraFim, setDataHoraFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Estados para Tarefa
  const [tituloTarefa, setTituloTarefa] = useState("");
  const [descricaoTarefa, setDescricaoTarefa] = useState("");
  const [prioridadeTarefa, setPrioridadeTarefa] = useState("media");
  const [dataVencimento, setDataVencimento] = useState("");

  const abrirConversa = () => {
    const telefone = lead.telefone || lead.phone;
    if (telefone) {
      navigate("/conversas");
      setOpen(false);
      toast.success("Abrindo conversa...");
    } else {
      toast.error("Lead não possui telefone cadastrado");
    }
  };

  const criarCompromisso = async () => {
    if (!tipoServico || !dataHoraInicio || !dataHoraFim) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase.from("compromissos").insert({
        lead_id: lead.id,
        tipo_servico: tipoServico,
        data_hora_inicio: dataHoraInicio,
        data_hora_fim: dataHoraFim,
        observacoes,
        status: "agendado",
        usuario_responsavel_id: user.id,
        owner_id: user.id,
      });

      if (error) throw error;

      toast.success("Compromisso criado com sucesso!");
      setOpen(false);
      // Limpar campos
      setTipoServico("");
      setDataHoraInicio("");
      setDataHoraFim("");
      setObservacoes("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar compromisso");
    } finally {
      setLoading(false);
    }
  };

  const criarTarefa = async () => {
    if (!tituloTarefa) {
      toast.error("Título da tarefa é obrigatório");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar primeiro board do usuário
      const { data: boards } = await supabase
        .from("task_boards")
        .select("id, task_columns(id)")
        .eq("owner_id", user.id)
        .limit(1)
        .single();

      if (!boards) {
        toast.error("Você precisa criar um quadro de tarefas primeiro");
        return;
      }

      const { error } = await supabase.from("tasks").insert({
        title: tituloTarefa,
        description: descricaoTarefa,
        priority: prioridadeTarefa,
        due_date: dataVencimento || null,
        lead_id: lead.id,
        board_id: boards.id,
        column_id: boards.task_columns?.[0]?.id || null,
        owner_id: user.id,
        status: "pendente",
      });

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      setOpen(false);
      // Limpar campos
      setTituloTarefa("");
      setDescricaoTarefa("");
      setPrioridadeTarefa("media");
      setDataVencimento("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ações para {lead.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="conversa" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conversa">
              <MessageSquare className="h-4 w-4 mr-2" />
              Conversa
            </TabsTrigger>
            <TabsTrigger value="agenda">
              <Calendar className="h-4 w-4 mr-2" />
              Compromisso
            </TabsTrigger>
            <TabsTrigger value="tarefa">
              <CheckSquare className="h-4 w-4 mr-2" />
              Tarefa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conversa" className="space-y-4">
            <div className="text-center py-8 space-y-4">
              <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {lead.telefone || lead.phone
                  ? "Abrir conversa do WhatsApp com este lead"
                  : "Lead não possui telefone cadastrado"}
              </p>
              <Button
                onClick={abrirConversa}
                disabled={!lead.telefone && !lead.phone}
                className="w-full"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Abrir Conversa WhatsApp
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tipoServico">Tipo de Serviço *</Label>
                <Input
                  id="tipoServico"
                  placeholder="Ex: Consulta, Reunião, Atendimento"
                  value={tipoServico}
                  onChange={(e) => setTipoServico(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataInicio">Data/Hora Início *</Label>
                  <Input
                    id="dataInicio"
                    type="datetime-local"
                    value={dataHoraInicio}
                    onChange={(e) => setDataHoraInicio(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataFim">Data/Hora Fim *</Label>
                  <Input
                    id="dataFim"
                    type="datetime-local"
                    value={dataHoraFim}
                    onChange={(e) => setDataHoraFim(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações sobre o compromisso"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                />
              </div>

              <Button onClick={criarCompromisso} disabled={loading} className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                {loading ? "Criando..." : "Criar Compromisso"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="tarefa" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tituloTarefa">Título *</Label>
                <Input
                  id="tituloTarefa"
                  placeholder="Ex: Enviar proposta, Follow-up"
                  value={tituloTarefa}
                  onChange={(e) => setTituloTarefa(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricaoTarefa">Descrição</Label>
                <Textarea
                  id="descricaoTarefa"
                  placeholder="Detalhes da tarefa"
                  value={descricaoTarefa}
                  onChange={(e) => setDescricaoTarefa(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prioridade">Prioridade</Label>
                  <Select value={prioridadeTarefa} onValueChange={setPrioridadeTarefa}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="urgente">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataVencimento">Data de Vencimento</Label>
                  <Input
                    id="dataVencimento"
                    type="date"
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={criarTarefa} disabled={loading} className="w-full">
                <CheckSquare className="h-4 w-4 mr-2" />
                {loading ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
