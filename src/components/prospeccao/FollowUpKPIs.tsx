import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MailCheck, MessageSquareReply, CalendarCheck, ShoppingCart, Banknote } from "lucide-react";
import { FollowUpLog } from "@/hooks/useFollowUpData";

interface Props {
  data: FollowUpLog[];
  isLoading: boolean;
}

export function FollowUpKPIs({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-16" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const totals = data.reduce(
    (acc, r) => ({
      followups: acc.followups + (r.followups_sent || 0),
      responses: acc.responses + (r.responses || 0),
      meetings: acc.meetings + (r.meetings_scheduled || 0),
      sales: acc.sales + (r.sales_closed || 0),
      gross: acc.gross + Number(r.gross_value || 0),
    }),
    { followups: 0, responses: 0, meetings: 0, sales: 0, gross: 0 }
  );

  const responseRate = totals.followups > 0 ? ((totals.responses / totals.followups) * 100).toFixed(1) : "0";
  const meetingRate = totals.responses > 0 ? ((totals.meetings / totals.responses) * 100).toFixed(1) : "0";
  const ticket = totals.sales > 0 ? (totals.gross / totals.sales) : 0;

  const cards = [
    { label: "Follow-ups Enviados", value: totals.followups.toLocaleString("pt-BR"), icon: MailCheck, color: "text-blue-500" },
    { label: "Taxa de Resposta", value: `${responseRate}%`, icon: MessageSquareReply, color: "text-amber-500" },
    { label: "Taxa de Reunião", value: `${meetingRate}%`, icon: CalendarCheck, color: "text-purple-500" },
    { label: "Vendas via Follow-up", value: totals.sales.toLocaleString("pt-BR"), icon: ShoppingCart, color: "text-green-500" },
    { label: "Ticket Médio", value: `R$ ${ticket.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: Banknote, color: "text-emerald-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-muted ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-lg font-bold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
