import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, LayoutDashboard, Plus, ArrowDownUp } from "lucide-react";

type Period = "hoje" | "mes";

type MovimentacaoLocal = {
  id: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  created_at: string;
};

function startOfTodayISO(d: Date) {
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  return dd.toISOString();
}

function startOfMonthISO(d: Date) {
  const dd = new Date(d.getFullYear(), d.getMonth(), 1);
  dd.setHours(0, 0, 0, 0);
  return dd.toISOString();
}

export default function CaixaPDV() {
  const [isMasterAccount, setIsMasterAccount] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [period, setPeriod] = useState<Period>("hoje");
  const [loadingResumo, setLoadingResumo] = useState(false);

  const [faturamento, setFaturamento] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [vendasCount, setVendasCount] = useState(0);

  const [pedidosEntreguesCount, setPedidosEntreguesCount] = useState(0);
  const [movimentacoesLocal, setMovimentacoesLocal] = useState<MovimentacaoLocal[]>([]);

  const MOV_KEY = "pdv_caixa_movimentacoes_local_v1";

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(MOV_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MovimentacaoLocal[];
      if (Array.isArray(parsed)) setMovimentacoesLocal(parsed);
    } catch (e) {
      console.warn("Falha ao carregar movimentações locais:", e);
    }
  }, []);

  const saveLocal = useCallback((items: MovimentacaoLocal[]) => {
    try {
      localStorage.setItem(MOV_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Falha ao salvar movimentações locais:", e);
    }
  }, []);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: company } = await supabase.rpc("get_my_company");
        if (company && company.length > 0) {
          setIsMasterAccount(company[0].is_master_account === true);
        } else {
          setIsMasterAccount(false);
        }
      } catch (error) {
        console.error("Error checking access:", error);
        setIsMasterAccount(false);
      } finally {
        setCheckingAccess(false);
      }
    };
    checkAccess();
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = period === "hoje" ? startOfTodayISO(now) : startOfMonthISO(now);
    const end = now.toISOString();
    return { start, end };
  }, [period]);

  const entradas = useMemo(
    () => movimentacoesLocal.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0),
    [movimentacoesLocal]
  );
  const saidas = useMemo(
    () => movimentacoesLocal.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0),
    [movimentacoesLocal]
  );
  const saldo = useMemo(() => faturamento + entradas - saidas, [faturamento, entradas, saidas]);

  const refreshResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const companyId = await supabase.rpc("get_my_company_id");

      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos" as any)
        .select("id, total, status, created_at")
        .eq("company_id", companyId as unknown as string)
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      if (pedidosError) throw pedidosError;

      const pedidosEntregues = (pedidos || []).filter((p: any) => p.status === "entregue");
      const total = pedidosEntregues.reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);
      const count = pedidosEntregues.length;

      setFaturamento(total);
      setVendasCount(count);
      setTicketMedio(count > 0 ? total / count : 0);
      setPedidosEntreguesCount(count);
    } catch (error: any) {
      console.error("Erro ao carregar resumo PDV:", error);
      toast.error("Erro ao carregar Caixa/PDV");
    } finally {
      setLoadingResumo(false);
    }
  }, [dateRange.end, dateRange.start]);

  useEffect(() => {
    if (isMasterAccount === null) return;
    if (!isMasterAccount) return;
    refreshResumo();
  }, [isMasterAccount, refreshResumo]);

  const [tipo, setTipo] = useState<MovimentacaoLocal["tipo"]>("entrada");
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");

  const adicionarMovimentacaoLocal = async () => {
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const item: MovimentacaoLocal = {
      id: crypto.randomUUID(),
      tipo,
      valor: v,
      descricao: descricao.trim(),
      created_at: new Date().toISOString(),
    };

    const next = [item, ...movimentacoesLocal];
    setMovimentacoesLocal(next);
    saveLocal(next);
    setValor("");
    setDescricao("");
    toast.success("Movimentação adicionada (local)");
  };

  if (checkingAccess) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isMasterAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground max-w-md">
          Esta área é exclusiva para contas master. Entre em contato com o administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Caixa/PDV</h1>
        <p className="text-muted-foreground">
          Faturamento e base de entradas/saídas (usando dados existentes do sistema).
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Resumo</span>
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="gap-2">
            <ArrowDownUp className="h-4 w-4" />
            <span className="hidden sm:inline">Entradas/Saídas</span>
          </TabsTrigger>
          <TabsTrigger value="periodo" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Período</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="flex items-center gap-3">
            <Label className="text-sm text-muted-foreground">Período</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={period === "hoje" ? "default" : "outline"} onClick={() => setPeriod("hoje")}>
                Hoje
              </Button>
              <Button
                size="sm"
                variant={period === "mes" ? "default" : "outline"}
                onClick={() => setPeriod("mes")}
              >
                Este mês
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Faturamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-sm text-muted-foreground">Baseado em pedidos com status `entregue`</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Ticket médio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-sm text-muted-foreground">{vendasCount} pedido(s)</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Entregues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{pedidosEntreguesCount}</div>
                <div className="text-sm text-muted-foreground">Pedidos com status `entregue`</div>
              </CardContent>
            </Card>
          </div>

          {loadingResumo && <div className="text-muted-foreground text-sm">Atualizando...</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Saldo (local)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {saldo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Entradas: {entradas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} • Saídas:{" "}
                  {saidas.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Atualizar</CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={refreshResumo} disabled={loadingResumo}>
                  Atualizar resumo
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="movimentacoes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Adicionar movimentação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant={tipo === "entrada" ? "default" : "outline"}
                      onClick={() => setTipo("entrada")}
                      size="sm"
                    >
                      Entrada
                    </Button>
                    <Button
                      type="button"
                      variant={tipo === "saida" ? "default" : "outline"}
                      onClick={() => setTipo("saida")}
                      size="sm"
                    >
                      Saída
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input value={valor} onChange={(e) => setValor(e.target.value)} type="number" step="0.01" />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: compra de insumos" />
                </div>

                <Button onClick={adicionarMovimentacaoLocal} disabled={!valor}>
                  Adicionar (local)
                </Button>
                <div className="text-xs text-muted-foreground">
                  Observação: entradas/saídas ainda não são persistidas no banco. Se você quiser, eu preparo as migrations/BD para isso.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Últimas movimentações</CardTitle>
              </CardHeader>
              <CardContent>
                {movimentacoesLocal.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma movimentação local adicionada.</div>
                ) : (
                  <div className="space-y-3">
                    {movimentacoesLocal.slice(0, 12).map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {m.tipo === "entrada" ? "Entrada" : "Saída"}
                            {m.descricao ? ` • ${m.descricao}` : ""}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("pt-BR")}
                          </div>
                        </div>
                        <div className={m.tipo === "entrada" ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          {m.tipo === "entrada" ? "+" : "-"}{" "}
                          {m.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="periodo">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Como o período funciona</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                A parte de faturamento agora usa a tabela `pedidos`.
              </p>
              <p>
                O resumo considera pedidos com status `entregue` dentro do período selecionado.
              </p>
              <p>
                Se você quiser o PDV 100% correto (pedido por pedido, pagamento por pagamento, entradas/saídas persistidas), precisamos criar/ajustar tabelas no Supabase.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

