import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, Trash2, MessageCircle, Building2, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LeadCardProps {
  lead: {
    id: string;
    nome: string;
    telefone?: string;
    email?: string;
    value?: number;
    company?: string;
    source?: string;
  };
  onDelete: (leadId: string) => void;
}

export function LeadCard({ lead, onDelete }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const abrirWhatsapp = () => {
    if (lead.telefone) {
      const numero = lead.telefone.replace(/\D/g, "");
      window.open(`https://wa.me/55${numero}`, "_blank");
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow bg-card"
    >
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">{lead.nome}</h4>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(lead.id);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        {lead.company && (
          <p className="text-xs text-muted-foreground">{lead.company}</p>
        )}

        {lead.telefone && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Phone className="h-3 w-3" />
              <span>{lead.telefone}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={(e) => {
                e.stopPropagation();
                abrirWhatsapp();
              }}
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              <span className="text-xs">WhatsApp</span>
            </Button>
          </div>
        )}

        {lead.email && (
          <div className="flex items-center gap-2 text-xs">
            <Mail className="h-3 w-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}

        {lead.value !== undefined && lead.value > 0 && (
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">Valor</span>
            <Badge variant="secondary" className="font-semibold">
              R$ {lead.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Badge>
          </div>
        )}

        {lead.source && (
          <Badge variant="outline" className="text-xs mt-2">
            {lead.source}
          </Badge>
        )}
      </div>
    </Card>
  );
}