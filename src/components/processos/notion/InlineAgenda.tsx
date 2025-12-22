import { useState, useEffect } from "react";
import { CalendarDays, Edit2, Trash2, Save, Plus, Clock, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format, addHours, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Compromisso {
  id: string;
  titulo: string;
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  paciente?: string;
  observacoes?: string;
}

interface AgendaData {
  nome: string;
  compromissos: Compromisso[];
}

interface InlineAgendaProps {
  content: AgendaData;
  onUpdate: (data: AgendaData) => void;
  onRemove: () => void;
}

const statusColors: Record<string, string> = {
  agendado: "bg-blue-500",
  confirmado: "bg-green-500",
  cancelado: "bg-red-500",
  concluido: "bg-gray-500"
};

export function InlineAgenda({ content, onUpdate, onRemove }: InlineAgendaProps) {
  const [isEditing, setIsEditing] = useState(!content.nome);
  const [data, setData] = useState<AgendaData>({
    nome: content.nome || "",
    compromissos: content.compromissos || []
  });
  const [newCompromisso, setNewCompromisso] = useState({
    titulo: "",
    data_hora_inicio: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:00"),
    duracao: 60,
    tipo_servico: "Reunião",
    paciente: "",
    observacoes: ""
  });

  const handleSave = () => {
    if (!data.nome.trim()) return;
    onUpdate(data);
    setIsEditing(false);
  };

  const addCompromisso = () => {
    if (!newCompromisso.titulo.trim()) return;
    
    const inicio = new Date(newCompromisso.data_hora_inicio);
    const fim = addHours(inicio, newCompromisso.duracao / 60);
    
    const compromisso: Compromisso = {
      id: `temp-${Date.now()}`,
      titulo: newCompromisso.titulo,
      data_hora_inicio: inicio.toISOString(),
      data_hora_fim: fim.toISOString(),
      tipo_servico: newCompromisso.tipo_servico,
      status: "agendado",
      paciente: newCompromisso.paciente,
      observacoes: newCompromisso.observacoes
    };
    
    setData(prev => ({
      ...prev,
      compromissos: [...prev.compromissos, compromisso]
    }));
    
    setNewCompromisso({
      titulo: "",
      data_hora_inicio: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:00"),
      duracao: 60,
      tipo_servico: "Reunião",
      paciente: "",
      observacoes: ""
    });
  };

  const removeCompromisso = (id: string) => {
    setData(prev => ({
      ...prev,
      compromissos: prev.compromissos.filter(c => c.id !== id)
    }));
  };

  if (isEditing) {
    return (
      <div className="border rounded-xl p-4 bg-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <span className="font-semibold">Nova Agenda</span>
        </div>
        
        <Input
          placeholder="Nome da agenda (ex: Reuniões da Semana)"
          value={data.nome}
          onChange={(e) => setData(prev => ({ ...prev, nome: e.target.value }))}
        />

        <div className="border rounded-lg p-3 space-y-3">
          <div className="text-sm font-medium">Adicionar Compromisso</div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Título do compromisso"
              value={newCompromisso.titulo}
              onChange={(e) => setNewCompromisso(prev => ({ ...prev, titulo: e.target.value }))}
            />
            <Input
              type="datetime-local"
              value={newCompromisso.data_hora_inicio}
              onChange={(e) => setNewCompromisso(prev => ({ ...prev, data_hora_inicio: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Duração (min)</label>
              <Input
                type="number"
                min="15"
                step="15"
                value={newCompromisso.duracao}
                onChange={(e) => setNewCompromisso(prev => ({ ...prev, duracao: parseInt(e.target.value) || 60 }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tipo</label>
              <Input
                value={newCompromisso.tipo_servico}
                onChange={(e) => setNewCompromisso(prev => ({ ...prev, tipo_servico: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Participante</label>
              <Input
                value={newCompromisso.paciente}
                onChange={(e) => setNewCompromisso(prev => ({ ...prev, paciente: e.target.value }))}
              />
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCompromisso} disabled={!newCompromisso.titulo.trim()}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {data.compromissos.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Compromissos ({data.compromissos.length})</div>
            {data.compromissos.map((comp) => (
              <div key={comp.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge className={`${statusColors[comp.status] || 'bg-gray-500'} text-white text-xs`}>
                    {comp.status}
                  </Badge>
                  <div>
                    <span className="text-sm font-medium">{comp.titulo}</span>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(comp.data_hora_inicio), "dd/MM HH:mm", { locale: ptBR })}
                      {comp.paciente && (
                        <>
                          <User className="h-3 w-3 ml-2" />
                          {comp.paciente}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeCompromisso(comp.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="h-4 w-4 mr-1" />
            Remover
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!data.nome.trim()}>
            <Save className="h-4 w-4 mr-1" />
            Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold">{data.nome}</h4>
            <div className="text-sm text-muted-foreground mt-1">
              {data.compromissos.length} compromisso{data.compromissos.length !== 1 ? 's' : ''}
            </div>
            
            {data.compromissos.length > 0 && (
              <div className="mt-3 space-y-2">
                {data.compromissos.slice(0, 3).map((comp) => (
                  <div key={comp.id} className="flex items-center gap-2 text-sm">
                    <Badge className={`${statusColors[comp.status] || 'bg-gray-500'} text-white text-xs`}>
                      {format(parseISO(comp.data_hora_inicio), "dd/MM", { locale: ptBR })}
                    </Badge>
                    <span className="truncate">{comp.titulo}</span>
                  </div>
                ))}
                {data.compromissos.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{data.compromissos.length - 3} mais
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
