import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ProtocolBadgeProps {
  protocolNumber: string;
  status?: string;
}

export function ProtocolBadge({ protocolNumber, status = 'aberto' }: ProtocolBadgeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(protocolNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const statusColor = {
    aberto: 'bg-amber-500/15 text-amber-700 border-amber-300',
    em_atendimento: 'bg-blue-500/15 text-blue-700 border-blue-300',
    finalizado: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  }[status] || 'bg-muted text-muted-foreground border-border';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`${statusColor} gap-1 cursor-pointer text-[10px] px-1.5 py-0 h-5 font-mono transition-all hover:opacity-80 active:scale-95`}
            onClick={handleCopy}
          >
            <FileText className="h-3 w-3" />
            {protocolNumber}
            {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5 opacity-50" />}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Protocolo de atendimento • Clique para copiar</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
