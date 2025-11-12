import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, X } from "lucide-react";

interface FilaColaboradoresDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filaId: string | null;
}

interface ColaboradorFila {
  id: string;
  user_id: string;
  queue_id: string;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface UsuarioDisponivel {
  id: string;
  full_name: string;
  email: string;
}

export function FilaColaboradoresDialog({ open, onOpenChange, filaId }: FilaColaboradoresDialogProps) {
  const [colaboradores, setColaboradores] = useState<ColaboradorFila[]>([]);
  const [usuariosDisponiveis, setUsuariosDisponiveis] = useState<UsuarioDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const { toast } = useToast();

  useEffect(() => {
    if (open && filaId) {
      loadColaboradores();
      loadUsuariosDisponiveis();
    }
  }, [open, filaId]);

  const loadColaboradores = async () => {
    if (!filaId) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("support_queue_members")
        .select("id, user_id, queue_id, created_at")
        .eq("queue_id", filaId);

      if (error) throw error;

      // Buscar profiles separadamente
      const userIds = (data || []).map((c: any) => c.user_id);
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        // Combinar dados
        const colaboradoresComProfiles = (data || []).map((colab: any) => ({
          ...colab,
          profiles: profilesData?.find((p: any) => p.id === colab.user_id) || null,
        }));

        setColaboradores(colaboradoresComProfiles as any);
      } else {
        setColaboradores([]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar colaboradores:", error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar colaboradores",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsuariosDisponiveis = async () => {
    if (!filaId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar company_id (pode ter múltiplas empresas)
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id);

      const companyId = userRoles?.[0]?.company_id;
      if (!companyId) return;

      // Buscar todos os usuários da empresa
      const { data: allUsers, error: usersError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", companyId);

      if (usersError) throw usersError;

      // Buscar IDs dos usuários já na fila
      const { data: colaboradoresNaFila } = await supabase
        .from("support_queue_members")
        .select("user_id")
        .eq("queue_id", filaId);

      const idsNaFila = new Set((colaboradoresNaFila || []).map((c: any) => c.user_id));

      // Filtrar usuários que não estão na fila
      const userIdsDisponiveis = (allUsers || [])
        .map((u: any) => u.user_id)
        .filter((id: string) => !idsNaFila.has(id));

      // Buscar profiles dos usuários disponíveis
      if (userIdsDisponiveis.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIdsDisponiveis);

        const disponiveis = (profilesData || []).map((p: any) => ({
          id: p.id,
          full_name: p.full_name || p.email,
          email: p.email,
        }));

        setUsuariosDisponiveis(disponiveis);
      } else {
        setUsuariosDisponiveis([]);
      }
    } catch (error: any) {
      console.error("Erro ao carregar usuários disponíveis:", error);
    }
  };

  const adicionarColaborador = async () => {
    if (!filaId || !selectedUserId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Selecione um usuário para adicionar",
      });
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("support_queue_members")
        .insert({
          queue_id: filaId,
          user_id: selectedUserId,
        });

      if (error) throw error;

      toast({
        title: "Colaborador adicionado",
        description: "O colaborador foi adicionado à fila com sucesso.",
      });

      setShowAddForm(false);
      setSelectedUserId("");
      await loadColaboradores();
      await loadUsuariosDisponiveis();
    } catch (error: any) {
      console.error("Erro ao adicionar colaborador:", error);
      toast({
        variant: "destructive",
        title: "Erro ao adicionar colaborador",
        description: error.message || "Ocorreu um erro ao adicionar o colaborador.",
      });
    } finally {
      setLoading(false);
    }
  };

  const removerColaborador = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este colaborador da fila?")) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("support_queue_members")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Colaborador removido",
        description: "O colaborador foi removido da fila.",
      });

      await loadColaboradores();
      await loadUsuariosDisponiveis();
    } catch (error: any) {
      console.error("Erro ao remover colaborador:", error);
      toast({
        variant: "destructive",
        title: "Erro ao remover colaborador",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!filaId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Colaboradores</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione uma fila para gerenciar seus colaboradores.
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Colaboradores da Fila</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} disabled={usuariosDisponiveis.length === 0}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Colaborador
            </Button>
          ) : (
            <div className="space-y-4 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Adicionar Colaborador</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedUserId("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Usuário *</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {usuariosDisponiveis.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setSelectedUserId("");
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={adicionarColaborador} disabled={loading || !selectedUserId}>
                  {loading ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          )}

          {loading && colaboradores.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : colaboradores.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum colaborador nesta fila
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Adicionado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colaboradores.map((colaborador: any) => (
                  <TableRow key={colaborador.id}>
                    <TableCell>{colaborador.profiles?.full_name || "-"}</TableCell>
                    <TableCell>{colaborador.profiles?.email || "-"}</TableCell>
                    <TableCell>
                      {new Date(colaborador.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removerColaborador(colaborador.id)}
                        title="Remover"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
      </DialogContent>
    </Dialog>
  );
}
