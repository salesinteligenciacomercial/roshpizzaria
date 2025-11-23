import { useState, useEffect } from "react";
import { Settings, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface Column {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  board_id: string;
}

interface EditarQuadroDialogProps {
  boardId: string;
  boardNome: string;
  onUpdated: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  openDeleteDialog?: boolean;
  onDeleteDialogChange?: (open: boolean) => void;
}

export function EditarQuadroDialog({ boardId, boardNome, onUpdated, open: controlledOpen, onOpenChange: controlledOnOpenChange, openDeleteDialog: controlledDeleteOpen, onDeleteDialogChange: controlledDeleteOnOpenChange }: EditarQuadroDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [columns, setColumns] = useState<Column[]>([]);
  const [novoNomeQuadro, setNovoNomeQuadro] = useState(boardNome);
  const [novaColunaNome, setNovaColunaNome] = useState("");
  const [novaColunaCor, setNovaColunaCor] = useState("#3b82f6");
  const [editandoColuna, setEditandoColuna] = useState<string | null>(null);
  const [nomeEditado, setNomeEditado] = useState("");
  const [corEditada, setCorEditada] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteColumnId, setDeleteColumnId] = useState<string | null>(null);
  const [internalDeleteBoardDialogOpen, setInternalDeleteBoardDialogOpen] = useState(false);
  
  // Use controlled state if provided, otherwise use internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  
  // Use controlled delete dialog state if provided, otherwise use internal state
  const deleteBoardDialogOpen = controlledDeleteOpen !== undefined ? controlledDeleteOpen : internalDeleteBoardDialogOpen;
  const setDeleteBoardDialogOpen = controlledDeleteOnOpenChange || setInternalDeleteBoardDialogOpen;

  useEffect(() => {
    if (open) {
      carregarColunas();
      setNovoNomeQuadro(boardNome);
    }
  }, [open, boardId, boardNome]);

  // Se o dialog de exclusão for aberto externamente, abrir o dialog de edição também para mostrar o contexto
  useEffect(() => {
    if (deleteBoardDialogOpen && !open) {
      setOpen(true);
    }
  }, [deleteBoardDialogOpen, open, setOpen]);

  // Quando o dialog de edição for aberto e houver uma solicitação para abrir o dialog de exclusão, abrir automaticamente
  useEffect(() => {
    if (open && controlledDeleteOpen && !deleteBoardDialogOpen) {
      // Pequeno delay para garantir que o dialog de edição esteja totalmente renderizado
      const timer = setTimeout(() => {
        setDeleteBoardDialogOpen(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [open, controlledDeleteOpen, deleteBoardDialogOpen, setDeleteBoardDialogOpen]);

  const carregarColunas = async () => {
    const { data } = await supabase
      .from("task_columns")
      .select("*")
      .eq("board_id", boardId)
      .order("posicao");
    setColumns(data || []);
  };

  const salvarNomeQuadro = async () => {
    if (!novoNomeQuadro.trim()) {
      toast.error("Digite um nome para o quadro");
      return;
    }

    try {
      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "editar_board",
          data: { board_id: boardId, nome: novoNomeQuadro },
        },
      });
      toast.success("Nome do quadro atualizado!");
      onUpdated();
    } catch (error) {
      toast.error("Erro ao atualizar nome do quadro");
    }
  };

  const adicionarColuna = async () => {
    if (!novaColunaNome.trim()) {
      toast.error("Digite um nome para a coluna");
      return;
    }

    try {
      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "criar_coluna",
          data: {
            nome: novaColunaNome,
            board_id: boardId,
            posicao: columns.length,
            cor: novaColunaCor,
          },
        },
      });
      toast.success("Coluna criada!");
      setNovaColunaNome("");
      setNovaColunaCor("#3b82f6");
      carregarColunas();
      onUpdated();
    } catch (error) {
      toast.error("Erro ao criar coluna");
    }
  };

  const salvarEdicaoColuna = async (colunaId: string) => {
    if (!nomeEditado.trim()) {
      toast.error("Digite um nome para a coluna");
      return;
    }

    try {
      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "editar_coluna",
          data: { column_id: colunaId, nome: nomeEditado, cor: corEditada },
        },
      });
      toast.success("Coluna atualizada!");
      setEditandoColuna(null);
      carregarColunas();
      onUpdated();
    } catch (error) {
      toast.error("Erro ao atualizar coluna");
    }
  };

  const confirmarExclusaoColuna = async () => {
    if (!deleteColumnId) return;

    try {
      // Verificar se há tarefas na coluna
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("column_id", deleteColumnId);

      if (tasks && tasks.length > 0) {
        toast.error(`Esta coluna possui ${tasks.length} tarefa(s). Mova-as antes de excluir.`);
        setDeleteDialogOpen(false);
        setDeleteColumnId(null);
        return;
      }

      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "deletar_coluna",
          data: { column_id: deleteColumnId },
        },
      });
      toast.success("Coluna excluída!");
      setDeleteDialogOpen(false);
      setDeleteColumnId(null);
      carregarColunas();
      onUpdated();
    } catch (error) {
      toast.error("Erro ao excluir coluna");
    }
  };

  const confirmarExclusaoQuadro = async () => {
    try {
      // Verificar se há colunas e tarefas
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("board_id", boardId);

      if (tasks && tasks.length > 0) {
        toast.error(`Este quadro possui ${tasks.length} tarefa(s). Exclua-as antes de excluir o quadro.`);
        setDeleteBoardDialogOpen(false);
        return;
      }

      await supabase.functions.invoke("api-tarefas", {
        body: {
          action: "deletar_board",
          data: { board_id: boardId },
        },
      });
      toast.success("Quadro excluído!");
      setDeleteBoardDialogOpen(false);
      if (controlledOpen === undefined) {
        setOpen(false);
      } else if (controlledOnOpenChange) {
        controlledOnOpenChange(false);
      }
      onUpdated();
    } catch (error) {
      toast.error("Erro ao excluir quadro");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Quadro</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Nome do Quadro */}
            <div className="space-y-2">
              <Label>Nome do Quadro</Label>
              <div className="flex gap-2">
                <Input
                  value={novoNomeQuadro}
                  onChange={(e) => setNovoNomeQuadro(e.target.value)}
                  placeholder="Nome do quadro"
                />
                <Button onClick={salvarNomeQuadro}>Salvar</Button>
              </div>
            </div>

            {/* Lista de Colunas */}
            <div className="space-y-2">
              <Label>Colunas</Label>
              <div className="space-y-2">
                {columns.map((column) => (
                  <div key={column.id} className="flex items-center gap-2 p-2 border rounded-md">
                    {editandoColuna === column.id ? (
                      <>
                        <Input
                          value={nomeEditado}
                          onChange={(e) => setNomeEditado(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="color"
                          value={corEditada}
                          onChange={(e) => setCorEditada(e.target.value)}
                          className="w-16"
                        />
                        <Button size="sm" onClick={() => salvarEdicaoColuna(column.id)}>
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditandoColuna(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <div
                          className="w-8 h-8 rounded"
                          style={{ backgroundColor: column.cor }}
                        />
                        <span className="flex-1">{column.nome}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditandoColuna(column.id);
                            setNomeEditado(column.nome);
                            setCorEditada(column.cor);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDeleteColumnId(column.id);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Adicionar Nova Coluna */}
            <div className="space-y-2">
              <Label>Adicionar Coluna</Label>
              <div className="flex gap-2">
                <Input
                  value={novaColunaNome}
                  onChange={(e) => setNovaColunaNome(e.target.value)}
                  placeholder="Nome da coluna"
                  className="flex-1"
                />
                <Input
                  type="color"
                  value={novaColunaCor}
                  onChange={(e) => setNovaColunaCor(e.target.value)}
                  className="w-16"
                />
                <Button onClick={adicionarColuna}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Excluir Quadro */}
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={() => setDeleteBoardDialogOpen(true)}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Quadro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão de coluna */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta coluna? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusaoColuna}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação de exclusão de quadro */}
      <AlertDialog open={deleteBoardDialogOpen} onOpenChange={setDeleteBoardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este quadro? Todas as colunas serão excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusaoQuadro}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
