import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Key, Mail, User, Eye, EyeOff, RefreshCw, Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Company {
  id: string;
  name: string;
}

interface AdminUser {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

interface CredenciaisSubcontaDialogProps {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CredenciaisSubcontaDialog({ company, open, onOpenChange }: CredenciaisSubcontaDialogProps) {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<{ userId: string; password: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadAdminUsers();
      setGeneratedPassword(null);
      setNewPassword("");
    }
  }, [open, company.id]);

  const loadAdminUsers = async () => {
    try {
      setLoading(true);

      // Buscar usuários admin da subconta
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("company_id", company.id)
        .in("role", ["company_admin", "super_admin", "gestor"]);

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) {
        setAdminUsers([]);
        return;
      }

      // Buscar dados dos profiles
      const userIds = userRoles.map((ur) => ur.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (profilesError) {
        console.warn("Erro ao buscar profiles:", profilesError);
      }

      // Se não encontrou profiles, buscar via edge function
      let allProfiles = profiles || [];
      const missingIds = userIds.filter((id) => !allProfiles.find((p) => p.id === id));

      if (missingIds.length > 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const response = await fetch(`${supabaseUrl}/functions/v1/buscar-dados-usuarios`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
              },
              body: JSON.stringify({ userIds: missingIds }),
            });

            const result = await response.json();
            if (result.success && result.users) {
              result.users.forEach((u: any) => {
                allProfiles.push({ id: u.id, full_name: u.full_name, email: u.email });
              });
            }
          }
        } catch (e) {
          console.error("Erro ao buscar dados via edge function:", e);
        }
      }

      // Combinar dados
      const combined = userRoles.map((ur) => {
        const profile = allProfiles.find((p) => p.id === ur.user_id);
        return {
          user_id: ur.user_id,
          role: ur.role,
          full_name: profile?.full_name || null,
          email: profile?.email || null,
        };
      });

      setAdminUsers(combined);
    } catch (error: any) {
      console.error("Erro ao carregar admins:", error);
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$!";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: "Senha inválida",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }

    setResettingPassword(userId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/editar-usuario`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
        },
        body: JSON.stringify({
          userId,
          companyId: company.id,
          password: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao redefinir senha");
      }

      // Salvar senha gerada para exibição
      setGeneratedPassword({ userId, password: newPassword });

      toast({
        title: "Senha redefinida!",
        description: "A nova senha foi configurada com sucesso.",
      });

      setNewPassword("");
    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResettingPassword(null);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const getRoleBadge = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      company_admin: "Administrador",
      gestor: "Gestor",
    };
    return <Badge variant="secondary">{labels[role] || role}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Credenciais - {company.name}
          </DialogTitle>
          <DialogDescription>
            Visualize os emails e redefina senhas dos usuários administradores desta subconta.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            <strong>Importante:</strong> Por segurança, as senhas são criptografadas e não podem ser visualizadas.
            Você pode apenas redefinir a senha para uma nova.
          </AlertDescription>
        </Alert>

        {/* Senha gerada com sucesso */}
        {generatedPassword && (
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Nova senha definida!
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setGeneratedPassword(null)}>
                ✕
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium w-16">Senha:</span>
              <code className="flex-1 px-2 py-1 bg-background rounded border font-mono">
                {generatedPassword.password}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(generatedPassword.password, "Senha")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 Anote ou envie esta senha para o usuário. Ela não poderá ser visualizada novamente.
            </p>
          </div>
        )}

        <div className="space-y-4 mt-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum usuário administrador encontrado nesta subconta.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {adminUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{user.full_name || "Sem nome"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span>{user.email || "Email não disponível"}</span>
                          {user.email && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(user.email!, "Email")}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {getRoleBadge(user.role)}
                  </div>

                  <div className="border-t pt-3">
                    <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                      <Key className="h-4 w-4" />
                      Redefinir Senha
                    </Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Nova senha (mín. 6 caracteres)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          minLength={6}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-8 top-0 h-full"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={generateRandomPassword}
                        title="Gerar senha aleatória"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        onClick={() => handleResetPassword(user.user_id)}
                        disabled={resettingPassword === user.user_id || !newPassword || newPassword.length < 6}
                      >
                        {resettingPassword === user.user_id ? "Salvando..." : "Salvar"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
