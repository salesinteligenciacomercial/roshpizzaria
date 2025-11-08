import { useState, useEffect } from "react";
import { Pencil, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  capacidade_simultanea: number;
  disponibilidade: {
    dias: string[];
    horario_inicio: string;
    horario_fim: string;
  };
}

interface Compromisso {
  id: string;
  titulo?: string;
  agenda_id?: string;
  lead_id?: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  observacoes?: string;
  custo_estimado?: number;
  status: string;
  usuario_responsavel_id?: string;
}

interface Lead {
  id: string;
  name: string;
  phone?: string;
  telefone?: string;
  tags?: string[];
}

interface EditarCompromissoDialogProps {
  compromisso: Compromisso;
  onCompromissoUpdated: () => void;
}

export function EditarCompromissoDialog({
  compromisso,
  onCompromissoUpdated,
}: EditarCompromissoDialogProps) {
  const [open, setOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLeadName, setSelectedLeadName] = useState("");
  
  const [leadId, setLeadId] = useState(compromisso.lead_id || "none");
  const [agendaId, setAgendaId] = useState(compromisso.agenda_id || "");
  const [titulo, setTitulo] = useState(compromisso.titulo || "");
  const [data, setData] = useState<Date>(parseISO(compromisso.data_hora_inicio));
  const [horaInicio, setHoraInicio] = useState(
    format(parseISO(compromisso.data_hora_inicio), "HH:mm")
  );
  const [horaFim, setHoraFim] = useState(
    format(parseISO(compromisso.data_hora_fim), "HH:mm")
  );
  const [tipoServico, setTipoServico] = useState(compromisso.tipo_servico);
  const [observacoes, setObservacoes] = useState(compromisso.observacoes || "");
  const [custoEstimado, setCustoEstimado] = useState(
    compromisso.custo_estimado?.toString() || ""
  );

  useEffect(() => {
    if (open) {
      loadLeads();
      loadAgendas();
      resetForm();
    }
  }, [open, compromisso]);

  const resetForm = () => {
    setLeadId(compromisso.lead_id || "none");
    setAgendaId(compromisso.agenda_id || "");
    setTitulo(compromisso.titulo || "");
    setData(parseISO(compromisso.data_hora_inicio));
    setHoraInicio(format(parseISO(compromisso.data_hora_inicio), "HH:mm"));
    setHoraFim(format(parseISO(compromisso.data_hora_fim), "HH:mm"));
    setTipoServico(compromisso.tipo_servico);
    setObservacoes(compromisso.observacoes || "");
    setCustoEstimado(compromisso.custo_estimado?.toString() || "");
    setErrors({});
    setLeadSearch("");
    setSelectedLeadName("");
  };

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, telefone, tags")
        .order("name");

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Erro ao carregar leads:", error);
    }
  };

  const loadAgendas = async () => {
    try {
      const { data, error } = await supabase
        .from("agendas")
        .select("*")
        .eq("status", "ativo")
        .order("nome");

      if (error) throw error;
      setAgendas(data || []);
    } catch (error) {
      console.error("Erro ao carregar agendas:", error);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!leadSearch.trim()) return true;
    const search = leadSearch.toLowerCase();
    const name = lead.name?.toLowerCase() || "";
    const phone = lead.phone?.toLowerCase() || "";
    const telefone = lead.telefone?.toLowerCase() || "";
    const tags = (lead.tags || []).join(" ").toLowerCase();
    return name.includes(search) || phone.includes(search) || telefone.includes(search) || tags.includes(search);
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (titulo && titulo.length > 120) {
      newErrors.titulo = "Título deve ter no máximo 120 caracteres";
    }

    // Validar data
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataSelecionada = new Date(data);
    dataSelecionada.setHours(0, 0, 0, 0);

    if (dataSelecionada < hoje && compromisso.status === 'agendado') {
      newErrors.data = "A data não pode ser no passado para compromissos agendados";
    }

    // Validar horários
    const [horaInicioH, horaInicioM] = horaInicio.split(":").map(Number);
    const [horaFimH, horaFimM] = horaFim.split(":").map(Number);
    const minutosInicio = horaInicioH * 60 + horaInicioM;
    const minutosFim = horaFimH * 60 + horaFimM;

    if (minutosFim <= minutosInicio) {
      newErrors.horaFim = "Horário de término deve ser após o início";
    }

    if (minutosFim - minutosInicio < 15) {
      newErrors.horaFim = "Compromisso deve ter no mínimo 15 minutos";
    }

    // Validar tipo de serviço
    if (!tipoServico.trim()) {
      newErrors.tipoServico = "Tipo de serviço é obrigatório";
    }

    // Validar observações
    if (observacoes.length > 500) {
      newErrors.observacoes = "Observações devem ter no máximo 500 caracteres";
    }

    // Validar custo
    if (custoEstimado && parseFloat(custoEstimado) < 0) {
      newErrors.custoEstimado = "Valor não pode ser negativo";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    try {
      const dataFormatada = format(data, "yyyy-MM-dd");
      const dataHoraInicio = new Date(`${dataFormatada}T${horaInicio}`);
      const dataHoraFim = new Date(`${dataFormatada}T${horaFim}`);

      // Validar agenda se selecionada
      if (agendaId) {
        const agendaSelecionada = agendas.find(a => a.id === agendaId);
        
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
        
        const [horaInicioNum, minutoInicioNum] = horaInicio.split(':').map(Number);
        const [horaFimNum, minutoFimNum] = horaFim.split(':').map(Number);
        const inicioSolicitado = horaInicioNum * 60 + minutoInicioNum;
        const fimSolicitado = horaFimNum * 60 + minutoFimNum;

        if (inicioSolicitado < inicioDisponivel || fimSolicitado > fimDisponivel) {
          toast.error(`O horário está fora do horário de funcionamento da agenda (${agendaSelecionada.disponibilidade.horario_inicio} - ${agendaSelecionada.disponibilidade.horario_fim})`);
          return;
        }

        // Validar capacidade simultânea (excluindo o próprio compromisso)
        const { data: compromissosAgenda, error: capacidadeError } = await supabase
          .from("compromissos")
          .select("id")
          .eq("agenda_id", agendaId)
          .eq("status", "agendado")
          .neq("id", compromisso.id)
          .lt("data_hora_inicio", dataHoraFim.toISOString())
          .gt("data_hora_fim", dataHoraInicio.toISOString());

        if (capacidadeError) {
          console.error("Erro ao verificar capacidade:", capacidadeError);
          throw capacidadeError;
        }

        const ocupacaoAtual = compromissosAgenda?.length || 0;
        if (ocupacaoAtual >= agendaSelecionada.capacidade_simultanea) {
          toast.error(`A agenda "${agendaSelecionada.nome}" já está com capacidade máxima (${agendaSelecionada.capacidade_simultanea} compromissos simultâneos)`);
          return;
        }
      }

      // Checar conflito de horários
      const conflitosQuery = supabase
        .from("compromissos")
        .select("id, data_hora_inicio, data_hora_fim")
        .eq("status", "agendado")
        .neq("id", compromisso.id)
        .lt("data_hora_inicio", dataHoraFim.toISOString())
        .gt("data_hora_fim", dataHoraInicio.toISOString());

      if (agendaId) {
        conflitosQuery.eq("agenda_id", agendaId);
      } else if (compromisso.usuario_responsavel_id) {
        conflitosQuery.eq("usuario_responsavel_id", compromisso.usuario_responsavel_id);
      }

      const { data: conflitos, error: confErr } = await conflitosQuery;

      if (confErr) {
        throw confErr;
      }

      if (conflitos && conflitos.length > 0) {
        const mensagem = agendaId 
          ? "Conflito de horário: já existe um compromisso nessa agenda nesse intervalo"
          : "Conflito de horário: já existe um compromisso nesse intervalo";
        toast.error(mensagem);
        return;
      }

      const { error } = await supabase
        .from("compromissos")
        .update({
          titulo: titulo?.trim() || null,
          agenda_id: agendaId || null,
          lead_id: leadId === 'none' ? null : leadId,
          data_hora_inicio: dataHoraInicio.toISOString(),
          data_hora_fim: dataHoraFim.toISOString(),
          tipo_servico: tipoServico.trim(),
          observacoes: observacoes.trim(),
          custo_estimado: custoEstimado ? parseFloat(custoEstimado) : null,
        })
        .eq("id", compromisso.id);

      if (error) throw error;

      toast.success("Compromisso atualizado com sucesso!");
      setOpen(false);
      setErrors({});
      onCompromissoUpdated();
    } catch (error) {
      console.error("Erro ao atualizar compromisso:", error);
      toast.error("Erro ao atualizar compromisso");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => e.stopPropagation()}
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Compromisso</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                if (errors.titulo) setErrors({ ...errors, titulo: "" });
              }}
              placeholder="Assunto do compromisso (opcional)"
              className={errors.titulo ? "border-destructive" : ""}
            />
            {errors.titulo && (
              <p className="text-xs text-destructive mt-1">{errors.titulo}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Agenda (Opcional)</Label>
            <Select value={agendaId || "none"} onValueChange={(value) => setAgendaId(value === "none" ? "" : value)}>
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
            {agendaId && (
              <p className="text-xs text-muted-foreground">
                {(() => {
                  const agenda = agendas.find(a => a.id === agendaId);
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
                        setLeadId(lead.id);
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
                    setLeadId("none");
                    setSelectedLeadName("");
                  }}
                  className="h-6 px-2"
                >
                  Remover
                </Button>
              </div>
            )}
            {!leadSearch && !selectedLeadName && (
              <p className="text-xs text-muted-foreground">
                Digite para buscar um lead ou deixe vazio para nenhum
              </p>
            )}
          </div>

          <div>
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !data && "text-muted-foreground",
                    errors.data && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {data ? format(data, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={data}
                  onSelect={(newDate) => {
                    if (newDate) {
                      setData(newDate);
                      if (errors.data) setErrors({ ...errors, data: "" });
                    }
                  }}
                  locale={ptBR}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {errors.data && (
              <p className="text-xs text-destructive mt-1">{errors.data}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Horário de início *</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => {
                  setHoraInicio(e.target.value);
                  if (errors.horaInicio) setErrors({ ...errors, horaInicio: "" });
                }}
                className={errors.horaInicio ? "border-destructive" : ""}
              />
              {errors.horaInicio && (
                <p className="text-xs text-destructive mt-1">{errors.horaInicio}</p>
              )}
            </div>
            <div>
              <Label>Horário de término *</Label>
              <Input
                type="time"
                value={horaFim}
                onChange={(e) => {
                  setHoraFim(e.target.value);
                  if (errors.horaFim) setErrors({ ...errors, horaFim: "" });
                }}
                className={errors.horaFim ? "border-destructive" : ""}
              />
              {errors.horaFim && (
                <p className="text-xs text-destructive mt-1">{errors.horaFim}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Tipo de serviço *</Label>
            <Select value={tipoServico} onValueChange={setTipoServico}>
              <SelectTrigger className={errors.tipoServico ? "border-destructive" : ""}>
                <SelectValue />
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
            {errors.tipoServico && (
              <p className="text-xs text-destructive mt-1">{errors.tipoServico}</p>
            )}
          </div>

          <div>
            <Label>Valor estimado (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={custoEstimado}
              onChange={(e) => {
                setCustoEstimado(e.target.value);
                if (errors.custoEstimado) setErrors({ ...errors, custoEstimado: "" });
              }}
              className={errors.custoEstimado ? "border-destructive" : ""}
            />
            {errors.custoEstimado && (
              <p className="text-xs text-destructive mt-1">{errors.custoEstimado}</p>
            )}
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações internas sobre o compromisso..."
              value={observacoes}
              onChange={(e) => {
                setObservacoes(e.target.value);
                if (errors.observacoes) setErrors({ ...errors, observacoes: "" });
              }}
              rows={3}
              className={errors.observacoes ? "border-destructive" : ""}
            />
            {errors.observacoes && (
              <p className="text-xs text-destructive mt-1">{errors.observacoes}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {observacoes.length}/500 caracteres
            </p>
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
