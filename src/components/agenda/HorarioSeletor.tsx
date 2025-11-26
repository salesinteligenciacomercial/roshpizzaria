import { useMemo } from "react";
import { format, parse, isAfter, isBefore, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HorarioComercial } from "./HorarioComercialConfig";

interface Compromisso {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
}

interface HorarioSeletorProps {
  data: string; // YYYY-MM-DD
  horarioComercial: HorarioComercial;
  compromissosExistentes: Compromisso[];
  horarioSelecionado?: string;
  duracaoMinutos?: number;
  permitirSimultaneo?: boolean;
  onSelecionarHorario: (horario: string) => void;
}

export function HorarioSeletor({
  data,
  horarioComercial,
  compromissosExistentes,
  horarioSelecionado,
  duracaoMinutos = 30,
  permitirSimultaneo = false,
  onSelecionarHorario,
}: HorarioSeletorProps) {
  // Gerar lista de horários disponíveis baseado na configuração
  const horariosDisponiveis = useMemo(() => {
    const horarios: Array<{
      horario: string;
      disponivel: boolean;
      compromissos: Compromisso[];
    }> = [];

    const dataBase = parse(data, "yyyy-MM-dd", new Date());

    // Função para adicionar horários de um período
    const adicionarHorariosPeriodo = (inicio: string, fim: string) => {
      const horaInicio = parse(inicio, "HH:mm", dataBase);
      const horaFim = parse(fim, "HH:mm", dataBase);

      let horarioAtual = horaInicio;
      while (isBefore(horarioAtual, horaFim)) {
        const horarioStr = format(horarioAtual, "HH:mm");

        // Verificar se este horário tem conflito com compromissos existentes
        const inicioCompromisso = parse(`${data} ${horarioStr}`, "yyyy-MM-dd HH:mm", new Date());
        const fimCompromisso = addMinutes(inicioCompromisso, duracaoMinutos);

        const compromissosNoHorario = compromissosExistentes.filter((comp) => {
          const compInicio = new Date(comp.data_hora_inicio);
          const compFim = new Date(comp.data_hora_fim);

          // Verificar se há sobreposição de horários
          // Um horário está ocupado se o novo compromisso começaria durante um existente
          return (
            inicioCompromisso >= compInicio && inicioCompromisso < compFim
          );
        });

        // Se permite simultâneo, sempre disponível
        // Se não permite, só disponível se não houver compromissos
        const disponivel = permitirSimultaneo || compromissosNoHorario.length === 0;

        horarios.push({
          horario: horarioStr,
          disponivel,
          compromissos: compromissosNoHorario,
        });

        horarioAtual = addMinutes(horarioAtual, 30); // Intervalos de 30 minutos
      }
    };

    // Adicionar horários da manhã (se ativo)
    if (horarioComercial.manha.ativo) {
      adicionarHorariosPeriodo(horarioComercial.manha.inicio, horarioComercial.manha.fim);
    }

    // Adicionar horários da tarde (se ativo), excluindo intervalo de almoço
    if (horarioComercial.tarde.ativo) {
      let inicioTarde = horarioComercial.tarde.inicio;

      // Se intervalo de almoço ativo, ajustar início da tarde
      if (horarioComercial.intervalo_almoco.ativo) {
        const fimAlmoco = parse(horarioComercial.intervalo_almoco.fim, "HH:mm", dataBase);
        const inicioTardeOriginal = parse(horarioComercial.tarde.inicio, "HH:mm", dataBase);

        // Usar o maior valor entre fim do almoço e início da tarde
        if (isAfter(fimAlmoco, inicioTardeOriginal)) {
          inicioTarde = format(fimAlmoco, "HH:mm");
        }
      }

      adicionarHorariosPeriodo(inicioTarde, horarioComercial.tarde.fim);
    }

    // Adicionar horários da noite (se ativo)
    if (horarioComercial.noite.ativo) {
      adicionarHorariosPeriodo(horarioComercial.noite.inicio, horarioComercial.noite.fim);
    }

    return horarios;
  }, [data, horarioComercial, compromissosExistentes, duracaoMinutos, permitirSimultaneo]);

  const totalDisponiveis = horariosDisponiveis.filter((h) => h.disponivel).length;
  const totalOcupados = horariosDisponiveis.filter((h) => !h.disponivel).length;

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-muted-foreground">
            {totalDisponiveis} disponíveis
          </span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-muted-foreground">{totalOcupados} ocupados</span>
        </div>
        {permitirSimultaneo && (
          <Badge variant="secondary" className="ml-auto">
            <Clock className="h-3 w-3 mr-1" />
            Atendimentos simultâneos
          </Badge>
        )}
      </div>

      {/* Lista de horários */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="grid grid-cols-3 gap-2">
          {horariosDisponiveis.map((item) => {
            const isSelected = horarioSelecionado === item.horario;
            const hasCompromissos = item.compromissos.length > 0;

            return (
              <Button
                key={item.horario}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                disabled={!item.disponivel && !permitirSimultaneo}
                onClick={() => onSelecionarHorario(item.horario)}
                className={cn(
                  "relative flex flex-col items-center justify-center h-auto py-3",
                  !item.disponivel && !permitirSimultaneo && "opacity-50 cursor-not-allowed",
                  hasCompromissos && "border-red-500 bg-red-50 dark:bg-red-950/20"
                )}
              >
                <span className="text-sm font-medium">{item.horario}</span>
                
                {/* Indicador visual de status */}
                {hasCompromissos && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                    <span className="text-xs text-muted-foreground">
                      {item.compromissos.length}
                    </span>
                  </div>
                )}
                
                {!hasCompromissos && item.disponivel && (
                  <div className="h-1.5 w-1.5 rounded-full bg-green-600 mt-1" />
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-600" />
          <span>Livre</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-600" />
          <span>Ocupado</span>
        </div>
        {permitirSimultaneo && (
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Múltiplos atendimentos permitidos</span>
          </div>
        )}
      </div>
    </div>
  );
}
