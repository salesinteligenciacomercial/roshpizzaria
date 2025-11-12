import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FilaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fila?: any;
  onSuccess?: () => void;
}

export function FilaDialog({ open, onOpenChange, fila, onSuccess }: FilaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    ativa: true,
    prioridade: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (fila) {
        // Modo edição
        setFormData({
          nome: fila.nome || "",
          descricao: fila.descricao || "",
          ativa: fila.ativa !== false,
          prioridade: fila.prioridade || 0,
        });
      } else {
        // Modo criação
        setFormData({
          nome: "",
          descricao: "",
          ativa: true,
          prioridade: 0,
        });
      }
    }
  }, [open, fila]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "O nome da fila é obrigatório",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do usuário (pode ter múltiplas empresas)
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", user.id);

      if (rolesError) throw rolesError;

      // Usar a primeira empresa encontrada (ou a empresa da fila sendo editada)
      const companyId = fila?.company_id || userRoles?.[0]?.company_id;

      if (fila) {
        // Atualizar fila existente
        const updateData: any = {
          nome: formData.nome.trim(),
          descricao: formData.descricao.trim() || null,
          ativa: formData.ativa,
          prioridade: parseInt(String(formData.prioridade)) || 0,
        };

        const { error } = await supabase
          .from("filas_atendimento")
          .update(updateData)
          .eq("id", fila.id);

        if (error) throw error;

        toast({
          title: "Fila atualizada",
          description: "A fila foi atualizada com sucesso.",
        });
      } else {
        // Criar nova fila - verificar qual estrutura usar
        const insertData: any = {
          nome: formData.nome.trim(),
          descricao: formData.descricao.trim() || null,
          ativa: formData.ativa,
          prioridade: parseInt(String(formData.prioridade)) || 0,
        };

        // Tentar usar company_id primeiro, se não funcionar, usar owner_id
        if (companyId) {
          insertData.company_id = companyId;
        } else {
          insertData.owner_id = user.id;
        }

        const { error } = await supabase
          .from("filas_atendimento")
          .insert(insertData);

        if (error) {
          // Se falhar com company_id, tentar com owner_id
          if (error.message?.includes('company_id')) {
            delete insertData.company_id;
            insertData.owner_id = user.id;
            
            const retryResult = await supabase
              .from("filas_atendimento")
              .insert(insertData);
            
            if (retryResult.error) throw retryResult.error;
          } else {
            throw error;
          }
        }

        toast({
          title: "Fila criada",
          description: "A fila foi criada com sucesso.",
        });
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("Erro ao salvar fila:", error?.message || error);
      console.error("Detalhes do erro:", JSON.stringify(error, null, 2));
      
      // Mensagem de erro mais específica
      let errorMessage = "Ocorreu um erro ao salvar a fila.";
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Erro ${error.code}: ${error.message || "Erro desconhecido"}`;
      }
      
      toast({
        variant: "destructive",
        title: "Erro ao salvar fila",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{fila ? "Editar Fila" : "Nova Fila"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Fila *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Atendimento Geral, Suporte Técnico"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o propósito desta fila"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prioridade">Prioridade</Label>
              <Input
                id="prioridade"
                type="number"
                min="0"
                value={formData.prioridade}
                onChange={(e) =>
                  setFormData({ ...formData, prioridade: parseInt(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Menor número = maior prioridade
              </p>
            </div>

            <div className="space-y-2 flex flex-col justify-end">
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativa"
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })}
                />
                <Label htmlFor="ativa" className="cursor-pointer">
                  Fila ativa
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : fila ? "Atualizar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
