import { useState, useEffect } from "react";
import { Plus, X, GripVertical, Pencil, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditarFunilDialogProps {
  funilId: string;
  funilNome: string;
  onFunilUpdated: () => void;
}

interface Etapa {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  funil_id: string;
}

const CORES_PADRAO = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899",
];

export function EditarFunilDialog({ funilId, funilNome, onFunilUpdated }: EditarFunilDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nomeFunil, setNomeFunil] = useState(funilNome);
  const [etapas, setEtapas] = useState<Etapa[]>([]);

  useEffect(() => {
    if (open) {
      carregarEtapas();
    }
  }, [open, funilId]);

  const carregarEtapas = async () => {
    const { data, error } = await supabase
      .from("etapas")
      .select("*")
      .eq("funil_id", funilId)
      .order("posicao");
    
    if (error) {
      toast.error("Erro ao carregar etapas");
      return;
    }
    
    setEtapas(data || []);
  };

  const adicionarEtapa = () => {
    const novaEtapa: Etapa = {
      id: `temp-${Date.now()}`,
      nome: `Etapa ${etapas.length + 1}`,
      posicao: etapas.length,
      cor: CORES_PADRAO[etapas.length % CORES_PADRAO.length],
      funil_id: funilId,
    };
    setEtapas([...etapas, novaEtapa]);
  };

  const removerEtapa = async (etapa: Etapa) => {
    if (etapas.length <= 1) {
      toast.error("O funil precisa ter pelo menos uma etapa");
      return;
    }

    if (!etapa.id.startsWith("temp-")) {
      // Etapa existente - deletar do banco
      const { error } = await supabase
        .from("etapas")
        .delete()
        .eq("id", etapa.id);
      
      if (error) {
        toast.error("Erro ao remover etapa");
        return;
      }
    }
    
    setEtapas(etapas.filter(e => e.id !== etapa.id));
  };

  const atualizarNomeEtapa = (id: string, novoNome: string) => {
    setEtapas(etapas.map(e => e.id === id ? { ...e, nome: novoNome } : e));
  };

  const atualizarCorEtapa = (id: string, novaCor: string) => {
    setEtapas(etapas.map(e => e.id === id ? { ...e, cor: novaCor } : e));
  };

  const excluirFunil = async () => {
    if (!confirm("Tem certeza que deseja excluir este funil? Todas as etapas e leads associados serão perdidos!")) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("funis")
        .delete()
        .eq("id", funilId);

      if (error) throw error;

      toast.success("Funil excluído com sucesso!");
      setOpen(false);
      onFunilUpdated();
    } catch (error) {
      console.error("Erro ao excluir funil:", error);
      toast.error("Erro ao excluir funil");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomeFunil.trim()) {
      toast.error("Digite o nome do funil");
      return;
    }

    if (etapas.length === 0) {
      toast.error("Adicione pelo menos uma etapa");
      return;
    }

    const etapasInvalidas = etapas.filter(e => !e.nome.trim());
    if (etapasInvalidas.length > 0) {
      toast.error("Todas as etapas precisam ter um nome");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Não autenticado");
        setLoading(false);
        return;
      }

      console.log("=== ATUALIZANDO FUNIL ===");
      console.log("Funil ID:", funilId);
      console.log("Novo nome:", nomeFunil);
      console.log("Etapas a processar:", etapas);

      // Atualizar nome do funil
      const { error: funilError } = await supabase
        .from("funis")
        .update({ nome: nomeFunil })
        .eq("id", funilId);

      if (funilError) {
        console.error("❌ Erro ao atualizar nome do funil:", funilError);
        throw funilError;
      }

      console.log("✅ Nome do funil atualizado");

      // Processar etapas
      for (let i = 0; i < etapas.length; i++) {
        const etapa = etapas[i];
        
        if (etapa.id.startsWith("temp-")) {
          console.log(`➕ Criando nova etapa: "${etapa.nome}"`);
          
          // Nova etapa - criar diretamente
          const { data, error: etapaError } = await supabase
            .from("etapas")
            .insert({
              nome: etapa.nome,
              funil_id: funilId,
              posicao: i,
              cor: etapa.cor
            })
            .select();
          
          if (etapaError) {
            console.error("❌ Erro ao criar etapa:", {
              erro: etapaError,
              etapa: {
                nome: etapa.nome,
                funil_id: funilId,
                posicao: i,
                cor: etapa.cor
              }
            });
            toast.error(`Erro ao criar etapa "${etapa.nome}": ${etapaError.message}`);
            throw etapaError;
          }
          
          console.log(`✅ Etapa "${etapa.nome}" criada:`, data);
        } else {
          console.log(`🔄 Atualizando etapa existente: "${etapa.nome}"`);
          
          // Etapa existente - atualizar
          const { error } = await supabase
            .from("etapas")
            .update({
              nome: etapa.nome,
              posicao: i,
              cor: etapa.cor
            })
            .eq("id", etapa.id);
          
          if (error) {
            console.error("❌ Erro ao atualizar etapa:", error);
            throw error;
          }
          
          console.log(`✅ Etapa "${etapa.nome}" atualizada`);
        }
      }

      console.log("✅ Funil completo atualizado com sucesso!");
      toast.success("Funil atualizado com sucesso!");
      setOpen(false);
      onFunilUpdated();
    } catch (error: any) {
      console.error("❌ Erro ao atualizar funil:", error);
      toast.error(`Erro ao atualizar funil: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Funil de Vendas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="nomeFunil">Nome do Funil *</Label>
            <Input
              id="nomeFunil"
              value={nomeFunil}
              onChange={(e) => setNomeFunil(e.target.value)}
              placeholder="Ex: Vendas Produto X"
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Etapas do Funil *</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={adicionarEtapa}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Etapa
              </Button>
            </div>

            <div className="space-y-3">
              {etapas.map((etapa, index) => (
                <div 
                  key={etapa.id} 
                  className="flex items-center gap-2 p-3 border rounded-lg bg-secondary/20"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GripVertical className="h-4 w-4" />
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>

                  <Input
                    value={etapa.nome}
                    onChange={(e) => atualizarNomeEtapa(etapa.id, e.target.value)}
                    placeholder="Nome da etapa"
                    className="flex-1"
                  />

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="color"
                        value={etapa.cor}
                        onChange={(e) => atualizarCorEtapa(etapa.id, e.target.value)}
                        className="w-10 h-10 rounded cursor-pointer border"
                        title="Escolher cor"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removerEtapa(etapa)}
                      disabled={etapas.length <= 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button 
              type="button" 
              variant="destructive" 
              onClick={excluirFunil}
              disabled={loading}
              className="flex-1"
            >
              Excluir Funil
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)} 
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex-1"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
