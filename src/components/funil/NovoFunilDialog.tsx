import { useState } from "react";
import { Plus, X, GripVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NovoFunilDialogProps {
  onFunilCreated: () => void;
}

interface Etapa {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  status?: 'normal' | 'final';
}

const CORES_PADRAO = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
];

export function NovoFunilDialog({ onFunilCreated }: NovoFunilDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nomeFunil, setNomeFunil] = useState("");
  const [etapas, setEtapas] = useState<Etapa[]>([
    { id: "1", nome: "Novo Lead", posicao: 0, cor: "#ef4444", status: 'normal' },
    { id: "2", nome: "Contato Realizado", posicao: 1, cor: "#f97316", status: 'normal' },
    { id: "3", nome: "Proposta Enviada", posicao: 2, cor: "#eab308", status: 'normal' },
    { id: "4", nome: "Negociação", posicao: 3, cor: "#3b82f6", status: 'normal' },
    { id: "5", nome: "Ganho", posicao: 99, cor: "#22c55e", status: 'final' },
    { id: "6", nome: "Perdido", posicao: 100, cor: "#ef4444", status: 'final' },
  ]);

  const adicionarEtapa = () => {
    // Encontra a última posição antes das etapas finais
    const ultimaPosicao = Math.max(...etapas
      .filter(e => e.status !== 'final')
      .map(e => e.posicao), -1);

    const novaEtapa: Etapa = {
      id: Date.now().toString(),
      nome: `Etapa ${etapas.length - 1}`,
      posicao: ultimaPosicao + 1,
      cor: CORES_PADRAO[etapas.length % CORES_PADRAO.length],
      status: 'normal'
    };

    // Insere a nova etapa antes das etapas finais
    const novasEtapas = [
      ...etapas.filter(e => e.status !== 'final'),
      novaEtapa,
      ...etapas.filter(e => e.status === 'final')
    ];

    setEtapas(novasEtapas);
  };

  const removerEtapa = (id: string) => {
    const etapa = etapas.find(e => e.id === id);
    
    if (!etapa) return;

    if (etapa.status === 'final') {
      toast.error("Não é possível remover as etapas Ganho e Perdido");
      return;
    }

    const etapasNormais = etapas.filter(e => e.status !== 'final');
    if (etapasNormais.length <= 1) {
      toast.error("O funil precisa ter pelo menos uma etapa além de Ganho e Perdido");
      return;
    }

    setEtapas([
      ...etapas.filter(e => e.id !== id && e.status !== 'final'),
      ...etapas.filter(e => e.status === 'final')
    ]);
  };

  const atualizarNomeEtapa = (id: string, novoNome: string) => {
    setEtapas(etapas.map(e => e.id === id ? { ...e, nome: novoNome } : e));
  };

  const atualizarCorEtapa = (id: string, novaCor: string) => {
    setEtapas(etapas.map(e => e.id === id ? { ...e, cor: novaCor } : e));
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
        return;
      }

      // Criar funil
      const funilResponse = await supabase.functions.invoke("api-funil-vendas", {
        body: {
          action: "criar_funil",
          data: { nome: nomeFunil }
        }
      });

      if (funilResponse.error || !funilResponse.data?.data?.id) {
        throw new Error("Erro ao criar funil");
      }

      const funilId = funilResponse.data.data.id;

      // Criar etapas
      for (let i = 0; i < etapas.length; i++) {
        const etapa = etapas[i];
        await supabase.functions.invoke("api-funil-vendas", {
          body: {
            action: "criar_etapa",
            data: {
              nome: etapa.nome,
              funil_id: funilId,
              posicao: i,
              cor: etapa.cor
            }
          }
        });
      }

      toast.success("Funil criado com sucesso!");
      setNomeFunil("");
      setEtapas([
        { id: "1", nome: "Novo Lead", posicao: 0, cor: "#ef4444", status: 'normal' },
        { id: "2", nome: "Contato Realizado", posicao: 1, cor: "#f97316", status: 'normal' },
        { id: "3", nome: "Proposta Enviada", posicao: 2, cor: "#eab308", status: 'normal' },
        { id: "4", nome: "Negociação", posicao: 3, cor: "#3b82f6", status: 'normal' },
        { id: "5", nome: "Ganho", posicao: 99, cor: "#22c55e", status: 'final' },
        { id: "6", nome: "Perdido", posicao: 100, cor: "#ef4444", status: 'final' },
      ]);
      setOpen(false);
      onFunilCreated();
    } catch (error) {
      console.error("Erro ao criar funil:", error);
      toast.error("Erro ao criar funil. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Novo Funil
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Funil de Vendas</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="nomeFunil">Nome do Funil *</Label>
            <Input
              id="nomeFunil"
              value={nomeFunil}
              onChange={(e) => setNomeFunil(e.target.value)}
              placeholder="Ex: Vendas Produto X, Prospecção Q1 2024"
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
                      onClick={() => removerEtapa(etapa.id)}
                      disabled={etapas.length <= 1}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              💡 Dica: Arraste as etapas para reordenar (em breve). Escolha cores diferentes para cada etapa.
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t">
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
              {loading ? "Criando..." : "Criar Funil com Etapas"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
