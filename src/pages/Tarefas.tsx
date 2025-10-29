import { useState, useEffect, type ReactNode } from "react";
import { DndContext, DragEndEvent, closestCorners, useDroppable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
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
import { AdicionarColunaDialog } from "@/components/tarefas/AdicionarColunaDialog";
import { EditarColunaDialog } from "@/components/tarefas/EditarColunaDialog";
import { DeletarColunaDialog } from "@/components/tarefas/DeletarColunaDialog";
import { toast } from "sonner";
import { TarefasProvider } from "@/context/TarefasContext";
import { TarefaCalendar } from "@/components/tarefas/TarefaCalendar";
import { Button as UIButton } from "@/components/ui/button";

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

function DroppableColumnContainer({ columnId, children }: { columnId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId,
    data: { type: 'column', columnId },
  });
  return (
    <div ref={setNodeRef} className={`bg-secondary/20 p-4 rounded-b-lg min-h-[500px] ${isOver ? 'bg-primary/10 border-2 border-primary border-dashed' : ''}`}>
      {children}
    </div>
  );
}

export default function Tarefas() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [novoBoardNome, setNovoBoardNome] = useState("");
  const [dialogNovoBoard, setDialogNovoBoard] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "calendar">("board");
  const [searchText, setSearchText] = useState<string>("");
  const [allUsers, setAllUsers] = useState<{ id: string; full_name: string }[]>([]);
  const [filterAssignee, setFilterAssignee] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterTag, setFilterTag] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    carregarDados();
    (async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').order('full_name');
      setAllUsers((data as any) || []);
    })();

    // Realtime: tasks (atualizações incrementais)
    const formatTask = (task: any) => {
      let meta: any = {};
      if (typeof task.description === 'string') {
        const match = task.description.match(/<!--meta:(.*)-->/s);
        if (match) {
          try { meta = JSON.parse(match[1]); } catch { /* ignore */ }
        }
      }
      return {
        ...task,
        checklist: task.checklist ?? meta.checklist ?? [],
        tags: task.tags ?? meta.tags ?? [],
        comments: task.comments ?? meta.comments ?? [],
        assignee_name: (task as any).assignee?.full_name,
        lead_name: (task as any).lead?.name,
      } as any;
    };

    const tasksChannel = supabase
      .channel('tasks_board_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setTasks(prev => [formatTask(payload.new), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? formatTask(payload.new) : t));
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      })
      .subscribe();

    // Realtime: colunas e quadros (recarregar estrutura quando houver mudanças)
    const columnsChannel = supabase
      .channel('task_columns_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_columns' }, () => carregarDados())
      .subscribe();

    const boardsChannel = supabase
      .channel('task_boards_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_boards' }, () => carregarDados())
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(columnsChannel);
      supabase.removeChannel(boardsChannel);
    };
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

      const formattedTasks = (tasksData || []).map((task: any) => {
        // Fallback: extrair metadados de descrição, se checklist/tags/comments não existirem
        let meta: any = {};
        if (typeof task.description === 'string') {
          const match = task.description.match(/<!--meta:(.*)-->\s*$/s);
          if (match) {
            try { meta = JSON.parse(match[1]); } catch {}
          }
        }
        return {
          ...task,
          checklist: task.checklist ?? meta.checklist ?? [],
          tags: task.tags ?? meta.tags ?? [],
          comments: task.comments ?? meta.comments ?? [],
          assignee_name: task.assignee?.full_name,
          lead_name: task.lead?.name,
        };
      });
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

    const taskId = String(active.id);
    const overData: any = (over as any).data?.current || {};
    // Destino confiável: quando solta sobre outra tarefa, containerId é a coluna;
    // quando solta na área da coluna, usamos columnId (setado no droppable) ou o próprio over.id
    const containerId = overData?.sortable?.containerId as string | undefined;
    const columnMetaId = overData?.columnId as string | undefined;
    const guessed = (containerId || columnMetaId || String(over.id));

    const newColumnId = guessed;

    // Validar coluna
    const isValidColumn = columns.some(c => c.id === newColumnId);
    if (!isValidColumn) {
      toast.error("Coluna inválida");
      setActiveTaskId(null);
      return;
    }

    // Atualização otimista simples
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColumnId } : t));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error("Não autenticado");

      await supabase.functions.invoke("api-tarefas", {
        body: { action: "mover_tarefa", data: { task_id: taskId, nova_coluna_id: newColumnId } }
      });

      toast.success("Tarefa movida!");
      await carregarDados();
    } catch (error) {
      toast.error("Erro ao mover tarefa");
      carregarDados();
    }
    setActiveTaskId(null);
  };

  const handleDragStart = (event: any) => {
    setActiveTaskId(event.active?.id ?? null);
  };

  const handleDragCancel = () => setActiveTaskId(null);

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
  const matchesSearch = (t: Task) => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return (
      (t.title || "").toLowerCase().includes(q) ||
      (t.description || "").toLowerCase().includes(q)
    );
  };

  const matchesFilters = (t: any) => {
    if (filterAssignee && !(t.assignee_id === filterAssignee || (t.responsaveis || []).includes(filterAssignee))) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (filterTag && !(Array.isArray(t.tags) && t.tags.includes(filterTag))) return false;
    return true;
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><p>Carregando...</p></div>;

  return (
    <TarefasProvider>
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Tarefas (Trello Style)</h1>
          <p className="text-muted-foreground">Gerencie suas tarefas em quadros Kanban</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 rounded-md border p-1">
            <UIButton
              variant={viewMode === 'board' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('board')}
            >
              🗂 Quadro
            </UIButton>
            <UIButton
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              📅 Calendário
            </UIButton>
          </div>
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar tarefas..."
            className="w-64"
          />
          <select className="border rounded-md p-2" value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}>
            <option value="">Responsável</option>
            {allUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
          <select className="border rounded-md p-2" value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="">Prioridade</option>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="urgente">Urgente</option>
          </select>
          <select className="border rounded-md p-2" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
            <option value="">Tag</option>
            {Array.from(new Set(tasks.flatMap((t: any) => Array.isArray(t.tags) ? t.tags : []))).map(tag => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
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

      {viewMode === 'board' && boards.length > 0 && (
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

      {viewMode === 'calendar' ? (
        <TarefaCalendar />
      ) : boards.length === 0 ? (
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
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners} 
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex overflow-x-auto gap-4 pb-4">
            {columnsFiltradas.map((column) => (
              <div key={column.id} className="min-w-[300px] flex-shrink-0">
                <div 
                  className="text-white p-3 rounded-t-lg" 
                  style={{ backgroundColor: column.cor }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{column.nome}</h3>
                    <div className="flex gap-1">
                      <EditarColunaDialog
                        columnId={column.id}
                        nomeAtual={column.nome}
                        corAtual={column.cor}
                        onColumnUpdated={carregarDados}
                      />
                      <DeletarColunaDialog
                        columnId={column.id}
                        columnNome={column.nome}
                        onColumnDeleted={carregarDados}
                      />
                    </div>
                  </div>
                  <span className="text-sm">
                    {tasks.filter(t => t.column_id === column.id).length} tarefas
                  </span>
                </div>
                <SortableContext id={column.id} items={tasks.filter(t => t.column_id === column.id).map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumnContainer columnId={column.id}>
                    <NovaTarefaDialog 
                      columnId={column.id} 
                      boardId={selectedBoard} 
                      onTaskCreated={carregarDados} 
                    />
                    {tasks.filter(t => t.column_id === column.id && matchesSearch(t) && matchesFilters(t)).map((task) => (
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
                  </DroppableColumnContainer>
                </SortableContext>
              </div>
            ))}
            {/* Botão para adicionar nova coluna */}
            <div className="min-w-[280px] flex-shrink-0">
              <AdicionarColunaDialog
                boardId={selectedBoard}
                currentColumnsCount={columnsFiltradas.length}
                onColumnAdded={carregarDados}
              />
            </div>
          </div>
          <DragOverlay dropAnimation={{
            duration: 180,
            easing: 'cubic-bezier(0.2, 0, 0, 1)',
          }}>
            {activeTaskId ? (
              <div className="min-w-[280px] max-w-[320px] pointer-events-none opacity-90">
                <div className="rounded-md border bg-card p-4 shadow-lg">
                  <div className="font-semibold">{tasks.find(t => t.id === activeTaskId)?.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">Arrastando…</div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
    </TarefasProvider>
  );
}
