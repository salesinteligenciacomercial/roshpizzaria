import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProspectingInteraction } from "@/hooks/useInteractions";
import { LeadOutcomeBadge } from "./LeadOutcomeBadge";
import { useState } from "react";

interface Props {
  data: ProspectingInteraction[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function InteractionTimeline({ data, isLoading, onRefresh }: Props) {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("prospecting_interactions").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Interação excluída" });
      onRefresh();
    }
  };

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-48" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Interações Individuais</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Data</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Script</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Próx. Passo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Nenhuma interação registrada. Clique em "+ Interação" para adicionar.
                </TableCell>
              </TableRow>
            ) : (
              data.map((r) => (
                <>
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <TableCell className="w-8">
                      {r.interaction_summary ? (
                        expandedId === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.interaction_date + "T12:00:00").toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{r.lead_name || "—"}</span>
                        {r.lead_phone && (
                          <span className="block text-xs text-muted-foreground">{r.lead_phone}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.user_name}</TableCell>
                    <TableCell className="capitalize text-sm">{(r.channel || "—").replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-sm">{r.script_used || "—"}</TableCell>
                    <TableCell><LeadOutcomeBadge outcome={r.outcome} /></TableCell>
                    <TableCell className="text-right font-medium">
                      {r.gross_value > 0 ? `R$ ${fmt(r.gross_value)}` : "—"}
                    </TableCell>
                    <TableCell>
                      {r.next_action ? (
                        <div className="text-xs">
                          <span>{r.next_action}</span>
                          {r.next_action_date && (
                            <span className="block text-muted-foreground">
                              {new Date(r.next_action_date + "T12:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === r.id && r.interaction_summary && (
                    <TableRow key={`${r.id}-detail`}>
                      <TableCell />
                      <TableCell colSpan={9} className="bg-muted/30 text-sm">
                        <p className="font-medium text-xs text-muted-foreground mb-1">Resumo da interação:</p>
                        <p className="whitespace-pre-wrap">{r.interaction_summary}</p>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
