import { useState } from "react";
import { CheckCircle2, Clock, Edit3, Archive, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUSES = [
  { 
    value: 'draft', 
    label: 'Rascunho', 
    icon: Edit3, 
    color: 'text-gray-500 bg-gray-500/10',
    description: 'Em elaboração'
  },
  { 
    value: 'in_review', 
    label: 'Em Revisão', 
    icon: Clock, 
    color: 'text-yellow-600 bg-yellow-500/10',
    description: 'Aguardando aprovação'
  },
  { 
    value: 'published', 
    label: 'Publicado', 
    icon: CheckCircle2, 
    color: 'text-green-600 bg-green-500/10',
    description: 'Disponível para equipe'
  },
  { 
    value: 'archived', 
    label: 'Arquivado', 
    icon: Archive, 
    color: 'text-muted-foreground bg-muted',
    description: 'Documento arquivado'
  },
];

interface PageStatusProps {
  pageId: string;
  status: string;
  onUpdate: (status: string) => void;
}

export function PageStatus({ pageId, status, onUpdate }: PageStatusProps) {
  const [open, setOpen] = useState(false);

  const currentStatus = STATUSES.find(s => s.value === status) || STATUSES[0];

  const updateStatus = async (newStatus: string) => {
    try {
      await supabase
        .from('process_pages')
        .update({ 
          properties: { status: newStatus }
        })
        .eq('id', pageId);

      onUpdate(newStatus);
      setOpen(false);
      toast.success('Status atualizado');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("h-7 gap-1.5 px-2", currentStatus.color)}
        >
          <currentStatus.icon className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{currentStatus.label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => updateStatus(s.value)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              status === s.value && "bg-muted"
            )}
          >
            <div className={cn("p-1 rounded", s.color)}>
              <s.icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.description}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
