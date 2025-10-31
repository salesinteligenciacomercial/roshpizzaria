import { useDroppable } from "@dnd-kit/core";
import { ReactNode, useState, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, TrendingUp, Clock, DollarSign } from "lucide-react";
import { EditarEtapaDialog } from "./EditarEtapaDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DroppableColumnProps {
  id: string;
  children: ReactNode;
  cor: string;
  nome: string;
  quantidadeLeads: number;
  totalEtapa: number;
  onEtapaUpdated: () => void;
  isDraggingOver?: boolean;
  // 🎯 Métricas avançadas opcionais
  valorMedio?: number;
  taxaConversao?: number;
  tempoMedio?: number;
}

export const DroppableColumn = memo(function DroppableColumn({
  id,
  children,
  cor,
  nome,
  quantidadeLeads,
  totalEtapa,
  onEtapaUpdated,
  isDraggingOver = false,
  valorMedio = 0,
  taxaConversao = 0,
  tempoMedio = 0
}: DroppableColumnProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'etapa',
      etapaId: id
    }
  });

  const handleDeleteClick = useCallback(() => {
    if (quantidadeLeads > 0) {
      toast.error("Não é possível deletar etapa com leads. Mova os leads primeiro.");
      return;
    }
    setShowDeleteDialog(true);
  }, [quantidadeLeads]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("etapas").delete().eq("id", id);
      if (error) throw error;

      toast.success(`Etapa "${nome}" deletada com sucesso!`);
      setShowDeleteDialog(false);
      onEtapaUpdated();
    } catch (error: any) {
      console.error("Erro ao deletar etapa:", error);
      toast.error(error.message || "Erro ao deletar etapa");
    } finally {
      setIsDeleting(false);
    }
  }, [id, nome, onEtapaUpdated]);

  return (
    <>
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
                onClick={handleDeleteClick}
                title={quantidadeLeads > 0 ? "Mova os leads antes de deletar" : "Deletar Etapa"}
                disabled={isDeleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span>{quantidadeLeads} lead{quantidadeLeads !== 1 ? 's' : ''}</span>
              {taxaConversao > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-xs">
                        <TrendingUp className="h-3 w-3" />
                        <span>{taxaConversao.toFixed(1)}%</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Taxa de conversão para próxima etapa</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="font-bold flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              R$ {totalEtapa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {valorMedio > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-xs opacity-90">
                      Média: R$ {valorMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Valor médio por lead nesta etapa</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {tempoMedio > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-xs opacity-90">
                      <Clock className="h-3 w-3" />
                      <span>{tempoMedio.toFixed(0)} dias</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Tempo médio nesta etapa</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        <div
          ref={setNodeRef}
          className={`bg-secondary/20 p-4 rounded-b-lg min-h-[500px] transition-all duration-300 ease-out relative ${
            isOver || isDraggingOver 
              ? 'bg-gradient-to-b from-primary/10 to-primary/5 border-2 border-primary border-dashed shadow-xl scale-[1.02] ring-2 ring-primary/20' 
              : 'border-2 border-transparent'
          }`}
        >
          {/* 🎯 Indicador visual de drop zone ativo */}
          {(isOver || isDraggingOver) && (
            <div className="absolute inset-0 pointer-events-none rounded-b-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 animate-pulse" />
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary/40 text-center">
                <div className="text-4xl mb-2">↓</div>
                <div className="text-sm font-semibold">Solte aqui</div>
              </div>
            </div>
          )}
          {children}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão da etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a etapa <strong>"{nome}"</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}, (prevProps, nextProps) => {
  // 🎯 Otimização: comparação customizada para evitar re-renders desnecessários
  return (
    prevProps.id === nextProps.id &&
    prevProps.cor === nextProps.cor &&
    prevProps.nome === nextProps.nome &&
    prevProps.quantidadeLeads === nextProps.quantidadeLeads &&
    prevProps.totalEtapa === nextProps.totalEtapa &&
    prevProps.isDraggingOver === nextProps.isDraggingOver &&
    prevProps.children === nextProps.children
  );
});