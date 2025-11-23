import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, User, Trash2, Clock, DollarSign, Copy, ExternalLink, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HorarioComercialConfig, criarHorarioPadrao, converterHorarioAntigo, HorarioComercial } from "./HorarioComercialConfig";

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
  console.log('🚀 [AgendaColaboradores] Componente INICIADO!');
  
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "colaborador",
    capacidade_simultanea: 1,
    tempo_medio_servico: 30,
    horarioComercial: criarHorarioPadrao(),
    dias_semana: ["seg", "ter", "qua", "qui", "sex"],
  });

  useEffect(() => {
    console.log('🔄 [AgendaColaboradores] Componente montado, carregando agendas...');
    carregarAgendas();
  }, []);

  const carregarAgendas = async () => {
    try {
      console.log('📋 [AgendaColaboradores] Buscando agendas no banco...');
      const { data, error } = await supabase
        .from('agendas')
        .select('*')
        .order('nome');

      if (error) {
        console.error('❌ [AgendaColaboradores] Erro ao buscar agendas:', error);
        throw error;
      }
      
      console.log('✅ [AgendaColaboradores] Agendas encontradas:', data?.length || 0, data);
      
      setAgendas(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendas:', error);
      toast.error("Erro ao carregar agendas");
    } finally {
      setLoading(false);
    }
  };

  // Função para gerar slug a partir do nome
  const gerarSlug = (nome: string): string => {
    return nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .trim()
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .replace(/^-|-$/g, ''); // Remove hífens no início/fim
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

      const { data: novaAgenda, error } = await supabase
        .from('agendas')
        .insert([{
          nome: formData.nome,
          tipo: formData.tipo,
          status: 'ativo',
          capacidade_simultanea: formData.capacidade_simultanea,
          tempo_medio_servico: formData.tempo_medio_servico,
          disponibilidade: {
            dias: formData.dias_semana,
            periodos: formData.horarioComercial,
          } as any,
          owner_id: user.id,
          company_id: userRole.company_id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar agenda:', error);
        throw error;
      }

      console.log('✅ Agenda criada:', { id: novaAgenda?.id, nome: novaAgenda?.nome });

      toast.success("Agenda criada com sucesso!");
      setDialogOpen(false);
      carregarAgendas();
      
      // Reset form
      setFormData({
        nome: "",
        tipo: "colaborador",
        capacidade_simultanea: 1,
        tempo_medio_servico: 30,
        horarioComercial: criarHorarioPadrao(),
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

  const copiarLinkAgenda = async (agendaId: string) => {
    const url = `${window.location.origin}/agenda/${agendaId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(agendaId);
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch (error) {
      // Fallback para navegadores antigos
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedSlug(agendaId);
        toast.success("Link copiado para a área de transferência!");
        setTimeout(() => setCopiedSlug(null), 2000);
      } catch (err) {
        toast.error("Erro ao copiar link");
      }
      document.body.removeChild(textArea);
    }
  };

  console.log('🎨 [AgendaColaboradores] Renderizando. Loading:', loading, 'Agendas:', agendas.length);

  if (loading) {
    console.log('⏳ [AgendaColaboradores] Estado de loading, retornando mensagem...');
    return <div>Carregando agendas...</div>;
  }

  console.log('✅ [AgendaColaboradores] Renderizando conteúdo com', agendas.length, 'agendas');

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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                <p className="text-xs text-muted-foreground mb-2">
                  Configure os períodos de atendimento para este colaborador
                </p>
                <HorarioComercialConfig 
                  horario={formData.horarioComercial}
                  onChange={(horario) => setFormData({ ...formData, horarioComercial: horario })}
                />
              </div>

              <Button onClick={criarAgenda} className="w-full">
                Criar Agenda
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {agendas.length === 0 && (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            Nenhuma agenda encontrada. Crie uma nova agenda.
          </div>
        )}
        {agendas.map((agenda) => {
          console.log('🎴 [AgendaColaboradores] Renderizando card da agenda:', { 
            id: agenda.id, 
            nome: agenda.nome
          });
          return (
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
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copiarLinkAgenda(agenda.id)}
                    title="Copiar link da agenda"
                    className="text-primary hover:text-primary hover:bg-primary/10"
                  >
                    {copiedSlug === agenda.id ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => excluirAgenda(agenda.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Excluir agenda"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2 p-3 bg-muted rounded-md mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Link Público:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copiarLinkAgenda(agenda.id)}
                    className="h-6 px-2 text-xs"
                  >
                    {copiedSlug === agenda.id ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                  <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                    {typeof window !== 'undefined' ? window.location.origin : ''}/agenda/{agenda.id}
                  </code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compartilhe este link para visualizar a agenda
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Capacidade: {agenda.capacidade_simultanea} simultâneos</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Tempo médio: {agenda.tempo_medio_servico} min</span>
              </div>
              {agenda.disponibilidade && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    <span>Horários:</span>
                  </div>
                  <div className="text-xs text-muted-foreground pl-6 space-y-0.5">
                    {(() => {
                      const disponibilidade = agenda.disponibilidade;
                      if (disponibilidade?.periodos) {
                        // Novo formato com períodos
                        const periodos = disponibilidade.periodos;
                        const periodosAtivos = [];
                        if (periodos.manha?.ativo) {
                          periodosAtivos.push(
                            <div key="manha">🌅 Manhã: {periodos.manha.inicio} - {periodos.manha.fim}</div>
                          );
                        }
                        if (periodos.intervalo_almoco?.ativo) {
                          periodosAtivos.push(
                            <div key="almoco" className="text-muted-foreground/70">
                              ☕ Almoço: {periodos.intervalo_almoco.inicio} - {periodos.intervalo_almoco.fim}
                            </div>
                          );
                        }
                        if (periodos.tarde?.ativo) {
                          periodosAtivos.push(
                            <div key="tarde">🕐 Tarde: {periodos.tarde.inicio} - {periodos.tarde.fim}</div>
                          );
                        }
                        if (periodos.noite?.ativo) {
                          periodosAtivos.push(
                            <div key="noite">🌙 Noite: {periodos.noite.inicio} - {periodos.noite.fim}</div>
                          );
                        }
                        return periodosAtivos.length > 0 ? periodosAtivos : <span>Não configurado</span>;
                      } else if (disponibilidade?.horario_inicio && disponibilidade?.horario_fim) {
                        // Formato antigo
                        return <span>{disponibilidade.horario_inicio} - {disponibilidade.horario_fim}</span>;
                      }
                      return <span>Não configurado</span>;
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          );
        })}
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
