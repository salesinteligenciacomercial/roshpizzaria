import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MoreVertical, ArrowRightLeft, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface LeadCardProps {
  lead: {
    id: string;
    name: string;
    phone: string;
    tag?: string;
  };
}

export function LeadCard({ lead }: LeadCardProps) {
  // Funções de manipulação
  const handleTransfer = (funnelId: string) => {
    console.log('Transferindo para funil:', funnelId);
    toast.success(`Lead transferido para ${funnelId}`);
  };

  const handleEdit = () => {
    console.log('Editando lead:', lead.id);
    toast.success('Editando lead');
  };

  const handleDelete = () => {
    console.log('Deletando lead:', lead.id);
    toast.success('Lead deletado');
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(lead.phone);
    toast.success('Telefone copiado!');
  };

  return (
    <Card className="w-full bg-white">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Informações do Lead */}
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>
                {lead.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <h3 className="font-medium">{lead.name}</h3>
              <p className="text-sm text-muted-foreground">{lead.phone}</p>
              {lead.tag && (
                <span className="inline-block px-2 py-0.5 mt-1 text-xs bg-gray-100 rounded-full">
                  {lead.tag}
                </span>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-2">
            {/* Menu de Transferência */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleTransfer('Proposta Enviada')}>
                  Proposta Enviada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTransfer('Negociação')}>
                  Negociação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTransfer('Fechado')}>
                  Fechado
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menu de Edição */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  Editar Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyPhone}>
                  Copiar Telefone
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  Excluir Lead
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}