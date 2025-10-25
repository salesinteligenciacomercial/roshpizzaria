import { useDroppable } from "@dnd-kit/core";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { EditarEtapaDialog } from "./EditarEtapaDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DroppableColumnProps {
  id: string;
  children: ReactNode;
  cor: string;
  nome: string;
  quantidadeLeads: number;
  totalEtapa: number;
  onEtapaUpdated: () => void;
}

export function DroppableColumn({ id, children, cor, nome, quantidadeLeads, totalEtapa, onEtapaUpdated }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'etapa',
      etapaId: id
    }
  });

  const handleDeleteEtapa = async () => {
    if (quantidadeLeads > 0) {
      toast.error("Não é possível deletar etapa com leads. Mova os leads primeiro.");
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar a etapa "${nome}"?`)) {
      return;
    }

    try {
      const { error } = await supabase.from("etapas").delete().eq("id", id);
      if (error) throw error;

      toast.success("Etapa deletada com sucesso!");
      onEtapaUpdated();
    } catch (error) {
      console.error("Erro ao deletar etapa:", error);
      toast.error("Erro ao deletar etapa");
    }
  };

  return (
    <div>
      <div className="text-white p-3 rounded-t-lg" style={{ backgroundColor: cor }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">{nome}</h3>
          <div className="flex gap-1">
            <EditarEtapaDialog 
              etapaId={id}
              nomeAtual={nome}
              corAtual={cor}
              onEtapaUpdated={onEtapaUpdated}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={handleDeleteEtapa}
              title="Deletar Etapa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="text-sm">
          <div>{quantidadeLeads} lead{quantidadeLeads !== 1 ? 's' : ''}</div>
          <div className="font-bold">
            R$ {totalEtapa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
      <div 
        ref={setNodeRef}
        className={`bg-secondary/20 p-4 rounded-b-lg min-h-[500px] transition-colors ${
          isOver ? 'bg-primary/10 border-2 border-primary border-dashed' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
}
