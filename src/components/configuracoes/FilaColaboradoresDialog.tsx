import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, UserCheck, AlertTriangle } from "lucide-react";

interface FilaData {
  id: string;
  nome: string;
  descricao?: string;
}

interface Colaborador {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  capacidade_maxima: number;
  atendimentos_ativos: number;
  status: "disponivel" | "ocupado" | "ausente";
}

interface FilaColaboradoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila: FilaData | null;
}

export function FilaColaboradoresDialog({ open, onOpenChange, fila }: FilaColaboradoresDialogProps) {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [capacidadeMaxima, setCapacidadeMaxima] = useState(10);
  const { toast } = useToast();

  useEffect(() => {
    if (open && fila) {
      loadColaboradores();
      loadUsuariosDisponiveis();
    }
  }, [open, fila]);

  const loadColaboradores = async () => {
    if (!fila) return;

    setLoading(true);
    try {
      // Buscar colaboradores associados à fila
      const { data: colaboradoresData, error } = await supabase
        .from('fila_colaboradores')
        .select(`
          id,
          user_id,
          capacidade_maxima,
          atendimentos_ativos,
          status,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('fila_id', fila.id);

      if (error) throw error;

      const formattedColaboradores: Colaborador[] = colaboradoresData?.map(c => ({
        id: c.id,
        user_id: c.user_id,
        nome: c.profiles?.full_name || c.profiles?.email || 'Usuário',
        email: c.profiles?.email || '',
        capacidade_maxima: c.capacidade_maxima,
        atendimentos_ativos: c.atendimentos_ativos,
        status: c.status
      })) || [];

      setColaboradores(formattedColaboradores);
    } catch (error: any) {
      console.error('Erro ao carregar colaboradores:', error);
      toast({
        title: "Erro ao carregar colaboradores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsuariosDisponiveis = async () => {
    if (!fila) return;

    try {
      // Buscar usuários da mesma empresa que não estão nesta fila
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) return;

      // Buscar todos os usuários da empresa
      const { data: allUsers } = await supabase
        .from('user_roles')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .eq('company_id', userRole.company_id);

      // Buscar usuários já associados à fila
      const { data: existingUsers } = await supabase
        .from('fila_colaboradores')
        .select('user_id')
        .eq('fila_id', fila.id);

      const existingUserIds = new Set(existingUsers?.map(e => e.user_id) || []);

      // Filtrar usuários disponíveis
      const availableUsers = allUsers?.filter(u =>
        u.profiles &&
        !existingUserIds.has(u.user_id) &&
        u.user_id !== user.id // Não incluir o próprio usuário
      ) || [];

      setUsuariosDisponiveis(availableUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários disponíveis:', error);
    }
  };

  const adicionarColaborador = async () => {
    if (!fila || !selectedUserId) return;

    try {
      const { error } = await supabase
        .from('fila_colaboradores')
        .insert([{
          fila_id: fila.id,
          user_id: selectedUserId,
          capacidade_maxima: capacidadeMaxima,
          atendimentos_ativos: 0,
          status: 'disponivel'
        }]);

      if (error) throw error;

      toast({
        title: "Colaborador adicionado",
        description: "Colaborador foi associado à fila com sucesso",
      });

      setShowAddForm(false);
      setSelectedUserId("");
      setCapacidadeMaxima(10);
      loadColaboradores();
      loadUsuariosDisponiveis();
    } catch (error: any) {
      console.error('Erro ao adicionar colaborador:', error);
      toast({
        title: "Erro ao adicionar colaborador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const removerColaborador = async (colaboradorId: string) => {
    try {
      const { error } = await supabase
        .from('fila_colaboradores')
        .delete()
        .eq('id', colaboradorId);

      if (error) throw error;

      toast({
        title: "Colaborador removido",
        description: "Colaborador foi removido da fila",
      });

      loadColaboradores();
      loadUsuariosDisponiveis();
    } catch (error: any) {
      console.error('Erro ao remover colaborador:', error);
      toast({
        title: "Erro ao remover colaborador",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const atualizarStatus = async (colaboradorId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from('fila_colaboradores')
        .update({ status: novoStatus })
        .eq('id', colaboradorId);

      if (error) throw error;

      loadColaboradores();
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      disponivel: "default",
      ocupado: "destructive",
      ausente: "secondary",
    };
    const labels = {
      disponivel: "Disponível",
      ocupado: "Ocupado",
      ausente: "Ausente",
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  if (!fila) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Gerenciar Colaboradores - {fila.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Formulário para adicionar colaborador */}
          {showAddForm && (
            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
              <h4 className="font-medium flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Colaborador
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Usuário</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuariosDisponiveis.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          {user.profiles?.full_name || user.profiles?.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Capacidade Máxima</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={capacidadeMaxima}
                    onChange={(e) => setCapacidadeMaxima(parseInt(e.target.value) || 10)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={adicionarColaborador} disabled={!selectedUserId}>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Adicionar
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Botão para mostrar formulário */}
          {!showAddForm && usuariosDisponiveis.length > 0 && (
            <Button onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Colaborador à Fila
            </Button>
          )}

          {/* Lista de colaboradores */}
          <div className="space-y-2">
            <h4 className="font-medium">Colaboradores Atribuídos</h4>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : colaboradores.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nenhum colaborador atribuído a esta fila</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Atendimentos Ativos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {colaboradores.map((colaborador) => (
                    <TableRow key={colaborador.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{colaborador.nome}</p>
                          <p className="text-sm text-muted-foreground">{colaborador.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={colaborador.status}
                          onValueChange={(value) => atualizarStatus(colaborador.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponivel">Disponível</SelectItem>
                            <SelectItem value="ocupado">Ocupado</SelectItem>
                            <SelectItem value="ausente">Ausente</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{colaborador.capacidade_maxima}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{colaborador.atendimentos_ativos}</span>
                          {colaborador.atendimentos_ativos >= colaborador.capacidade_maxima && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removerColaborador(colaborador.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
