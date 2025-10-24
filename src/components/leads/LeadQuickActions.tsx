import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  MessageSquare, 
  Calendar, 
  CheckSquare,
  Eye,
  Edit,
  Trash2,
  Phone
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface LeadQuickActionsProps {
  leadId: string;
  leadName: string;
  leadPhone?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function LeadQuickActions({ 
  leadId, 
  leadName, 
  leadPhone,
  onEdit, 
  onDelete 
}: LeadQuickActionsProps) {
  const navigate = useNavigate();

  const abrirConversa = () => {
    navigate('/conversas', { state: { leadId } });
    toast.success("Abrindo conversas do lead");
  };

  const criarAgendamento = () => {
    navigate('/agenda', { state: { leadId, leadName } });
    toast.success("Criar novo agendamento");
  };

  const criarTarefa = () => {
    navigate('/tarefas', { state: { leadId, leadName } });
    toast.success("Criar nova tarefa");
  };

  const ligarWhatsApp = () => {
    if (leadPhone) {
      const numero = leadPhone.replace(/\D/g, "");
      window.open(`https://wa.me/55${numero}`, "_blank");
    } else {
      toast.error("Lead não possui telefone cadastrado");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={abrirConversa}>
          <MessageSquare className="h-4 w-4 mr-2" />
          Ver Conversas
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={ligarWhatsApp} disabled={!leadPhone}>
          <Phone className="h-4 w-4 mr-2" />
          Ligar no WhatsApp
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={criarAgendamento}>
          <Calendar className="h-4 w-4 mr-2" />
          Criar Agendamento
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={criarTarefa}>
          <CheckSquare className="h-4 w-4 mr-2" />
          Criar Tarefa
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Editar Lead
          </DropdownMenuItem>
        )}
        
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Lead
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
