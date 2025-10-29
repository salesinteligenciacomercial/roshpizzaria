import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Trophy, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LeadStats {
  totalGanhos: number;
  totalPerdidos: number;
  valorTotalGanhos: number;
}

export default function Relatorios() {
  const [stats, setStats] = useState<LeadStats>({
    totalGanhos: 0,
    totalPerdidos: 0,
    valorTotalGanhos: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  const carregarEstatisticas = async () => {
    try {
      const { data: leadsGanhos, error: errorGanhos } = await supabase
        .from("leads")
        .select("value")
        .eq("status", "ganho");

      const { data: leadsPerdidos, error: errorPerdidos } = await supabase
        .from("leads")
        .select("id")
        .eq("status", "perdido");

      if (errorGanhos || errorPerdidos) {
        throw new Error("Erro ao carregar estatísticas");
      }

      const valorTotal = leadsGanhos?.reduce((acc, lead) => acc + (lead.value || 0), 0) || 0;

      setStats({
        totalGanhos: leadsGanhos?.length || 0,
        totalPerdidos: leadsPerdidos?.length || 0,
        valorTotalGanhos: valorTotal
      });
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground">
          Análises e insights do seu desempenho comercial
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <Trophy className="h-5 w-5" />
              Leads Ganhos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{stats.totalGanhos}</div>
                <div className="text-sm text-muted-foreground">
                  Valor total: R$ {stats.valorTotalGanhos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Leads Perdidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Carregando...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-2xl font-bold">{stats.totalPerdidos}</div>
                <div className="text-sm text-muted-foreground">
                  Taxa de conversão: {stats.totalGanhos + stats.totalPerdidos > 0
                    ? ((stats.totalGanhos / (stats.totalGanhos + stats.totalPerdidos)) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Mais métricas em breve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Em desenvolvimento</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
