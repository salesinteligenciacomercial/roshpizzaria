import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Plus, 
  MoreHorizontal, 
  Calendar as CalendarIcon, 
  User, 
  Tag,
  GripVertical,
  Trash2,
  Edit,
  CheckCircle2,
  Circle,
  Clock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProcessTask {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  assignee_name?: string;
  tags: string[];
  page_id: string | null;
  position: number;
  created_at: string;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  tasks: ProcessTask[];
}

interface ProcessKanbanProps {
  companyId: string | null;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: "backlog", title: "Backlog", color: "bg-slate-500", tasks: [] },
  { id: "todo", title: "A Fazer", color: "bg-blue-500", tasks: [] },
  { id: "in_progress", title: "Em Andamento", color: "bg-yellow-500", tasks: [] },
  { id: "review", title: "Em Revisão", color: "bg-purple-500", tasks: [] },
  { id: "done", title: "Concluído", color: "bg-green-500", tasks: [] },
];

function TaskCard({ task, onEdit, onDelete }: { task: ProcessTask; onEdit: () => void; onDelete: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColors: Record<string, string> = {
    low: "bg-green-500/20 text-green-700",
    medium: "bg-yellow-500/20 text-yellow-700",
    high: "bg-orange-500/20 text-orange-700",
    urgent: "bg-red-500/20 text-red-700",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-background border border-border rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium text-sm truncate" onClick={onEdit}>
              {task.title}
            </h4>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                <Edit className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap gap-1 mt-2">
            {task.priority && (
              <Badge variant="secondary" className={cn("text-xs", priorityColors[task.priority])}>
                {task.priority === "low" && "Baixa"}
                {task.priority === "medium" && "Média"}
                {task.priority === "high" && "Alta"}
                {task.priority === "urgent" && "Urgente"}
              </Badge>
            )}
            {task.tags?.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            {task.due_date && (
              <div className="flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" />
                {format(new Date(task.due_date), "dd MMM", { locale: ptBR })}
              </div>
            )}
            {task.assignee_name && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {task.assignee_name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumnComponent({ 
  column, 
  onAddTask, 
  onEditTask, 
  onDeleteTask 
}: { 
  column: KanbanColumn; 
  onAddTask: (status: string) => void;
  onEditTask: (task: ProcessTask) => void;
  onDeleteTask: (taskId: string) => void;
}) {
  return (
    <div className="flex-shrink-0 w-72 bg-muted/30 rounded-xl p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", column.color)} />
          <h3 className="font-semibold text-sm">{column.title}</h3>
          <Badge variant="secondary" className="text-xs">{column.tasks.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onAddTask(column.id)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-380px)]">
        <SortableContext items={column.tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 pr-2">
            {column.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task.id)}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export function ProcessKanban({ companyId }: ProcessKanbanProps) {
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [tasks, setTasks] = useState<ProcessTask[]>([]);
  const [activeTask, setActiveTask] = useState<ProcessTask | null>(null);
  const [editingTask, setEditingTask] = useState<ProcessTask | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<string>("todo");
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  // Form state
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: null as Date | null,
    assignee_id: "",
    tags: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (companyId) {
      loadTasks();
      loadTeamMembers();
    }
  }, [companyId]);

  const loadTasks = async () => {
    if (!companyId) return;

    // Load tasks from process_pages with properties.is_task = true
    const { data, error } = await supabase
      .from('process_pages')
      .select('*')
      .eq('company_id', companyId)
      .eq('page_type', 'task')
      .order('position', { ascending: true });

    if (error) {
      console.error('Error loading tasks:', error);
      return;
    }

    const mappedTasks: ProcessTask[] = (data || []).map(page => {
      const props = page.properties as Record<string, any> || {};
      return {
        id: page.id,
        title: page.title,
        description: props.description || null,
        status: props.status || 'backlog',
        priority: props.priority || 'medium',
        due_date: props.due_date || null,
        assignee_id: props.assignee_id || null,
        assignee_name: props.assignee_name || null,
        tags: props.tags || [],
        page_id: page.parent_id,
        position: page.position || 0,
        created_at: page.created_at || '',
      };
    });

    setTasks(mappedTasks);
    
    // Distribute tasks to columns
    const newColumns = DEFAULT_COLUMNS.map(col => ({
      ...col,
      tasks: mappedTasks.filter(t => t.status === col.id)
    }));
    setColumns(newColumns);
  };

  const loadTeamMembers = async () => {
    if (!companyId) return;

    const { data } = await supabase
      .from('user_roles')
      .select('user_id, profiles:user_id(id, full_name, email)')
      .eq('company_id', companyId);

    if (data) {
      setTeamMembers(data.map((d: any) => d.profiles).filter(Boolean));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the column that contains the over element
    let targetColumn: KanbanColumn | undefined;
    for (const col of columns) {
      if (col.tasks.find(t => t.id === overId) || col.id === overId) {
        targetColumn = col;
        break;
      }
    }

    if (!targetColumn) return;

    const task = tasks.find(t => t.id === activeId);
    if (!task || task.status === targetColumn.id) return;

    // Update task status in database
    const { error } = await supabase
      .from('process_pages')
      .update({
        properties: {
          ...task,
          status: targetColumn.id,
        }
      })
      .eq('id', activeId);

    if (error) {
      toast.error('Erro ao mover tarefa');
      return;
    }

    // Update local state
    setTasks(prev => prev.map(t => 
      t.id === activeId ? { ...t, status: targetColumn!.id } : t
    ));
    
    loadTasks();
    toast.success('Tarefa movida');
  };

  const handleAddTask = (status: string) => {
    setNewTaskStatus(status);
    setEditingTask(null);
    setTaskForm({
      title: "",
      description: "",
      priority: "medium",
      due_date: null,
      assignee_id: "",
      tags: "",
    });
    setIsDialogOpen(true);
  };

  const handleEditTask = (task: ProcessTask) => {
    setEditingTask(task);
    setNewTaskStatus(task.status);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date ? new Date(task.due_date) : null,
      assignee_id: task.assignee_id || "",
      tags: task.tags?.join(", ") || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('process_pages')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast.error('Erro ao excluir tarefa');
      return;
    }

    toast.success('Tarefa excluída');
    loadTasks();
  };

  const handleSaveTask = async () => {
    if (!companyId || !taskForm.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    const { data: user } = await supabase.auth.getUser();
    const assignee = teamMembers.find(m => m.id === taskForm.assignee_id);

    const taskData = {
      company_id: companyId,
      title: taskForm.title,
      icon: '✅',
      page_type: 'task',
      properties: {
        description: taskForm.description,
        status: newTaskStatus,
        priority: taskForm.priority,
        due_date: taskForm.due_date?.toISOString() || null,
        assignee_id: taskForm.assignee_id || null,
        assignee_name: assignee?.full_name || null,
        tags: taskForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      },
      created_by: user.user?.id,
    };

    if (editingTask) {
      const { error } = await supabase
        .from('process_pages')
        .update(taskData)
        .eq('id', editingTask.id);

      if (error) {
        toast.error('Erro ao atualizar tarefa');
        return;
      }
      toast.success('Tarefa atualizada');
    } else {
      const { error } = await supabase
        .from('process_pages')
        .insert(taskData);

      if (error) {
        toast.error('Erro ao criar tarefa');
        return;
      }
      toast.success('Tarefa criada');
    }

    setIsDialogOpen(false);
    loadTasks();
  };

  return (
    <div className="h-[calc(100vh-280px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Quadro de Tarefas</h2>
          <p className="text-sm text-muted-foreground">Arraste as tarefas para alterar o status</p>
        </div>
        <Button onClick={() => handleAddTask("todo")}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Tarefa
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <KanbanColumnComponent
              key={column.id}
              column={column}
              onAddTask={handleAddTask}
              onEditTask={handleEditTask}
              onDeleteTask={handleDeleteTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="bg-background border border-border rounded-lg p-3 shadow-lg w-72">
              <h4 className="font-medium text-sm">{activeTask.title}</h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Título</label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Digite o título da tarefa"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Descreva a tarefa"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Prioridade</label>
                <Select
                  value={taskForm.priority}
                  onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Responsável</label>
                <Select
                  value={taskForm.assignee_id}
                  onValueChange={(value) => setTaskForm({ ...taskForm, assignee_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Data de Vencimento</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !taskForm.due_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {taskForm.due_date ? format(taskForm.due_date, "PPP", { locale: ptBR }) : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={taskForm.due_date || undefined}
                    onSelect={(date) => setTaskForm({ ...taskForm, due_date: date || null })}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium">Tags (separadas por vírgula)</label>
              <Input
                value={taskForm.tags}
                onChange={(e) => setTaskForm({ ...taskForm, tags: e.target.value })}
                placeholder="ex: urgente, cliente, projeto-x"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTask}>
                {editingTask ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
