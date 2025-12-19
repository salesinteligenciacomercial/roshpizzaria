import { useState } from "react";
import { Plus, Trash, MoreHorizontal, Edit2, X, Check, LayoutGrid } from "lucide-react";
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

interface KanbanData {
  name?: string;
  columns: KanbanColumn[];
  tasks: KanbanTask[];
}

interface InlineKanbanProps {
  content: KanbanData;
  onUpdate: (content: KanbanData) => void;
  onRemove: () => void;
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

export function InlineKanban({ content, onUpdate, onRemove }: InlineKanbanProps) {
  const [board, setBoard] = useState<KanbanData>(
    content || { name: 'Quadro de Tarefas', columns: [], tasks: [] }
  );
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newTaskTexts, setNewTaskTexts] = useState<Record<string, string>>({});
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editColumnTitle, setEditColumnTitle] = useState('');
  const [editingBoardName, setEditingBoardName] = useState(false);
  const [boardName, setBoardName] = useState(content?.name || 'Quadro de Tarefas');

  const updateBoardName = () => {
    if (!boardName.trim()) return;
    const newBoard = { ...board, name: boardName.trim() };
    saveBoard(newBoard);
    setEditingBoardName(false);
  };

  const saveBoard = (newBoard: KanbanData) => {
    setBoard(newBoard);
    onUpdate(newBoard);
  };

  const addColumn = () => {
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
    
    saveBoard(newBoard);
    setNewColumnTitle('');
    setAddingColumn(false);
  };

  const updateColumnTitle = (columnId: string) => {
    if (!editColumnTitle.trim()) return;
    
    const newBoard = {
      ...board,
      columns: board.columns.map(col =>
        col.id === columnId ? { ...col, title: editColumnTitle.trim() } : col
      )
    };
    
    saveBoard(newBoard);
    setEditingColumn(null);
    setEditColumnTitle('');
  };

  const deleteColumn = (columnId: string) => {
    const newBoard = {
      columns: board.columns.filter(col => col.id !== columnId),
      tasks: board.tasks.filter(task => task.columnId !== columnId)
    };
    
    saveBoard(newBoard);
  };

  const addTask = (columnId: string) => {
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
    
    saveBoard(newBoard);
    setNewTaskTexts({ ...newTaskTexts, [columnId]: '' });
  };

  const deleteTask = (taskId: string) => {
    const newBoard = {
      ...board,
      tasks: board.tasks.filter(task => task.id !== taskId)
    };
    
    saveBoard(newBoard);
  };

  const moveTask = (taskId: string, newColumnId: string) => {
    const newBoard = {
      ...board,
      tasks: board.tasks.map(task =>
        task.id === taskId ? { ...task, columnId: newColumnId } : task
      )
    };
    
    saveBoard(newBoard);
  };

  const getTasksForColumn = (columnId: string) => {
    return board.tasks.filter(task => task.columnId === columnId);
  };

  if (board.columns.length === 0 && !addingColumn) {
    return (
      <div className="border border-dashed border-border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Quadro Kanban</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={() => setAddingColumn(true)} variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Criar Primeira Coluna
        </Button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg p-3 bg-muted/10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          {editingBoardName ? (
            <div className="flex items-center gap-1">
              <Input
                value={boardName}
                onChange={(e) => setBoardName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateBoardName();
                  if (e.key === 'Escape') {
                    setEditingBoardName(false);
                    setBoardName(board.name || 'Quadro de Tarefas');
                  }
                }}
                className="h-6 text-sm w-40"
                autoFocus
              />
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={updateBoardName}>
                <Check className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                setEditingBoardName(false);
                setBoardName(board.name || 'Quadro de Tarefas');
              }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <span 
              className="font-medium text-sm cursor-pointer hover:underline" 
              onClick={() => setEditingBoardName(true)}
              title="Clique para editar o nome"
            >
              {board.name || 'Quadro de Tarefas'}
            </span>
          )}
          <Badge variant="secondary" className="text-xs">{board.tasks.length} itens</Badge>
        </div>
        <div className="flex items-center gap-1">
          {!addingColumn && (
            <Button onClick={() => setAddingColumn(true)} variant="ghost" size="sm" className="h-7 px-2 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              Coluna
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={onRemove}
          >
            <Trash className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {/* Columns */}
          {board.columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-52 bg-background rounded-md p-2 border border-border"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-2">
                {editingColumn === column.id ? (
                  <div className="flex items-center gap-1 flex-1">
                    <Input
                      value={editColumnTitle}
                      onChange={(e) => setEditColumnTitle(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && updateColumnTitle(column.id)}
                      className="h-6 text-xs"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => updateColumnTitle(column.id)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setEditingColumn(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className={cn("w-2 h-2 rounded-full", column.color)} />
                      <span className="font-medium text-xs">{column.title}</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {getTasksForColumn(column.id).length}
                      </Badge>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingColumn(column.id);
                          setEditColumnTitle(column.title);
                        }}>
                          <Edit2 className="h-3 w-3 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => deleteColumn(column.id)}
                        >
                          <Trash className="h-3 w-3 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>

              {/* Tasks */}
              <div className="space-y-1.5 min-h-[40px]">
                {getTasksForColumn(column.id).map((task) => (
                  <div
                    key={task.id}
                    className="bg-muted/50 border border-border rounded p-1.5 group flex items-start gap-1.5 text-xs"
                  >
                    <span className="flex-1">{task.text}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100">
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
                          <Trash className="h-3 w-3 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>

              {/* Add Task */}
              <div className="mt-1.5 flex items-center gap-1">
                <Input
                  value={newTaskTexts[column.id] || ''}
                  onChange={(e) => setNewTaskTexts({ ...newTaskTexts, [column.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addTask(column.id)}
                  placeholder="+ Item"
                  className="h-6 text-xs border-dashed"
                />
                {newTaskTexts[column.id] && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => addTask(column.id)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Add Column */}
          {addingColumn && (
            <div className="flex-shrink-0 w-52 bg-muted/20 rounded-md p-2 border border-dashed border-border">
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
                className="mb-2 h-7 text-xs"
                autoFocus
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-xs px-2" onClick={addColumn} disabled={!newColumnTitle.trim()}>
                  Criar
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => {
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
