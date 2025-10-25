import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeletarColunaDialogProps {
  columnId: string;
  columnNome: string;
  onColumnDeleted: () => void;
}

export function DeletarColunaDialog({ 
  columnId, 
  columnNome, 
  onColumnDeleted 
}: DeletarColunaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      // Verificar se há tarefas na coluna
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("column_id", columnId);

      if (tasks && tasks.length > 0) {
        toast.error(
          `Esta coluna possui ${tasks.length} tarefa(s). Mova-as para outra coluna antes de excluir.`
        );
        setOpen(false);
        setLoading(false);
        return;
      }

      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "deletar_coluna",
          data: { column_id: columnId },
        },
      });

      toast.success(`Coluna "${columnNome}" excluída com sucesso!`);
      setOpen(false);
      onColumnDeleted();
    } catch (error: any) {
      console.error("Erro ao deletar coluna:", error);
      toast.error(error.message || "Erro ao deletar coluna");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
        title="Deletar Coluna"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão da coluna</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a coluna <strong>"{columnNome}"</strong>?
              <br />
              <br />
              Esta ação não pode ser desfeita. Certifique-se de que não há tarefas nesta coluna.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deletando..." : "Deletar Coluna"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
