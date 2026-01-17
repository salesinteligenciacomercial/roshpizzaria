import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, Plus, DollarSign, TrendingUp, ShoppingCart, BarChart3, 
  Trophy, AlertTriangle, ArrowUpRight, ArrowDownRight, Loader2, RefreshCw,
  Eye, Pencil
} from "lucide-react";
import { toast } from "sonner";
import { Bar, Doughnut } from 'react-chartjs-2';

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco_sugerido: number | null;
  categoria: string | null;
  ativo: boolean;
}

interface ProductStats {
  id: string;
  nome: string;
  categoria: string | null;
  preco_sugerido: number | null;
  vendasCount: number;
  receitaTotal: number;
  ticketMedio: number;
  taxaConversao: number;
}

interface ProductsAnalyticsProps {
  userCompanyId: string | null;
  globalFilters: {
    period: string;
  };
}

export default function ProductsAnalytics({ userCompanyId, globalFilters }: ProductsAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productStats, setProductStats] = useState<ProductStats[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    descricao: "",
    preco_sugerido: "",
    categoria: ""
  });

  // KPIs
  const [kpis, setKpis] = useState({
    totalProducts: 0,
    activeProducts: 0,
    bestSeller: "",
    totalRevenue: 0,
    avgTicket: 0,
    totalSales: 0
  });

  const fetchData = useCallback(async () => {
    if (!userCompanyId) return;
    
    setLoading(true);
    try {
      // Calculate date filter
      let startDate: Date | null = null;
      if (globalFilters.period !== 'all') {
        const now = new Date();
        switch (globalFilters.period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            const quarterStart = Math.floor(now.getMonth() / 3) * 3;
            startDate = new Date(now.getFullYear(), quarterStart, 1);
            break;
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        }
      }

      // Fetch products
      const { data: productsData, error: productsError } = await supabase
        .from('produtos_servicos')
        .select('*')
        .eq('company_id', userCompanyId)
        .order('nome');

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Fetch leads with products (ganhos)
      let leadsQuery = supabase
        .from('leads')
        .select('id, value, produto_id, created_at')
        .eq('company_id', userCompanyId)
        .eq('status', 'ganho')
        .not('produto_id', 'is', null);

      if (startDate) {
        leadsQuery = leadsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: leadsData, error: leadsError } = await leadsQuery;
      if (leadsError) throw leadsError;

      // Fetch total leads with products for conversion rate
      let totalLeadsQuery = supabase
        .from('leads')
        .select('id, produto_id')
        .eq('company_id', userCompanyId)
        .not('produto_id', 'is', null);

      if (startDate) {
        totalLeadsQuery = totalLeadsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: totalLeadsData } = await totalLeadsQuery;

      // Calculate stats per product
      const statsMap = new Map<string, { count: number; revenue: number; totalLeads: number }>();
      
      // Initialize all products
      (productsData || []).forEach(p => {
        statsMap.set(p.id, { count: 0, revenue: 0, totalLeads: 0 });
      });

      // Count total leads per product
      (totalLeadsData || []).forEach(lead => {
        if (lead.produto_id) {
          const current = statsMap.get(lead.produto_id);
          if (current) {
            current.totalLeads++;
          }
        }
      });

      // Count won leads and revenue per product
      (leadsData || []).forEach(lead => {
        if (lead.produto_id) {
          const current = statsMap.get(lead.produto_id);
          if (current) {
            current.count++;
            current.revenue += Number(lead.value) || 0;
          }
        }
      });

      // Build stats array
      const stats: ProductStats[] = (productsData || []).map(p => {
        const s = statsMap.get(p.id) || { count: 0, revenue: 0, totalLeads: 0 };
        return {
          id: p.id,
          nome: p.nome,
          categoria: p.categoria,
          preco_sugerido: p.preco_sugerido,
          vendasCount: s.count,
          receitaTotal: s.revenue,
          ticketMedio: s.count > 0 ? s.revenue / s.count : 0,
          taxaConversao: s.totalLeads > 0 ? (s.count / s.totalLeads) * 100 : 0
        };
      }).sort((a, b) => b.receitaTotal - a.receitaTotal);

      setProductStats(stats);

      // Calculate KPIs
      const totalProducts = productsData?.length || 0;
      const activeProducts = productsData?.filter(p => p.ativo).length || 0;
      const totalRevenue = stats.reduce((sum, s) => sum + s.receitaTotal, 0);
      const totalSales = stats.reduce((sum, s) => sum + s.vendasCount, 0);
      const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
      const bestSeller = stats.length > 0 && stats[0].vendasCount > 0 ? stats[0].nome : "N/A";

      setKpis({
        totalProducts,
        activeProducts,
        bestSeller,
        totalRevenue,
        avgTicket,
        totalSales
      });

    } catch (error) {
      console.error('[ProductsAnalytics] Error fetching data:', error);
      toast.error('Erro ao carregar dados de produtos');
    } finally {
      setLoading(false);
    }
  }, [userCompanyId, globalFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        nome: product.nome,
        descricao: product.descricao || "",
        preco_sugerido: product.preco_sugerido?.toString() || "",
        categoria: product.categoria || ""
      });
    } else {
      setEditingProduct(null);
      setFormData({ nome: "", descricao: "", preco_sugerido: "", categoria: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome: formData.nome.trim(),
        descricao: formData.descricao.trim() || null,
        preco_sugerido: formData.preco_sugerido ? parseFloat(formData.preco_sugerido) : null,
        categoria: formData.categoria.trim() || null,
        company_id: userCompanyId,
        ativo: true
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('produtos_servicos')
          .update(payload)
          .eq('id', editingProduct.id);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase
          .from('produtos_servicos')
          .insert(payload);
        if (error) throw error;
        toast.success('Produto criado!');
      }

      setDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('[ProductsAnalytics] Error saving:', error);
      toast.error('Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Chart data for revenue by product
  const top5Products = productStats.slice(0, 5);
  const barChartData = {
    labels: top5Products.map(p => p.nome.length > 15 ? p.nome.slice(0, 15) + '...' : p.nome),
    datasets: [
      {
        label: 'Receita',
        data: top5Products.map(p => p.receitaTotal),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ],
        borderRadius: 8
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => formatCurrency(context.raw)
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value)
        }
      }
    }
  };

  // Donut chart for sales distribution
  const donutChartData = {
    labels: top5Products.map(p => p.nome),
    datasets: [
      {
        data: top5Products.map(p => p.vendasCount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(236, 72, 153, 0.8)'
        ],
        borderWidth: 0
      }
    ]
  };

  const donutChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          usePointStyle: true,
          padding: 15
        }
      }
    },
    cutout: '60%'
  };

  // Products without sales
  const productsWithoutSales = productStats.filter(p => p.vendasCount === 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with action button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" />
            Produtos & Serviços
          </h2>
          <p className="text-muted-foreground">Análise de performance por produto/serviço</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Produto
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalProducts}</div>
            <p className="text-xs text-muted-foreground">{kpis.activeProducts} ativos</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mais Vendido</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{kpis.bestSeller}</div>
            <p className="text-xs text-muted-foreground">{kpis.totalSales} vendas no período</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Vendas finalizadas</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.avgTicket)}</div>
            <p className="text-xs text-muted-foreground">Por venda</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Receita por Produto (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top5Products.length > 0 ? (
              <div className="h-[280px]">
                <Bar data={barChartData} options={barChartOptions} />
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Sem dados de vendas no período</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Distribuição de Vendas (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {top5Products.some(p => p.vendasCount > 0) ? (
              <div className="h-[280px]">
                <Doughnut data={donutChartData} options={donutChartOptions} />
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Sem dados de vendas no período</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Products without sales alert */}
      {productsWithoutSales.length > 0 && (
        <Card className="border-0 shadow-card border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Produtos sem vendas no período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {productsWithoutSales.slice(0, 10).map(p => (
                <Badge key={p.id} variant="outline" className="text-yellow-600 border-yellow-300">
                  {p.nome}
                </Badge>
              ))}
              {productsWithoutSales.length > 10 && (
                <Badge variant="secondary">+{productsWithoutSales.length - 10} mais</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed table */}
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle>Tabela Detalhada de Produtos</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço Sugerido</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Ticket Médio</TableHead>
                  <TableHead className="text-center">Conversão</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum produto cadastrado. Clique em "Novo Produto" para começar.
                    </TableCell>
                  </TableRow>
                ) : (
                  productStats.map((stat, index) => (
                    <TableRow key={stat.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {index === 0 && stat.vendasCount > 0 && (
                            <Trophy className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="font-medium">{stat.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {stat.categoria && (
                          <Badge variant="secondary">{stat.categoria}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.preco_sugerido ? formatCurrency(stat.preco_sugerido) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {stat.vendasCount}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(stat.receitaTotal)}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.vendasCount > 0 ? formatCurrency(stat.ticketMedio) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={stat.taxaConversao >= 50 ? "default" : "secondary"}>
                          {stat.taxaConversao.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => {
                            const product = products.find(p => p.id === stat.id);
                            if (product) handleOpenDialog(product);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Atualize as informações do produto.' : 'Cadastre um novo produto ou serviço.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome do produto/serviço"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição do produto/serviço"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preco">Preço Sugerido</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.preco_sugerido}
                  onChange={(e) => setFormData({ ...formData, preco_sugerido: e.target.value })}
                  placeholder="0,00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ex: Serviço, Produto"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingProduct ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
