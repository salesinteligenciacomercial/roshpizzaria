import { useState, useEffect } from "react";
import { Plus, Trash, GripVertical, LayoutGrid, MoreHorizontal, Edit2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KanbanTask {
  id: string;
  text: string;
  columnId: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
}

interface KanbanBoard {
  columns: KanbanColumn[];
  tasks: KanbanTask[];
}

interface TaskKanbanBoardProps {
  pageId: string;
  kanbanData: KanbanBoard | null;
  onUpdate: (data: KanbanBoard) => void;
}

const DEFAULT_COLORS = [
  'bg-slate-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
  'bg-purple-500',
  'bg-pink-500',
];

export function TaskKanbanBoard({ pageId, kanbanData, onUpdate }: TaskKanbanBoardProps) {
  const [board, setBoard] = useState<KanbanBoard>(
    kanbanData || { columns: [], tasks: [] }
  );
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newTaskTexts, setNewTaskTexts] = useState<Record<string, string>>({});
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState('');

  useEffect(() => {
    if (kanbanData) {
      setBoard(kanbanData);
    }
  }, [kanbanData]);

  const saveBoard = async (newBoard: KanbanBoard) => {
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const addColumn = async () => {
    if (!newColumnTitle.trim()) return;
    
    const newColumn: KanbanColumn = {
      id: crypto.randomUUID(),
      title: newColumnTitle.trim(),
      color: DEFAULT_COLORS[board.columns.length % DEFAULT_COLORS.length]
    };
    
    const newBoard = {
      ...board,
      columns: [...board.columns, newColumn]
    };
    
    await saveBoard(newBoard);
    setNewColumnTitle('');
    setAddingColumn(false);
    toast.success('Coluna criada');
  };

  const updateColumnTitle = async (columnId: string) => {
    if (!editColumnTitle.trim()) return;
    
    const newBoard = {
      ...board,
      columns: board.columns.map(col =>
        col.id === columnId ? { ...col, title: editColumnTitle.trim() } : col
      )
    };
    
    await saveBoard(newBoard);
    setEditingColumn(null);
    setEditColumnTitle('');
  };

  const deleteColumn = async (columnId: string) => {
    const newBoard = {
      columns: board.columns.filter(col => col.id !== columnId),
      tasks: board.tasks.filter(task => task.columnId !== columnId)
    };
    
    await saveBoard(newBoard);
    toast.success('Coluna excluída');
  };

  const addTask = async (columnId: string) => {
    const text = newTaskTexts[columnId];
    if (!text?.trim()) return;
    
    const newTask: KanbanTask = {
      id: crypto.randomUUID(),
      text: text.trim(),
      columnId
    };
    
    const newBoard = {
      ...board,
      tasks: [...board.tasks, newTask]
    };
    
    await saveBoard(newBoard);
    setNewTaskTexts({ ...newTaskTexts, [columnId]: '' });
  };

  const deleteTask = async (taskId: string) => {
    const newBoard = {
      ...board,
      tasks: board.tasks.filter(task => task.id !== taskId)
    };
    
    await saveBoard(newBoard);
  };

  const moveTask = async (taskId: string, newColumnId: string) => {
    const newBoard = {
      ...board,
      tasks: board.tasks.map(task =>
        task.id === taskId ? { ...task, columnId: newColumnId } : task
      )
    };
    
    await saveBoard(newBoard);
  };

  const getTasksForColumn = (columnId: string) => {
    return board.tasks.filter(task => task.columnId === columnId);
  };

  if (board.columns.length === 0 && !addingColumn) {
    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Quadro de Tarefas</h3>
        </div>
        
        <div className="border border-dashed border-border rounded-lg p-6 text-center">
          <LayoutGrid className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm mb-4">
            Organize suas subtarefas em colunas
          </p>
          <Button onClick={() => setAddingColumn(true)} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Coluna
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-lg">Quadro de Tarefas</h3>
          <Badge variant="secondary">{board.tasks.length} itens</Badge>
        </div>
        
        {!addingColumn && (
          <Button onClick={() => setAddingColumn(true)} variant="ghost" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Coluna
          </Button>
        )}
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4">
          {/* Columns */}
          {board.columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-64 bg-muted/30 rounded-lg p-3 border border-border"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3">
                {editingColumn === column.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editColumnTitle}
                      onChange={(e) => setEditColumnTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && updateColumnTitle(column.id)}
                      className="h-7 text-sm"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateColumnTitle(column.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingColumn(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", column.color)} />
                      <span className="font-medium text-sm">{column.title}</span>
                      <Badge variant="secondary" className="text-xs">
                        {getTasksForColumn(column.id).length}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingColumn(column.id);
                          setEditColumnTitle(column.title);
                        }}>
                          <Edit2 className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteColumn(column.id)}
                        >
                          <Trash className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-2 min-h-[60px]">
                {getTasksForColumn(column.id).map((task) => (
                  <div
                    key={task.id}
                    className="bg-background border border-border rounded-md p-2 group flex items-start gap-2"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab" />
                    <span className="flex-1 text-sm">{task.text}</span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {board.columns
                            .filter(col => col.id !== column.id)
                            .map(col => (
                              <DropdownMenuItem
                                key={col.id}
                                onClick={() => moveTask(task.id, col.id)}
                              >
                                <div className={cn("w-2 h-2 rounded-full mr-2", col.color)} />
                                Mover para {col.title}
                              </DropdownMenuItem>
                            ))}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => deleteTask(task.id)}
                          >
                            <Trash className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Task */}
              <div className="mt-2 flex items-center gap-1">
                <Input
                  value={newTaskTexts[column.id] || ''}
                  onChange={(e) => setNewTaskTexts({ ...newTaskTexts, [column.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addTask(column.id)}
                  placeholder="+ Adicionar item"
                  className="h-8 text-sm border-dashed"
                />
                {newTaskTexts[column.id] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => addTask(column.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Add Column */}
          {addingColumn && (
            <div className="flex-shrink-0 w-64 bg-muted/20 rounded-lg p-3 border border-dashed border-border">
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addColumn();
                  if (e.key === 'Escape') {
                    setAddingColumn(false);
                    setNewColumnTitle('');
                  }
                }}
                placeholder="Nome da coluna"
                className="mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={addColumn} disabled={!newColumnTitle.trim()}>
                  Criar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  setAddingColumn(false);
                  setNewColumnTitle('');
                }}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
