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
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .eq("company_id", company.id);

      if (error) throw error;

      const usersWithProfiles = await Promise.all(
        (userRoles || []).map(async (role) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", role.user_id)
            .single();
          
          return {
            ...role,
            profiles: profile || { full_name: "", email: "" }
          };
        })
      );

      setUsers(usersWithProfiles as any);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Create auth user with signup
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: Math.random().toString(36).slice(-8) + "Aa1!", // Generate temporary password
        options: {
          data: {
            full_name: formData.full_name,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert([
          {
            user_id: authData.user.id,
            company_id: company.id,
            role: formData.role as any,
          },
        ]);

      if (roleError) throw roleError;

      toast({
        title: "Usuário adicionado",
        description: "O usuário foi adicionado com sucesso. Um e-mail de confirmação foi enviado.",
      });

      setShowAddForm(false);
      setFormData({ email: "", full_name: "", role: "user" });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar usuário",
        description: error.message,
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
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{(user.profiles as any)?.full_name || "-"}</TableCell>
                    <TableCell>{(user.profiles as any)?.email || "-"}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(user.id)}
                        title="Remover"
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
