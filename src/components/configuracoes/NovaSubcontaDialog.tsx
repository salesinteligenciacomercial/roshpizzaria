import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface NovaSubcontaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function NovaSubcontaDialog({ open, onOpenChange, onSuccess }: NovaSubcontaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    cnpj: "",
    email: "",
    telefone: "",
    responsavel: "",
    plan: "basic",
    max_users: 5,
    max_leads: 1000,
  });
  const [isTestAccount, setIsTestAccount] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    url: "",
    companyName: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const companyData = {
        name: isTestAccount ? "Empresa Teste CEUSIA" : formData.name,
        cnpj: isTestAccount ? "00.000.000/0001-00" : formData.cnpj,
        plan: isTestAccount ? "premium" : formData.plan,
        status: "active",
        max_users: isTestAccount ? 50 : formData.max_users,
        max_leads: isTestAccount ? 10000 : formData.max_leads,
        settings: {
          email: isTestAccount ? "teste@ceusia.app" : formData.email,
          telefone: isTestAccount ? "(00) 0000-0000" : formData.telefone,
          responsavel: isTestAccount ? "Administrador Teste" : formData.responsavel,
        },
      };

      console.log("Criando subconta:", companyData);

      // 1. Criar a empresa
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert([companyData])
        .select()
        .single();

      if (companyError) {
        console.error("Erro ao criar subconta:", companyError);
        throw companyError;
      }

      console.log("Subconta criada:", company);

      // 2. Gerar senha automática forte
      const generatedPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10).toUpperCase() + "!@#123";
      const adminEmail = isTestAccount ? "admin@ceusia.app" : formData.email;

      // 3. Criar usuário administrador
      console.log("Criando usuário admin:", adminEmail);
      
      const { data: authUser, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: generatedPassword,
        options: {
          data: {
            full_name: isTestAccount ? "Administrador Teste" : formData.responsavel,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (authError) {
        console.error("Erro ao criar usuário:", authError);
        // Remover empresa se falhar
        await supabase.from("companies").delete().eq("id", company.id);
        throw authError;
      }

      console.log("Usuário criado:", authUser);

      // 4. Vincular usuário à empresa como company_admin
      if (authUser.user) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert([
            {
              user_id: authUser.user.id,
              company_id: company.id,
              role: "company_admin",
            },
          ]);

        if (roleError) {
          console.error("Erro ao criar role:", roleError);
          throw roleError;
        }
      }

      // 5. Preparar credenciais de acesso
      const accessUrl = window.location.origin;
      
      setCredentials({
        email: adminEmail,
        password: generatedPassword,
        url: accessUrl,
        companyName: companyData.name,
      });

      setShowCredentials(true);

      toast({
        title: "Subconta criada com sucesso! ✅",
        description: `${companyData.name} foi criada. Copie as credenciais de acesso!`,
      });

      onSuccess();
    } catch (error: any) {
      console.error("Erro completo:", error);
      toast({
        title: "Erro ao criar subconta",
        description: error.message || "Ocorreu um erro desconhecido. Verifique o console.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowCredentials(false);
    setCredentials({ email: "", password: "", url: "", companyName: "" });
    onOpenChange(false);
    setFormData({
      name: "",
      cnpj: "",
      email: "",
      telefone: "",
      responsavel: "",
      plan: "basic",
      max_users: 5,
      max_leads: 1000,
    });
    setIsTestAccount(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: `${label} copiado para a área de transferência.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showCredentials ? "Credenciais de Acesso" : "Nova Subconta"}
          </DialogTitle>
        </DialogHeader>

        {showCredentials ? (
          <div className="space-y-4">
            <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
                <span className="text-xl">✅</span>
                Subconta "{credentials.companyName}" criada com sucesso!
              </h3>
              <p className="text-sm text-green-800 dark:text-green-200">
                Copie e guarde as credenciais de acesso abaixo. Esta é a única vez que a senha será exibida!
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">URL de Acesso</Label>
                <div className="flex gap-2">
                  <Input value={credentials.url} readOnly className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(credentials.url, "URL")}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">E-mail</Label>
                <div className="flex gap-2">
                  <Input value={credentials.email} readOnly className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(credentials.email, "E-mail")}
                  >
                    Copiar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Senha</Label>
                <div className="flex gap-2">
                  <Input value={credentials.password} readOnly className="font-mono text-sm" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(credentials.password, "Senha")}
                  >
                    Copiar
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                ⚠️ <strong>Importante:</strong> Guarde estas credenciais em local seguro. A senha não poderá ser recuperada depois!
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="test"
                checked={isTestAccount}
                onCheckedChange={(checked) => setIsTestAccount(checked as boolean)}
              />
              <Label htmlFor="test">Marcar como Subconta de Teste</Label>
            </div>

            {!isTestAccount && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Empresa *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formData.cnpj}
                      onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail do Administrador *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone *</Label>
                    <Input
                      id="telefone"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="responsavel">Nome do Responsável *</Label>
                  <Input
                    id="responsavel"
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plan">Plano</Label>
                    <Select
                      value={formData.plan}
                      onValueChange={(value) => setFormData({ ...formData, plan: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="basic">Padrão</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_users">Limite de Usuários</Label>
                    <Input
                      id="max_users"
                      type="number"
                      value={formData.max_users}
                      onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_leads">Limite de Leads</Label>
                    <Input
                      id="max_leads"
                      type="number"
                      value={formData.max_leads}
                      onChange={(e) => setFormData({ ...formData, max_leads: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </>
            )}

            {isTestAccount && (
              <div className="rounded-md bg-muted p-4">
                <p className="text-sm text-muted-foreground">
                  Será criada uma subconta de teste com as seguintes configurações:
                </p>
                <ul className="mt-2 text-sm space-y-1">
                  <li>• Nome: Empresa Teste CEUSIA</li>
                  <li>• E-mail Admin: admin@ceusia.app</li>
                  <li>• Plano: Premium</li>
                  <li>• Limite de Usuários: 50</li>
                  <li>• Limite de Leads: 10.000</li>
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Criando..." : "Criar Subconta"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
