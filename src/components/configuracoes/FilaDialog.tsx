import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface FilaData {
  id?: string;
  nome: string;
  descricao?: string;
  ativa?: boolean;
  prioridade?: number;
}

interface FilaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: FilaData | null;
  onSaved?: () => void;
}

export function FilaDialog({ open, onOpenChange, initialData, onSaved }: FilaDialogProps) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ativa, setAtiva] = useState(true);
  const [prioridade, setPrioridade] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [hasPermission, setHasPermission] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (initialData) {
      setNome(initialData.nome || "");
      setDescricao(initialData.descricao || "");
      setAtiva(initialData.ativa ?? true);
      setPrioridade(initialData.prioridade ?? 0);
    } else {
      setNome("");
      setDescricao("");
      setAtiva(true);
      setPrioridade(0);
    }
    checkPermissions();
  }, [initialData, open]);

  const checkPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasPermission(false);
        return;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      setHasPermission(userRole?.role === 'company_admin' || userRole?.role === 'super_admin');
    } catch (error) {
      console.error('Erro ao verificar permissões:', error);
      setHasPermission(false);
    }
  };

  const validateForm = async (): Promise<string[]> => {
    const newErrors: string[] = [];

    // Validações básicas
    if (!nome.trim()) {
      newErrors.push("Nome da fila é obrigatório");
    }

    if (nome.length < 3) {
      newErrors.push("Nome deve ter pelo menos 3 caracteres");
    }

    if (prioridade < 0 || prioridade > 100) {
      newErrors.push("Prioridade deve estar entre 0 e 100");
    }

    // Verificar permissões
    if (!hasPermission) {
      newErrors.push("Você não tem permissão para criar/editar filas");
      return newErrors;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        newErrors.push("Usuário não autenticado");
        return newErrors;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) {
        newErrors.push("Empresa não encontrada");
        return newErrors;
      }

      // Verificar se nome já existe na empresa (exceto se for edição da mesma fila)
      const { data: existingFila } = await supabase
        .from('filas_atendimento')
        .select('id')
        .eq('company_id', userRole.company_id)
        .eq('nome', nome.trim())
        .neq('id', initialData?.id || '');

      if (existingFila && existingFila.length > 0) {
        newErrors.push("Já existe uma fila com este nome nesta empresa");
      }

      // Verificar se prioridade já existe na empresa (exceto se for edição da mesma fila)
      const { data: existingPrioridade } = await supabase
        .from('filas_atendimento')
        .select('id')
        .eq('company_id', userRole.company_id)
        .eq('prioridade', prioridade)
        .neq('id', initialData?.id || '');

      if (existingPrioridade && existingPrioridade.length > 0) {
        newErrors.push("Já existe uma fila com esta prioridade nesta empresa");
      }

    } catch (error) {
      console.error('Erro na validação:', error);
      newErrors.push("Erro ao validar dados");
    }

    return newErrors;
  };

  const handleSubmit = async () => {
    // Executar validações
    const validationErrors = await validateForm();
    setErrors(validationErrors);

    if (validationErrors.length > 0) {
      toast({
        title: "Erro de validação",
        description: validationErrors[0],
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!userRole?.company_id) {
        throw new Error("Empresa não encontrada");
      }

      if (initialData?.id) {
        const { error } = await supabase
          .from("filas_atendimento")
          .update({
            nome: nome.trim(),
            descricao: descricao.trim(),
            ativa,
            prioridade
          })
          .eq("id", initialData.id);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Fila atualizada com sucesso",
        });
      } else {
        const { error } = await supabase
          .from("filas_atendimento")
          .insert([{
            nome: nome.trim(),
            descricao: descricao.trim(),
            ativa,
            prioridade,
            company_id: userRole.company_id
          }]);

        if (error) throw error;

        toast({
          title: "Sucesso",
          description: "Fila criada com sucesso",
        });
      }

      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      console.error("Erro ao salvar fila:", e);
      toast({
        title: "Erro ao salvar fila",
        description: e.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData?.id ? "Editar Fila" : "Nova Fila"}</DialogTitle>
        </DialogHeader>

        {/* Alertas de erro */}
        {errors.length > 0 && (
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Alerta de permissão */}
        {!hasPermission && (
          <Alert className="border-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para criar ou editar filas. Entre em contato com o administrador.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Suporte Nível 1"
              disabled={!hasPermission}
            />
            <p className="text-xs text-muted-foreground">
              Nome único dentro da empresa
            </p>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional da fila"
              disabled={!hasPermission}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={prioridade}
                onChange={(e) => setPrioridade(Number.isNaN(parseInt(e.target.value)) ? 0 : parseInt(e.target.value))}
                disabled={!hasPermission}
              />
              <p className="text-xs text-muted-foreground">
                0-100, única por empresa
              </p>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <Switch
                checked={ativa}
                onCheckedChange={setAtiva}
                disabled={!hasPermission}
              />
              <Label>Ativa</Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !nome.trim() || !hasPermission}
          >
            {saving ? "Salvando..." : (initialData?.id ? "Salvar" : "Criar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


