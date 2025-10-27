import { useDraggable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, Trash2, MessageCircle, Building2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LeadActionsDialog } from "@/components/leads/LeadActionsDialog";
import { MoverLeadFunilDialog } from "./MoverLeadFunilDialog";
import { useNavigate } from "react-router-dom";

interface LeadCardProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    value?: number;
    company?: string;
    source?: string;
    tags?: string[];
    funil_id?: string;
    etapa_id?: string;
  };
  onDelete: (leadId: string) => void;
  onLeadMoved?: () => void;
}

export function LeadCard({ lead, onDelete, onLeadMoved }: LeadCardProps) {
  const navigate = useNavigate();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: lead.id,
    data: {
      type: 'lead',
      lead: lead
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  } : undefined;

  const abrirConversa = () => {
    if (lead.telefone) {
      navigate('/conversas', { state: { leadId: lead.id } });
    } else {
      console.warn('Lead sem telefone:', lead.nome);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative p-4 mb-3 cursor-grab active:cursor-grabbing border-0 shadow-card hover:shadow-lg transition-all duration-300 bg-card overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-card opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-start gap-2 flex-1">
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground mb-1">{lead.nome}</h4>
              {lead.tags && lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="h-2.5 w-2.5 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <MoverLeadFunilDialog
              leadId={lead.id}
              leadNome={lead.nome}
              funilAtualId={lead.funil_id}
              etapaAtualId={lead.etapa_id}
              onLeadMoved={() => onLeadMoved?.()}
            />
            <LeadActionsDialog lead={{ id: lead.id, name: lead.nome, telefone: lead.telefone, email: lead.email }} />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lead.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {lead.company && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1.5 rounded-md">
            <Building2 className="h-3 w-3" />
            <span>{lead.company}</span>
          </div>
        )}

        {lead.telefone && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{lead.telefone}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-success hover:text-success hover:bg-success/10 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                abrirConversa();
              }}
              title="Abrir Conversa"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs font-medium">Conversa</span>
            </Button>
          </div>
        )}

        {lead.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-2 py-1.5 rounded-md">
            <Mail className="h-3 w-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}

        {lead.value !== undefined && lead.value > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground font-medium">Valor Estimado</span>
            <Badge className="font-semibold bg-gradient-success text-success-foreground shadow-sm">
              R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
          </div>
        )}

        {lead.source && (
          <Badge variant="outline" className="text-xs font-medium border-primary/20 text-primary">
            <Tag className="h-3 w-3 mr-1" />
            {lead.source}
          </Badge>
        )}
      </div>
    </Card>
  );
}