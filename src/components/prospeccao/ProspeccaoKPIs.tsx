import { Card, CardContent } from "@/components/ui/card";
import { Users, Target, Calendar, DollarSign, TrendingUp, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProspeccaoLog } from "@/hooks/useProspeccaoData";

interface Props {
  data: ProspeccaoLog[];
  channelType: "organic" | "paid";
  isLoading: boolean;
}

export function ProspeccaoKPIs({ data, channelType, isLoading }: Props) {
  const totals = data.reduce(
    (acc, r) => ({
      leads: acc.leads + r.leads_prospected,
      opportunities: acc.opportunities + r.opportunities,
      meetings: acc.meetings + r.meetings_scheduled,
      sales: acc.sales + r.sales_closed,
      gross: acc.gross + Number(r.gross_value),
      adSpend: acc.adSpend + Number(r.ad_spend),
    }),
    { leads: 0, opportunities: 0, meetings: 0, sales: 0, gross: 0, adSpend: 0 }
  );

  const convRate = totals.leads > 0 ? ((totals.opportunities / totals.leads) * 100).toFixed(1) : "0";
  const closeRate = totals.opportunities > 0 ? ((totals.sales / totals.opportunities) * 100).toFixed(1) : "0";
  const ticket = totals.sales > 0 ? (totals.gross / totals.sales) : 0;
  const cpl = totals.leads > 0 ? (totals.adSpend / totals.leads) : 0;
  const roi = totals.adSpend > 0 ? (((totals.gross - totals.adSpend) / totals.adSpend) * 100).toFixed(1) : "0";

  const cards = [
    { label: "Leads Prospectados", value: totals.leads.toString(), icon: Users, color: "text-blue-500" },
    { label: "% Conversão → Oport.", value: `${convRate}%`, icon: Percent, color: "text-amber-500" },
    { label: "Oportunidades", value: totals.opportunities.toString(), icon: Target, color: "text-emerald-500" },
    { label: "Reuniões", value: totals.meetings.toString(), icon: Calendar, color: "text-purple-500" },
    { label: "% Fechamento", value: `${closeRate}%`, icon: TrendingUp, color: "text-rose-500" },
    { label: "Vendas", value: totals.sales.toString(), icon: DollarSign, color: "text-green-500" },
    { label: "Ticket Médio", value: `R$ ${ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-indigo-500" },
    { label: "Valor Bruto", value: `R$ ${totals.gross.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-teal-500" },
  ];

  if (channelType === "paid") {
    cards.push(
      { label: "Gasto Ads", value: `R$ ${totals.adSpend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-red-500" },
      { label: "CPL", value: `R$ ${cpl.toFixed(2)}`, icon: DollarSign, color: "text-orange-500" },
      { label: "ROI", value: `${roi}%`, icon: TrendingUp, color: "text-green-600" }
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold text-foreground">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
