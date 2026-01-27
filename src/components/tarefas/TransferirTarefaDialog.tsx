import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Board {
  id: string;
  nome: string;
}

interface Column {
  id: string;
  nome: string;
  cor?: string;
  board_id: string;
}

interface TransferirTarefaDialogProps {
  taskId: string;
  taskTitle: string;
  currentBoardId?: string;
  onTransferred?: () => void;
}

export function TransferirTarefaDialog({
  taskId,
  taskTitle,
  currentBoardId,
  onTransferred,
}: TransferirTarefaDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Carregar quadros ao abrir o dialog
  useEffect(() => {
    if (open) {
      loadBoards();
    }
  }, [open]);

  // Carregar colunas quando selecionar um quadro
  useEffect(() => {
    if (selectedBoardId) {
      loadColumns(selectedBoardId);
      setSelectedColumnId("");
    } else {
      setColumns([]);
    }
  }, [selectedBoardId]);

  const loadBoards = async () => {
    setLoadingBoards(true);
    try {
      const { data, error } = await supabase
        .from("task_boards")
        .select("id, nome")
        .order("criado_em");

      if (error) throw error;

      // Filtrar o quadro atual
      const filteredBoards = (data || []).filter(
        (board) => board.id !== currentBoardId
      );
      setBoards(filteredBoards);
    } catch (error) {
      console.error("Erro ao carregar quadros:", error);
      toast.error("Erro ao carregar quadros");
    } finally {
      setLoadingBoards(false);
    }
  };

  const loadColumns = async (boardId: string) => {
    setLoadingColumns(true);
    try {
      const { data, error } = await supabase
        .from("task_columns")
        .select("id, nome, cor, board_id")
        .eq("board_id", boardId)
        .order("posicao");

      if (error) throw error;
      setColumns(data || []);

      // Selecionar primeira coluna automaticamente
      if (data && data.length > 0) {
        setSelectedColumnId(data[0].id);
      }
    } catch (error) {
      console.error("Erro ao carregar colunas:", error);
      toast.error("Erro ao carregar colunas");
    } finally {
      setLoadingColumns(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedBoardId || !selectedColumnId) {
      toast.error("Selecione o quadro e a coluna de destino");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          board_id: selectedBoardId,
          column_id: selectedColumnId,
        })
        .eq("id", taskId);

      if (error) throw error;

      toast.success("Tarefa transferida com sucesso!");
      setOpen(false);
      setSelectedBoardId("");
      setSelectedColumnId("");
      onTransferred?.();
    } catch (error: any) {
      console.error("Erro ao transferir tarefa:", error);
      toast.error(error?.message || "Erro ao transferir tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          title="Transferir para outro quadro"
        >
          <ArrowRightLeft className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-md"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            Transferir Tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Transferir "{taskTitle}" para outro quadro
          </p>

          <div className="space-y-2">
            <Label htmlFor="board">Quadro de destino</Label>
            {loadingBoards ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando quadros...
              </div>
            ) : boards.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Não há outros quadros disponíveis
              </p>
            ) : (
              <Select value={selectedBoardId} onValueChange={setSelectedBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o quadro" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedBoardId && (
            <div className="space-y-2">
              <Label htmlFor="column">Coluna de destino</Label>
              {loadingColumns ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando colunas...
                </div>
              ) : columns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este quadro não possui colunas
                </p>
              ) : (
                <Select
                  value={selectedColumnId}
                  onValueChange={setSelectedColumnId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: column.cor || "#6b7280" }}
                          />
                          {column.nome}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={loading || !selectedBoardId || !selectedColumnId}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Transferindo...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transferir
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
