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
import { Plus, Trash2, Power, Copy, Edit } from "lucide-react";

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
  const [addingUser, setAddingUser] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    password: "", // Campo para senha customizada
    role: "vendedor", // Valor padrão mudado de "user" para "vendedor" (valor válido do enum)
  });
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ email: string; senha: string } | null>(null);
  const [editingUser, setEditingUser] = useState<UserRole | null>(null);
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "",
  });
  const [updatingUser, setUpdatingUser] = useState(false);
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
      
      // Tentar buscar profiles da tabela profiles
      let profilesData: any[] = [];
      const { data: profilesFromTable, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.warn("Erro ao buscar profiles da tabela:", profilesError);
      } else {
        profilesData = profilesFromTable || [];
      }

      // Se não encontrou todos os profiles, buscar via edge function
      const missingUserIds = userIds.filter(id => !profilesData.find(p => p.id === id));
      if (missingUserIds.length > 0) {
        console.log(`Buscando ${missingUserIds.length} profiles faltantes via edge function...`);
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

            const functionUrl = `${supabaseUrl}/functions/v1/buscar-dados-usuarios`;

            const response = await fetch(functionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
                'apikey': supabaseKey || '',
              },
              body: JSON.stringify({ userIds: missingUserIds }),
            });

            const result = await response.json();

            if (result.success && result.users) {
              // Adicionar os dados encontrados
              result.users.forEach((userData: any) => {
                profilesData.push({
                  id: userData.id,
                  full_name: userData.full_name,
                  email: userData.email
                });
              });

              console.log(`✅ Buscou ${result.users.length} usuários via edge function`);
            } else {
              console.warn('Erro ao buscar dados via edge function:', result);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar dados dos usuários:', error);
        }
      }

      // Combinar dados - todos os profiles já foram buscados/criados acima
      const usersWithProfiles = userRoles.map((ur: any) => {
        const profile = profilesData.find((p: any) => p.id === ur.user_id);
        
        return {
          ...ur,
          profiles: profile || { id: ur.user_id, full_name: null, email: null },
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
    setAddingUser(true);
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
        password: formData.password || undefined, // Senha customizada (opcional)
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

      // Armazenar credenciais se fornecidas
      if (responseData?.credentials) {
        setCreatedUserCredentials({
          email: responseData.credentials.email,
          senha: responseData.credentials.senha
        });
      }

      toast({
        title: "Usuário adicionado",
        description: "Usuário criado com sucesso e vinculado à empresa.",
      });

      setShowAddForm(false);
      setFormData({ email: "", full_name: "", password: "", role: "vendedor" });
      await loadUsers();
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
      if (errorMessage.toLowerCase().includes('email') && (errorMessage.toLowerCase().includes('already') || 
          errorMessage.toLowerCase().includes('já está') || 
          errorMessage.toLowerCase().includes('duplicate'))) {
        errorMessage = `O e-mail ${formData.email} já está cadastrado no sistema.`;
      } else if (errorMessage.toLowerCase().includes('unauthorized') || 
                 errorMessage.toLowerCase().includes('permissão') ||
                 errorMessage.toLowerCase().includes('permission') ||
                 errorMessage.toLowerCase().includes('negada')) {
        errorMessage = "Você não tem permissão para criar usuários nesta empresa. Você precisa ser Super Admin ou Administrador da empresa.";
      } else if (errorMessage.toLowerCase().includes('sessão') || 
                 errorMessage.toLowerCase().includes('session') ||
                 errorMessage.toLowerCase().includes('token')) {
        errorMessage = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (errorMessage.toLowerCase().includes('configuração') ||
                 errorMessage.toLowerCase().includes('configuration')) {
        errorMessage = "Erro de configuração do servidor. Entre em contato com o suporte.";
      }
      
      toast({
        title: "Erro ao adicionar usuário",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setAddingUser(false);
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

  const handleEditUser = (user: UserRole) => {
    setEditingUser(user);
    setEditFormData({
      full_name: user.profiles?.full_name || "",
      email: user.profiles?.email || "",
      password: "",
      role: user.role || "",
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setUpdatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      // 1. Atualizar profile (nome e email)
      if (editFormData.full_name || editFormData.email) {
        const profileUpdate: any = {};
        if (editFormData.full_name) profileUpdate.full_name = editFormData.full_name;
        if (editFormData.email) profileUpdate.email = editFormData.email.toLowerCase().trim();
        profileUpdate.updated_at = new Date().toISOString();

        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            id: editingUser.user_id,
            ...profileUpdate,
          }, {
            onConflict: "id"
          });

        if (profileError) {
          console.error("Erro ao atualizar profile:", profileError);
          throw profileError;
        }
      }

      // 2. Atualizar role se mudou
      if (editFormData.role && editFormData.role !== editingUser.role) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: editFormData.role as "company_admin" | "gestor" | "super_admin" | "suporte" | "vendedor" })
          .eq("id", editingUser.id);

        if (roleError) {
          console.error("Erro ao atualizar role:", roleError);
          throw roleError;
        }
      }

      // 3. Atualizar senha se fornecida
      if (editFormData.password && editFormData.password.length >= 6) {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const functionUrl = `${supabaseUrl}/functions/v1/redefinir-senha-subconta`;

        const { error: passwordError } = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey || '',
          },
          body: JSON.stringify({
            userId: editingUser.user_id,
            novaSenha: editFormData.password,
            notificar: false,
          }),
        }).then(res => res.json());

        if (passwordError) {
          console.error("Erro ao atualizar senha:", passwordError);
          // Não bloquear se apenas a senha falhar
        }
      }

      toast({
        title: "Usuário atualizado",
        description: "As informações do usuário foram atualizadas com sucesso.",
      });

      setEditingUser(null);
      setEditFormData({ full_name: "", email: "", password: "", role: "" });
      await loadUsers();
    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message || "Não foi possível atualizar o usuário.",
        variant: "destructive",
      });
    } finally {
      setUpdatingUser(false);
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

        {/* Exibir credenciais do usuário criado */}
        {createdUserCredentials && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-700 dark:text-green-400">
                ✅ Usuário criado com sucesso!
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCreatedUserCredentials(null)}
              >
                ✕
              </Button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                <strong>Importante:</strong> Anote estas credenciais. Elas serão necessárias para o usuário fazer login no CRM.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium w-20">E-mail:</span>
                  <code className="flex-1 px-2 py-1 bg-background rounded border">{createdUserCredentials.email}</code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(createdUserCredentials.email);
                      toast({ title: "E-mail copiado!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium w-20">Senha:</span>
                  <code className="flex-1 px-2 py-1 bg-background rounded border font-mono">
                    {createdUserCredentials.senha}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(createdUserCredentials.senha);
                      toast({ title: "Senha copiada!" });
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                💡 Envie essas credenciais para o usuário por um canal seguro (email, WhatsApp, etc.)
              </p>
            </div>
          </div>
        )}

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
                <Label htmlFor="password">Senha de Acesso *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Digite a senha para o usuário"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  A senha deve ter no mínimo 6 caracteres. O usuário usará esta senha para fazer login no CRM.
                </p>
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
                    <SelectItem value="vendedor">Vendedor/Atendente</SelectItem>
                    <SelectItem value="suporte">Suporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                  disabled={addingUser}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={addingUser}>
                  {addingUser ? "Adicionando..." : "Adicionar"}
                </Button>
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
                {users.map((user: any) => {
                  // Garantir que temos os dados do profile
                  const profileName = user.profiles?.full_name || user.profiles?.fullName || null;
                  const profileEmail = user.profiles?.email || null;
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell>{profileName || "-"}</TableCell>
                      <TableCell>{profileEmail || "-"}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditUser(user)}
                          title="Editar"
                          className="text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveUser(user.id)}
                          title="Remover"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Dialog de Edição */}
        {editingUser && (
          <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Usuário</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_full_name">Nome Completo</Label>
                    <Input
                      id="edit_full_name"
                      value={editFormData.full_name}
                      onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_email">E-mail</Label>
                    <Input
                      id="edit_email"
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_password">Nova Senha (deixe em branco para não alterar)</Label>
                  <Input
                    id="edit_password"
                    type="password"
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                    placeholder="Digite a nova senha (mínimo 6 caracteres)"
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco se não quiser alterar a senha.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_role">Perfil</Label>
                  <Select
                    value={editFormData.role}
                    onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company_admin">Administrador</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="vendedor">Vendedor/Atendente</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingUser(null);
                      setEditFormData({ full_name: "", email: "", password: "", role: "" });
                    }}
                    disabled={updatingUser}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateUser} disabled={updatingUser}>
                    {updatingUser ? "Atualizando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
