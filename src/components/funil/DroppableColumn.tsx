import { useDroppable } from "@dnd-kit/core";
import { ReactNode } from "react";

interface DroppableColumnProps {
  id: string;
  children: ReactNode;
  cor: string;
  nome: string;
  quantidadeLeads: number;
  totalEtapa: number;
}

export function DroppableColumn({ id, children, cor, nome, quantidadeLeads, totalEtapa }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'etapa',
      etapaId: id
    }
  });

  return (
    <div>
      <div className="text-white p-3 rounded-t-lg" style={{ backgroundColor: cor }}>
        <h3 className="font-semibold">{nome}</h3>
        <div className="text-sm mt-1">
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
