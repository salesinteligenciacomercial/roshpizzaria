import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProspeccaoLog } from "@/hooks/useProspeccaoData";

interface Props {
  data: ProspeccaoLog[];
  channelType: "organic" | "paid";
  isLoading: boolean;
  onRefresh: () => void;
}

export function ProspeccaoTable({ data, channelType, isLoading, onRefresh }: Props) {
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("prospecting_daily_logs").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Registro excluído" });
      onRefresh();
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—";
  const div = (a: number, b: number) => b > 0 ? `R$ ${fmt(a / b)}` : "—";

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>;
  }

  const isPaid = channelType === "paid";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Registros Diários</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Fonte</TableHead>
              {isPaid && <TableHead className="text-right">Gasto</TableHead>}
              <TableHead className="text-right">Leads</TableHead>
              {isPaid && <TableHead className="text-right">CPL</TableHead>}
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Resposta</TableHead>
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Oport.</TableHead>
              {isPaid && <TableHead className="text-right">CPO</TableHead>}
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Reunião</TableHead>
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              {isPaid && <TableHead className="text-right">CPV</TableHead>}
              <TableHead className="text-right">Ticket</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              {isPaid && <TableHead className="text-right">ROI</TableHead>}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isPaid ? 20 : 15} className="text-center text-muted-foreground py-8">
                  Nenhum registro encontrado. Clique em "Registrar" para adicionar.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => {
                const ticket = r.sales_closed > 0 ? r.gross_value / r.sales_closed : 0;
                const roi = r.ad_spend > 0 ? ((r.gross_value - r.ad_spend) / r.ad_spend) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.log_date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{r.user_name}</TableCell>
                    <TableCell className="capitalize">{(r.source || "—").replace(/_/g, " ")}</TableCell>
                    {isPaid && <TableCell className="text-right">R$ {fmt(Number(r.ad_spend))}</TableCell>}
                    <TableCell className="text-right font-medium">{r.leads_prospected}</TableCell>
                    {isPaid && <TableCell className="text-right">{div(Number(r.ad_spend), r.leads_prospected)}</TableCell>}
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.responses, r.leads_prospected)}</TableCell>
                    <TableCell className="text-right font-medium">{r.responses}</TableCell>
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.opportunities, r.responses)}</TableCell>
                    <TableCell className="text-right font-medium">{r.opportunities}</TableCell>
                    {isPaid && <TableCell className="text-right">{div(Number(r.ad_spend), r.opportunities)}</TableCell>}
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.meetings_scheduled, r.opportunities)}</TableCell>
                    <TableCell className="text-right font-medium">{r.meetings_scheduled}</TableCell>
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.sales_closed, r.meetings_scheduled)}</TableCell>
                    <TableCell className="text-right font-medium">{r.sales_closed}</TableCell>
                    {isPaid && <TableCell className="text-right">{div(Number(r.ad_spend), r.sales_closed)}</TableCell>}
                    <TableCell className="text-right">R$ {fmt(ticket)}</TableCell>
                    <TableCell className="text-right font-bold">R$ {fmt(Number(r.gross_value))}</TableCell>
                    {isPaid && (
                      <TableCell className={`text-right font-bold ${roi > 0 ? "text-green-500" : roi < 0 ? "text-red-500" : ""}`}>
                        {r.ad_spend > 0 ? `${roi.toFixed(1)}%` : "—"}
                      </TableCell>
                    )}
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
