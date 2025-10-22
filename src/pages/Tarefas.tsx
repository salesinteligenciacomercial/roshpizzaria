import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { TaskCard } from "@/components/tarefas/TaskCard";
import { NovaTarefaDialog } from "@/components/tarefas/NovaTarefaDialog";
import { EditarQuadroDialog } from "@/components/tarefas/EditarQuadroDialog";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: string | null;
  assignee_name?: string;
  due_date: string | null;
  lead_id: string | null;
  lead_name?: string;
  column_id?: string | null;
  board_id?: string | null;
}

interface Column {
  id: string;
  nome: string;
  posicao: number;
  cor: string;
  board_id: string;
}

interface Board {
  id: string;
  nome: string;
  descricao?: string;
}

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [novoBoardNome, setNovoBoardNome] = useState("");
  const [dialogNovoBoard, setDialogNovoBoard] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      const { data: boardsData } = await supabase.from("task_boards").select("*").order("criado_em");
      setBoards(boardsData || []);
      
      if (!selectedBoard && boardsData && boardsData.length > 0) {
        setSelectedBoard(boardsData[0].id);
      }

      const { data: columnsData } = await supabase.from("task_columns").select("*").order("posicao");
      setColumns(columnsData || []);

      const { data: tasksData } = await supabase
        .from("tasks")
        .select(`
          *,
          assignee:profiles!tasks_assignee_id_fkey(full_name),
          lead:leads!tasks_lead_id_fkey(name)
        `)
        .order("created_at", { ascending: false });

      const formattedTasks = (tasksData || []).map((task: any) => ({
        ...task,
        assignee_name: task.assignee?.full_name,
        lead_name: task.lead?.name,
      }));
      setTasks(formattedTasks);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
      toast.error("Erro ao carregar dados das tarefas");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newColumnId = over.id as string;

    setTasks((tasks) => 
      tasks.map((task) => 
        task.id === taskId ? { ...task, column_id: newColumnId } : task
      )
    );

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Não autenticado");

      await supabase.functions.invoke("api-tarefas", {
        body: { action: "mover_tarefa", data: { task_id: taskId, nova_coluna_id: newColumnId } }
      });

      toast.success("Tarefa movida!");
    } catch (error) {
      toast.error("Erro ao mover tarefa");
      carregarDados();
    }
  };

  const criarNovoBoard = async () => {
    if (!novoBoardNome.trim()) return;

    try {
      const { data: boardData } = await supabase.functions.invoke("api-tarefas", {
        body: { action: "criar_board", data: { nome: novoBoardNome } }
      });

      const newBoardId = boardData?.data?.id;

      // Criar colunas padrão
      if (newBoardId) {
        const colunasDefault = [
          { nome: "A Fazer", cor: "#3b82f6", posicao: 0 },
          { nome: "Em Progresso", cor: "#eab308", posicao: 1 },
          { nome: "Concluído", cor: "#22c55e", posicao: 2 },
        ];

        for (const coluna of colunasDefault) {
          await supabase.functions.invoke("api-tarefas", {
            body: {
              action: "criar_coluna",
              data: { ...coluna, board_id: newBoardId },
            },
          });
        }
      }

      toast.success("Quadro criado com colunas padrão!");
      setNovoBoardNome("");
      setDialogNovoBoard(false);
      carregarDados();
    } catch (error) {
      toast.error("Erro ao criar quadro");
    }
  };

  const columnsFiltradas = columns.filter((column) => column.board_id === selectedBoard);

  if (loading) return <div className="flex items-center justify-center h-screen"><p>Carregando...</p></div>;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tarefas (Trello Style)</h1>
          <p className="text-muted-foreground">Gerencie suas tarefas em quadros Kanban</p>
        </div>
        <div className="flex gap-2">
          {selectedBoard && (
            <EditarQuadroDialog
              boardId={selectedBoard}
              boardNome={boards.find((b) => b.id === selectedBoard)?.nome || ""}
              onUpdated={carregarDados}
            />
          )}
          <Dialog open={dialogNovoBoard} onOpenChange={setDialogNovoBoard}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Novo Quadro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Quadro</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Nome do Quadro</Label>
                  <Input 
                    value={novoBoardNome} 
                    onChange={(e) => setNovoBoardNome(e.target.value)} 
                    placeholder="Ex: Projeto Q1 2024"
                  />
                </div>
                <Button onClick={criarNovoBoard} className="w-full">
                  Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {boards.length > 0 && (
        <div className="mb-6">
          <Label>Quadro</Label>
          <select 
            value={selectedBoard} 
            onChange={(e) => setSelectedBoard(e.target.value)} 
            className="w-full max-w-xs p-2 border rounded-md mt-2"
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {boards.length === 0 ? (
        <div className="text-center py-12">
          <Button onClick={() => setDialogNovoBoard(true)}>
            <Plus className="mr-2" />
            Criar Primeiro Quadro
          </Button>
        </div>
      ) : columnsFiltradas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhuma coluna criada ainda</p>
          <p className="text-sm text-muted-foreground">
            Crie colunas como "A Fazer", "Em Progresso", "Concluído"
          </p>
        </div>
      ) : (
        <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
          <div className="flex overflow-x-auto gap-4 pb-4">
            {columnsFiltradas.map((column) => (
              <div key={column.id} className="min-w-[300px] flex-shrink-0">
                <div 
                  className="text-white p-3 rounded-t-lg" 
                  style={{ backgroundColor: column.cor }}
                >
                  <h3 className="font-semibold">{column.nome}</h3>
                  <span className="text-sm">
                    {tasks.filter(t => t.column_id === column.id).length} tarefas
                  </span>
                </div>
                <SortableContext 
                  id={column.id} 
                  items={tasks.filter(t => t.column_id === column.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  <div className="bg-secondary/20 p-4 rounded-b-lg min-h-[500px]">
                    <NovaTarefaDialog 
                      columnId={column.id} 
                      boardId={selectedBoard} 
                      onTaskCreated={carregarDados} 
                    />
                    {tasks.filter(t => t.column_id === column.id).map((task) => (
                      <TaskCard 
                        key={task.id} 
                        task={task}
                        onDelete={async (id) => {
                          await supabase.functions.invoke("api-tarefas", { 
                            body: { action: "deletar_tarefa", data: { task_id: id } } 
                          });
                          carregarDados();
                        }}
                        onUpdate={carregarDados}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>
        </DndContext>
      )}
    </div>
  );
}
