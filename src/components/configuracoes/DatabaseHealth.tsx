import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Database, Trash2, Search, AlertTriangle, Activity, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DbAnalysis {
  totalDbSizeMB: number;
  publicSchemaSizeMB: number;
  cronLogsSizeMB: number;
  cronLogsCount: number;
  httpResponseSizeMB: number;
  httpResponseCount: number;
  bloatSizeMB: number;
  oldCronCount: number;
  oldHttpCount: number;
  retentionDays: number;
  topTables: { name: string; sizeMB: number; deadTuples: number }[];
}

export function DatabaseHealth() {
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [analysis, setAnalysis] = useState<DbAnalysis | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"cleanup_logs" | "full_maintenance">("cleanup_logs");
  const [retentionDays, setRetentionDays] = useState("7");
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-database", {
        body: { action: "analyze", retention_days: parseInt(retentionDays) },
      });
      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        const bloat = data.analysis.bloatSizeMB;
        if (bloat < 10) {
          toast.success("Banco saudável! Pouco lixo operacional encontrado.");
        } else {
          toast.info(`${bloat} MB de lixo operacional encontrado.`);
        }
      }
    } catch (error: any) {
      console.error("Erro ao analisar DB:", error);
      toast.error("Erro ao analisar: " + (error.message || "Tente novamente"));
    } finally {
      setAnalyzing(false);
    }
  };

  const openConfirm = (action: "cleanup_logs" | "full_maintenance") => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  const handleCleanup = async () => {
    setConfirmOpen(false);
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-database", {
        body: { action: confirmAction, retention_days: parseInt(retentionDays) },
      });
      if (error) throw error;
      if (data) {
        const total = (data.deletedCron || 0) + (data.deletedHttp || 0);
        setLastResult(
          confirmAction === "full_maintenance"
            ? `Manutenção completa! ${total.toLocaleString()} registros removidos. Banco: ${data.finalDbSizeMB} MB`
            : `${total.toLocaleString()} registros de log removidos com sucesso!`
        );
        toast.success(`${total.toLocaleString()} registros removidos!`);
        setTimeout(handleAnalyze, 2000);
      }
    } catch (error: any) {
      console.error("Erro na limpeza:", error);
      toast.error("Erro: " + (error.message || "Tente novamente"));
    } finally {
      setCleaning(false);
    }
  };

  const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  const healthStatus = analysis
    ? analysis.bloatSizeMB > 500 ? "critical" : analysis.bloatSizeMB > 100 ? "warning" : "healthy"
    : null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Saúde do Banco de Dados
            {healthStatus && (
              <Badge variant={healthStatus === "healthy" ? "outline" : "destructive"} className={healthStatus === "warning" ? "bg-amber-500/20 text-amber-600 border-amber-500/30" : ""}>
                {healthStatus === "healthy" ? "✅ Saudável" : healthStatus === "warning" ? "⚠️ Atenção" : "🚨 Crítico"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Analise e remova lixo operacional (logs internos, cache HTTP) que infla o banco sem ser dados reais.
            <strong className="block mt-1 text-foreground/80">Esta limpeza NÃO apaga conversas, leads ou clientes.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Retention selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Manter logs dos últimos:</span>
            <Select value={retentionDays} onValueChange={setRetentionDays}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">🧹 Todo o período (limpar tudo)</SelectItem>
                <SelectItem value="3">3 dias</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground mb-1">Banco Total</p>
                  <p className="text-lg font-bold">{formatSize(analysis.totalDbSizeMB)}</p>
                  <Badge variant="outline">de 25 GB</Badge>
                </div>
                <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Dados Reais (public)</p>
                  <p className="text-lg font-bold text-green-600">{formatSize(analysis.publicSchemaSizeMB)}</p>
                  <Badge variant="outline" className="border-green-500/30 text-green-600">Seus dados</Badge>
                </div>
                <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Logs Cron</p>
                  <p className="text-lg font-bold text-amber-600">{formatSize(analysis.cronLogsSizeMB)}</p>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-600">
                    {analysis.cronLogsCount.toLocaleString()} registros
                  </Badge>
                </div>
                <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20">
                  <p className="text-xs text-muted-foreground mb-1">Cache HTTP</p>
                  <p className="text-lg font-bold text-destructive">{formatSize(analysis.httpResponseSizeMB)}</p>
                  <Badge variant="destructive">
                    {analysis.httpResponseCount.toLocaleString()} registros
                  </Badge>
                </div>
              </div>

              {/* Removable records */}
              {(analysis.oldCronCount > 0 || analysis.oldHttpCount > 0) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    <strong>{(analysis.oldCronCount + analysis.oldHttpCount).toLocaleString()}</strong> registros
                    operacionais com mais de <strong>{analysis.retentionDays} dias</strong> podem ser removidos com segurança.
                    ({analysis.oldCronCount.toLocaleString()} logs cron + {analysis.oldHttpCount.toLocaleString()} respostas HTTP)
                  </p>
                </div>
              )}

              {/* Top tables */}
              {analysis.topTables.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> Maiores tabelas do app
                  </summary>
                  <div className="mt-2 space-y-1">
                    {analysis.topTables.map((t) => (
                      <div key={t.name} className="flex justify-between px-2 py-1 rounded bg-muted/50">
                        <span className="font-mono text-xs">{t.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatSize(t.sizeMB)} {t.deadTuples > 1000 && <span className="text-amber-500">({t.deadTuples.toLocaleString()} dead)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}

          {lastResult && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-green-600 font-medium text-sm">✅ {lastResult}</span>
            </div>
          )}

          {(analyzing || cleaning) && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {analyzing ? "Analisando banco de dados..." : "Executando manutenção..."}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleAnalyze} disabled={analyzing || cleaning}>
              <Search className="h-4 w-4 mr-2" />
              {analyzing ? "Analisando..." : "Analisar Banco"}
            </Button>

            {analysis && (analysis.oldCronCount > 0 || analysis.oldHttpCount > 0) && (
              <Button variant="secondary" onClick={() => openConfirm("cleanup_logs")} disabled={analyzing || cleaning}>
                <Trash2 className="h-4 w-4 mr-2" />
                {cleaning ? "Limpando..." : "Limpar Logs Antigos"}
              </Button>
            )}

            {analysis && (
              <Button variant="destructive" onClick={() => openConfirm("full_maintenance")} disabled={analyzing || cleaning}>
                <Wrench className="h-4 w-4 mr-2" />
                {cleaning ? "Executando..." : "Manutenção Completa"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "cleanup_logs" ? "Confirmar Limpeza de Logs" : "Confirmar Manutenção Completa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "cleanup_logs" ? (
                <>
                  Serão removidos registros operacionais com mais de <strong>{retentionDays} dias</strong>.
                  Isso inclui logs de cron e cache HTTP internos.
                  <br /><br />
                  <strong>Nenhuma conversa, lead ou dado de cliente será afetado.</strong>
                </>
              ) : (
                <>
                  Será executada uma manutenção completa: limpeza de logs antigos + otimização das tabelas principais.
                  <br /><br />
                  <strong>Nenhuma conversa, lead ou dado de cliente será afetado.</strong> Pode levar alguns minutos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} className={confirmAction === "full_maintenance" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
