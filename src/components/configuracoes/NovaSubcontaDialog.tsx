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

      const { error } = await supabase
        .from("companies")
        .insert([companyData]);

      if (error) throw error;

      toast({
        title: "Subconta criada",
        description: "A subconta foi criada com sucesso.",
      });

      onSuccess();
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
    } catch (error: any) {
      toast({
        title: "Erro ao criar subconta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Subconta</DialogTitle>
        </DialogHeader>
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
                  <Label htmlFor="email">E-mail *</Label>
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
                <Label htmlFor="responsavel">Responsável *</Label>
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
                <li>• E-mail: teste@ceusia.app</li>
                <li>• Plano: Premium</li>
                <li>• Limite de Usuários: 50</li>
                <li>• Limite de Leads: 10.000</li>
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Subconta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
