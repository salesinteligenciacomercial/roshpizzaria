import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2 } from "lucide-react";

interface NovaSubcontaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NovaSubcontaDialog({ open, onOpenChange, onSuccess }: NovaSubcontaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [credenciaisCriadas, setCredenciaisCriadas] = useState<{email: string, senha: string} | null>(null);
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
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCredenciaisCriadas(null);

    try {
      // Buscar company_id do usuário logado (conta mestre)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole) throw new Error('Empresa não encontrada');

      console.log('📤 [NOVA-SUBCONTA] Enviando dados:', {
        parentCompanyId: userRole.company_id,
        companyName: formData.name,
        email: formData.email
      });

      // Criar subconta usando edge function
      const { data, error } = await supabase.functions.invoke('criar-usuario-subconta', {
        body: {
          parentCompanyId: userRole.company_id,
          companyName: formData.name,
          cnpj: formData.cnpj,
          email: formData.email,
          full_name: formData.responsavel, // Nome completo do administrador
          telefone: formData.telefone,
          responsavel: formData.responsavel,
          plan: formData.plan,
          max_users: formData.max_users,
          max_leads: formData.max_leads,
        },
      });

      console.log('📥 [NOVA-SUBCONTA] Resposta:', { data, error });

      if (error) {
        console.error('❌ [NOVA-SUBCONTA] Erro da função:', error);
        
        // Verificar se é erro de email duplicado
        const errorMsg = typeof error === 'string' ? error : error.message;
        if (errorMsg?.includes('EMAIL_JA_CADASTRADO') || errorMsg?.includes('já está cadastrado')) {
          throw new Error(`⚠️ O email ${formData.email} já está cadastrado no sistema. Use outro email ou remova o usuário existente.`);
        }
        
        throw new Error(errorMsg || 'Erro ao criar subconta');
      }

      // Armazenar credenciais para exibição
      if (data?.credentials) {
        setCredenciaisCriadas(data.credentials);
      }

      toast({
        title: "Subconta criada com sucesso!",
        description: `Licença criada para ${formData.name}`,
      });

      // Limpar formulário
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

      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error('❌ [NOVA-SUBCONTA] Erro completo:', error);
      toast({
        title: "Erro ao criar subconta",
        description: error.message || 'Erro desconhecido ao criar subconta',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fecharDialog = () => {
    setCredenciaisCriadas(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={fecharDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Subconta / Licença SaaS</DialogTitle>
          <DialogDescription>
            Crie uma nova licença de CRM para seu cliente
          </DialogDescription>
        </DialogHeader>

        {credenciaisCriadas ? (
          <div className="space-y-4">
            <Alert className="border-green-500 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="space-y-2">
                <p className="font-semibold">Subconta criada com sucesso!</p>
                <p className="text-sm">As credenciais foram enviadas por email e WhatsApp para o cliente.</p>
              </AlertDescription>
            </Alert>

            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <h4 className="font-semibold">Credenciais de Acesso:</h4>
              <div className="space-y-2 text-sm">
                <div>
                  <strong>Email:</strong> {credenciaisCriadas.email}
                </div>
                <div>
                  <strong>Senha:</strong> 
                  <code className="ml-2 px-2 py-1 bg-background rounded font-mono">
                    {credenciaisCriadas.senha}
                  </code>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Guarde essas credenciais em local seguro. O cliente pode redefinir a senha pelo email.
              </p>
            </div>

            <Button onClick={fecharDialog} className="w-full">
              Concluir
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Empresa ABC Ltda"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsavel">Responsável / Administrador *</Label>
              <Input
                id="responsavel"
                placeholder="Nome completo do responsável"
                value={formData.responsavel}
                onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@empresa.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">WhatsApp *</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  required
                />
              </div>
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
                    <SelectItem value="free">Free (Teste)</SelectItem>
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
                  min="1"
                  max="100"
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_leads">Limite de Leads</Label>
                <Input
                  id="max_leads"
                  type="number"
                  min="100"
                  max="50000"
                  step="100"
                  value={formData.max_leads}
                  onChange={(e) => setFormData({ ...formData, max_leads: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                ℹ️ Após criar a subconta, as credenciais de acesso serão enviadas automaticamente 
                por email e WhatsApp para o responsável.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
