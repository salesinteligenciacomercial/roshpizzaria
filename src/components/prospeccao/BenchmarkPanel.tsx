import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const benchmarks = [
  { label: "Conexão com Decisor", value: "7%", tip: "Percentual médio de contatos que resultam em conversa com o decisor. Depende da qualidade da lista e abordagem." },
  { label: "Agendamento de Reunião", value: "40%", tip: "Dos decisores conectados, quantos aceitam uma reunião. Influenciado pelo script e proposta de valor." },
  { label: "Comparecimento", value: "80%", tip: "Taxa de comparecimento em reuniões agendadas. Melhorada com lembretes e confirmação prévia." },
  { label: "Fechamento", value: "10-33%", tip: "Taxa de conversão de reuniões em vendas. Varia por ticket, complexidade e alinhamento de expectativas." },
];

export function BenchmarkPanel() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          📊 Indicadores de Referência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <TooltipProvider>
          {benchmarks.map((b) => (
            <div key={b.label} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{b.label}</span>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3 w-3 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    <p className="text-xs">{b.tip}</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-bold text-primary">{b.value}</span>
            </div>
          ))}
        </TooltipProvider>
        <p className="text-[10px] text-muted-foreground/60 pt-2 border-t">
          Referências de mercado B2B. Seus resultados podem variar conforme nicho, ticket e maturidade do processo.
        </p>
      </CardContent>
    </Card>
  );
}
