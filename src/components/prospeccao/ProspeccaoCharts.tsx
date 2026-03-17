import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ProspeccaoLog } from "@/hooks/useProspeccaoData";

interface Props {
  data: ProspeccaoLog[];
  channelType: "organic" | "paid";
}

export function ProspeccaoCharts({ data, channelType }: Props) {
  if (data.length === 0) return null;

  // Aggregate by date
  const byDate = data.reduce<Record<string, { date: string; leads: number; opportunities: number; meetings: number; sales: number; gross: number; adSpend: number }>>((acc, r) => {
    const d = r.log_date;
    if (!acc[d]) acc[d] = { date: d, leads: 0, opportunities: 0, meetings: 0, sales: 0, gross: 0, adSpend: 0 };
    acc[d].leads += r.leads_prospected;
    acc[d].opportunities += r.opportunities;
    acc[d].meetings += r.meetings_scheduled;
    acc[d].sales += r.sales_closed;
    acc[d].gross += Number(r.gross_value);
    acc[d].adSpend += Number(r.ad_spend);
    return acc;
  }, {});

  const chartData = Object.values(byDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(d => ({
      ...d,
      date: new Date(d.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Funil de Prospecção</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="opportunities" name="Oportunidades" fill="hsl(var(--chart-2, 142 71% 45%))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sales" name="Vendas" fill="hsl(var(--chart-3, 262 83% 58%))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {channelType === "paid" ? "Investimento vs Retorno" : "Reuniões e Vendas"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend />
              {channelType === "paid" ? (
                <>
                  <Bar dataKey="adSpend" name="Gasto (R$)" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gross" name="Bruto (R$)" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                </>
              ) : (
                <>
                  <Bar dataKey="meetings" name="Reuniões" fill="hsl(262 83% 58%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sales" name="Vendas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gross" name="Bruto (R$)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
