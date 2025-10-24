import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, User, Trash2, Clock, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Agenda {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  capacidade_simultanea: number;
  tempo_medio_servico: number;
  disponibilidade: any;
  responsavel_id?: string;
}

export function AgendaColaboradores() {
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "colaborador",
    capacidade_simultanea: 1,
    tempo_medio_servico: 30,
    horario_inicio: "08:00",
    horario_fim: "18:00",
    dias_semana: ["seg", "ter", "qua", "qui", "sex"],
  });

  useEffect(() => {
    carregarAgendas();
  }, []);

  const carregarAgendas = async () => {
    try {
      const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .order('nome');

      if (error) throw error;
      setAgendas(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendas:', error);
      toast.error("Erro ao carregar agendas");
    } finally {
      setLoading(false);
    }
  };

  const criarAgenda = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) throw new Error("Empresa não encontrada");

      const { error } = await supabase
        .from('agendas')
        .insert({
          nome: formData.nome,
          tipo: formData.tipo,
          status: 'ativo',
          capacidade_simultanea: formData.capacidade_simultanea,
          tempo_medio_servico: formData.tempo_medio_servico,
          disponibilidade: {
            dias: formData.dias_semana,
            horario_inicio: formData.horario_inicio,
            horario_fim: formData.horario_fim,
          },
          owner_id: user.id,
          company_id: userRole.company_id,
        });

      if (error) throw error;

      toast.success("Agenda criada com sucesso!");
      setDialogOpen(false);
      carregarAgendas();
      
      // Reset form
      setFormData({
        nome: "",
        tipo: "colaborador",
        capacidade_simultanea: 1,
        tempo_medio_servico: 30,
        horario_inicio: "08:00",
        horario_fim: "18:00",
        dias_semana: ["seg", "ter", "qua", "qui", "sex"],
      });
    } catch (error: any) {
      console.error('Erro ao criar agenda:', error);
      toast.error(error.message || "Erro ao criar agenda");
    }
  };

  const excluirAgenda = async (id: string) => {
    try {
      const { error } = await supabase
        .from('agendas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Agenda excluída");
      carregarAgendas();
    } catch (error: any) {
      console.error('Erro ao excluir agenda:', error);
      toast.error(error.message || "Erro ao excluir agenda");
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'ativo' 
      ? <Badge className="bg-success">Ativo</Badge>
      : <Badge variant="secondary">Inativo</Badge>;
  };

  const getTipoBadge = (tipo: string) => {
    const badges = {
      colaborador: <Badge variant="outline">Colaborador</Badge>,
      recurso: <Badge variant="outline" className="border-primary text-primary">Recurso</Badge>,
      sala: <Badge variant="outline" className="border-accent text-accent">Sala</Badge>,
    };
    return badges[tipo as keyof typeof badges] || badges.colaborador;
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Minhas Agendas</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie colaboradores, recursos e salas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Agenda
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Agenda</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Ex: Dr. João Silva"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="recurso">Recurso</SelectItem>
                      <SelectItem value="sala">Sala</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Capacidade Simultânea</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.capacidade_simultanea}
                    onChange={(e) => setFormData({ ...formData, capacidade_simultanea: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Quantos atendimentos ao mesmo tempo
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Tempo Médio (minutos)</Label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={formData.tempo_medio_servico}
                    onChange={(e) => setFormData({ ...formData, tempo_medio_servico: parseInt(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Duração média de cada atendimento
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Horário de Funcionamento</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="time"
                    value={formData.horario_inicio}
                    onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                  />
                  <Input
                    type="time"
                    value={formData.horario_fim}
                    onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={criarAgenda} className="w-full">
                Criar Agenda
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agendas.map((agenda) => (
          <Card key={agenda.id} className="border-0 shadow-card">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {agenda.nome}
                  </CardTitle>
                  <div className="flex gap-2">
                    {getTipoBadge(agenda.tipo)}
                    {getStatusBadge(agenda.status)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => excluirAgenda(agenda.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Capacidade: {agenda.capacidade_simultanea} simultâneos</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Tempo médio: {agenda.tempo_medio_servico} min</span>
              </div>
              {agenda.disponibilidade && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {agenda.disponibilidade.horario_inicio} - {agenda.disponibilidade.horario_fim}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {agendas.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma agenda criada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie agendas para colaboradores, recursos ou salas
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Agenda
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
