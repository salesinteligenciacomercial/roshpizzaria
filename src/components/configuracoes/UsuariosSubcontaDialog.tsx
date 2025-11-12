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
import { Plus, Trash2, Power } from "lucide-react";

interface Company {
  id: string;
  name: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface UsuariosSubcontaDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UsuariosSubcontaDialog({ company, open, onOpenChange }: UsuariosSubcontaDialogProps) {
  const [users, setUsers] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "user",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      console.log("Carregando usuários para empresa:", company.id);
      
      // Buscar user_roles primeiro
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .eq("company_id", company.id);

      if (rolesError) {
        console.error("Erro ao buscar user_roles:", rolesError);
        throw rolesError;
      }

      if (!userRoles || userRoles.length === 0) {
        setUsers([]);
        return;
      }

      // Buscar profiles separadamente
      const userIds = userRoles.map((ur: any) => ur.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Erro ao buscar profiles:", profilesError);
        throw profilesError;
      }

      // Combinar dados
      const usersWithProfiles = userRoles.map((ur: any) => {
        const profile = (profilesData || []).find((p: any) => p.id === ur.user_id);
        return {
          ...ur,
          profiles: profile || null,
        };
      });

      console.log("Usuários carregados:", usersWithProfiles);
      setUsers(usersWithProfiles as any);
    } catch (error: any) {
      console.error("Erro completo ao carregar usuários:", error?.message || error);
      console.error("Detalhes do erro:", JSON.stringify(error, null, 2));
      toast({
        title: "Erro ao carregar usuários",
        description: error?.message || "Não foi possível carregar os usuários.",
        variant: "destructive",
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log("➕ [USUÁRIOS] Adicionando novo usuário:", formData.email);

      // Fazer chamada direta via fetch para capturar resposta completa em caso de erro
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Configuração do Supabase não encontrada.");
      }

      const functionUrl = `${supabaseUrl}/functions/v1/criar-usuario-subconta`;

      const requestBody = {
        companyId: company.id,
        email: formData.email,
        full_name: formData.full_name,
        role: formData.role,
      };

      console.log("📤 [USUÁRIOS] Enviando requisição:", requestBody);

      const fetchResponse = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await fetchResponse.text();
      let responseData: any;
      
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.error("Erro ao parsear resposta:", e, "Resposta:", responseText);
        throw new Error("Resposta inválida do servidor");
      }

      // Se não for sucesso, tratar como erro
      if (!fetchResponse.ok) {
        // Priorizar mensagem de erro mais específica
        let errorMessage = responseData?.error || responseData?.message;
        
        // Se não tiver mensagem, usar status
        if (!errorMessage) {
          errorMessage = `Erro ${fetchResponse.status}: ${fetchResponse.statusText}`;
        }
        
        // Adicionar detalhes se disponível
        if (responseData?.details && responseData.details !== errorMessage) {
          errorMessage = `${errorMessage} (${responseData.details})`;
        }
        
        console.error("❌ [USUÁRIOS] Erro da edge function:", {
          status: fetchResponse.status,
          statusText: fetchResponse.statusText,
          data: responseData,
          errorMessage
        });
        
        throw new Error(errorMessage);
      }

      // Sucesso!
      console.log("✅ [USUÁRIOS] Criado com sucesso:", responseData);

      toast({
        title: "Usuário adicionado",
        description: "Usuário criado com sucesso e vinculado à empresa.",
      });

      setShowAddForm(false);
      setFormData({ email: "", full_name: "", role: "user" });
      loadUsers();
    } catch (error: any) {
      console.error("❌ [USUÁRIOS] Erro completo:", error);
      console.error("❌ [USUÁRIOS] Detalhes:", JSON.stringify(error, null, 2));
      
      let errorMessage = "Não foi possível criar o usuário.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.error) {
        errorMessage = error.error;
      }
      
      // Mensagens de erro mais específicas
      if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('already') || 
          errorMessage.toLowerCase().includes('já está') || 
          errorMessage.toLowerCase().includes('duplicate')) {
        errorMessage = `O e-mail ${formData.email} já está cadastrado no sistema.`;
      } else if (errorMessage.toLowerCase().includes('unauthorized') || 
                 errorMessage.toLowerCase().includes('permissão')) {
        errorMessage = "Você não tem permissão para criar usuários nesta empresa.";
      } else if (errorMessage.toLowerCase().includes('sessão') || 
                 errorMessage.toLowerCase().includes('session')) {
        errorMessage = "Sua sessão expirou. Por favor, faça login novamente.";
      }
      
      toast({
        title: "Erro ao adicionar usuário",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleRemoveUser = async (userRoleId: string) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", userRoleId);

      if (error) throw error;

      toast({
        title: "Usuário removido",
        description: "O usuário foi removido da empresa.",
      });

      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao remover usuário",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRoleBadge = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      company_admin: "Administrador",
      gestor: "Gestor",
      vendedor: "Vendedor",
      suporte: "Suporte",
      user: "Usuário",
    };

    return <Badge>{labels[role] || role}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Usuários - {company.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Usuário
            </Button>
          ) : (
            <form onSubmit={handleAddUser} className="space-y-4 rounded-md border p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nome Completo *</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Perfil</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_admin">Administrador</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="vendedor">Vendedor</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Adicionar</Button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum usuário cadastrado nesta empresa
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.profiles?.full_name || "-"}</TableCell>
                    <TableCell>{user.profiles?.email || "-"}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(user.id)}
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
