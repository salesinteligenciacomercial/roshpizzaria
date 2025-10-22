import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Calendar as CalendarIcon, Trash2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EditarTarefaDialog } from "./EditarTarefaDialog";

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
}

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: () => void;
}

export function TaskCard({ task, onDelete, onUpdate }: TaskCardProps) {
  const navigate = useNavigate();
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
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      baixa: "bg-gray-500",
      media: "bg-yellow-500",
      alta: "bg-orange-500",
      urgente: "bg-red-500",
    };
    return colors[priority] || "bg-gray-500";
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-lg"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base font-medium">{task.title}</CardTitle>
          <Badge className={getPriorityColor(task.priority)}>
            {task.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {task.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {task.assignee_name && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {task.assignee_name}
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {new Date(task.due_date).toLocaleDateString("pt-BR")}
            </div>
          )}
        </div>
        {task.lead_name && (
          <div className="flex items-center justify-between">
            <Badge variant="outline">Lead: {task.lead_name}</Badge>
            {task.lead_id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/leads`)}
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        <div className="flex justify-end gap-1 pt-2">
          <EditarTarefaDialog task={task} onTaskUpdated={onUpdate} />
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
