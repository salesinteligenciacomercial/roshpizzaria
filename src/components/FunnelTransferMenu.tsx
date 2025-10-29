import React, { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";

interface FunnelStage {
  id: string;
  name: string;
}

interface SalesFunnel {
  id: string;
  name: string;
  stages: FunnelStage[];
}

interface FunnelTransferMenuProps {
  leadId: string;
  currentFunnelId: string;
  onTransfer: (funnelId: string, stageId: string) => void;
}

export function FunnelTransferMenu({ leadId, currentFunnelId, onTransfer }: FunnelTransferMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFunnel, setSelectedFunnel] = useState<SalesFunnel | null>(null);
  
  // Dados de exemplo para teste
  const funnels: SalesFunnel[] = [
    {
      id: "1",
      name: "Funil Principal",
      stages: [
        { id: "1", name: "Qualificação" },
        { id: "2", name: "Apresentação" },
        { id: "3", name: "Proposta" },
      ]
    },
    {
      id: "2",
      name: "Funil Produtos",
      stages: [
        { id: "1", name: "Interesse" },
        { id: "2", name: "Demonstração" },
        { id: "3", name: "Fechamento" },
      ]
    }
  ];

  useEffect(() => {
    console.log('FunnelTransferMenu montado', { leadId, currentFunnelId });
  }, []);

  const handleFunnelClick = (funnel: SalesFunnel) => {
    console.log('Funil selecionado:', funnel);
    setSelectedFunnel(funnel);
  };

  const handleStageClick = (funnelId: string, stageId: string) => {
    console.log('Transferindo para:', { funnelId, stageId });
    onTransfer(funnelId, stageId);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100"
          onClick={() => console.log('Botão clicado')}
        >
          <ArrowRightLeft className="h-4 w-4" />
          <span>Transferir</span>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        {funnels
          .filter(funnel => funnel.id !== currentFunnelId)
          .map(funnel => (
            <DropdownMenuItem
              key={funnel.id}
              onClick={() => handleFunnelClick(funnel)}
              className="flex justify-between items-center"
            >
              {funnel.name}
              <ArrowRightLeft className="h-4 w-4" />
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>

      {selectedFunnel && (
        <DropdownMenuContent
          align="end"
          className="w-56"
          style={{ marginTop: '0px' }}
        >
          <DropdownMenuItem
            className="font-semibold"
            onClick={() => setSelectedFunnel(null)}
          >
            ← Voltar
          </DropdownMenuItem>
          
          {selectedFunnel.stages.map(stage => (
            <DropdownMenuItem
              key={stage.id}
              onClick={() => handleStageClick(selectedFunnel.id, stage.id)}
            >
              {stage.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}