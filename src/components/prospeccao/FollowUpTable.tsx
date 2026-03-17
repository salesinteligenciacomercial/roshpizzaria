import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FollowUpLog } from "@/hooks/useFollowUpData";

interface Props {
  data: FollowUpLog[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function FollowUpTable({ data, isLoading, onRefresh }: Props) {
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("followup_daily_logs").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Registro excluído" });
      onRefresh();
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (a: number, b: number) => b > 0 ? `${((a / b) * 100).toFixed(1)}%` : "—";

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Registros de Follow-Up</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead className="text-right">Follow-ups</TableHead>
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Respostas</TableHead>
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Reuniões</TableHead>
              <TableHead className="text-right text-amber-500">%</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Ticket</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  Nenhum registro de follow-up encontrado. Clique em "Registrar" para adicionar.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => {
                const ticket = r.sales_closed > 0 ? r.gross_value / r.sales_closed : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.log_date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>{r.user_name}</TableCell>
                    <TableCell className="capitalize">{(r.source || "—").replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-medium">{r.followups_sent}</TableCell>
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.responses, r.followups_sent)}</TableCell>
                    <TableCell className="text-right font-medium">{r.responses}</TableCell>
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.meetings_scheduled, r.responses)}</TableCell>
                    <TableCell className="text-right font-medium">{r.meetings_scheduled}</TableCell>
                    <TableCell className="text-right text-amber-500 font-medium">{pct(r.sales_closed, r.meetings_scheduled)}</TableCell>
                    <TableCell className="text-right font-medium">{r.sales_closed}</TableCell>
                    <TableCell className="text-right">R$ {fmt(ticket)}</TableCell>
                    <TableCell className="text-right font-bold">R$ {fmt(Number(r.gross_value))}</TableCell>
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
