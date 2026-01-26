import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, 
  MoreHorizontal, 
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  AlertTriangle,
  Users,
  FileText
} from 'lucide-react';
import { CompanySubscription, BillingPlan } from '@/hooks/useFinanceiro';
import { NovaAssinaturaDialog } from './NovaAssinaturaDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Subconta {
  id: string;
  name: string;
  cnpj: string | null;
  status: string;
  plan: string | null;
  max_users: number;
  max_leads: number;
  created_at: string;
  subscription?: CompanySubscription;
}

interface SubcontasFinanceiroManagerProps {
  subscriptions: CompanySubscription[];
  plans: BillingPlan[];
  loading?: boolean;
  onCreateSubscription: (data: Partial<CompanySubscription>) => Promise<any>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    ativo: { label: 'Ativo', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    active: { label: 'Ativo', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    inativo: { label: 'Inativo', variant: 'secondary', icon: <XCircle className="h-3 w-3 mr-1" /> },
    inactive: { label: 'Inativo', variant: 'secondary', icon: <XCircle className="h-3 w-3 mr-1" /> },
    trial: { label: 'Trial', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
    suspenso: { label: 'Suspenso', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    suspended: { label: 'Suspenso', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> }
  };

  const config = configs[status?.toLowerCase()] || { label: status || 'N/A', variant: 'outline' as const, icon: null };
  
  return (
    <Badge variant={config.variant} className="flex items-center w-fit">
      {config.icon}
      {config.label}
    </Badge>
  );
}

function getSubscriptionStatusBadge(subscription?: CompanySubscription) {
  if (!subscription) {
    return (
      <Badge variant="outline" className="flex items-center w-fit text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        Sem assinatura
      </Badge>
    );
  }

  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    active: { label: 'Pagante', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    trial: { label: 'Trial', variant: 'secondary', icon: <Clock className="h-3 w-3 mr-1" /> },
    pending: { label: 'Pendente', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
    suspended: { label: 'Suspenso', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    cancelled: { label: 'Cancelado', variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> }
  };

  const config = configs[subscription.status] || configs.pending;
  
  return (
    <Badge variant={config.variant} className="flex items-center w-fit">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function SubcontasFinanceiroManager({
  subscriptions,
  plans,
  loading,
  onCreateSubscription
}: SubcontasFinanceiroManagerProps) {
  const [search, setSearch] = useState('');
  const [subcontas, setSubcontas] = useState<Subconta[]>([]);
  const [loadingSubcontas, setLoadingSubcontas] = useState(true);
  const [novaAssinaturaOpen, setNovaAssinaturaOpen] = useState(false);
  const [selectedSubconta, setSelectedSubconta] = useState<Subconta | null>(null);

  // Load all subcontas
  useEffect(() => {
    loadSubcontas();
  }, [subscriptions]);

  const loadSubcontas = async () => {
    setLoadingSubcontas(true);
    try {
      // Get master company id
      const { data: masterData } = await supabase.rpc('get_my_company_id');
      if (!masterData) return;

      // Get all subcontas
      const { data: companies, error } = await supabase
        .from('companies')
        .select('id, name, cnpj, status, plan, max_users, max_leads, created_at')
        .eq('parent_company_id', masterData)
        .order('name');

      if (error) throw error;

      // Map subscriptions to subcontas
      const subcontasWithSubscriptions = (companies || []).map(company => {
        const subscription = subscriptions.find(s => s.company_id === company.id);
        return {
          ...company,
          subscription
        };
      });

      setSubcontas(subcontasWithSubscriptions);
    } catch (error) {
      console.error('Error loading subcontas:', error);
    } finally {
      setLoadingSubcontas(false);
    }
  };

  const filteredSubcontas = subcontas.filter(sub => 
    sub.name?.toLowerCase().includes(search.toLowerCase()) ||
    sub.cnpj?.includes(search)
  );

  const handleAddSubscription = (subconta: Subconta) => {
    setSelectedSubconta(subconta);
    setNovaAssinaturaOpen(true);
  };

  const handleAddTrial = async (subconta: Subconta) => {
    try {
      const trialDays = 14;
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);
      
      await onCreateSubscription({
        company_id: subconta.id,
        status: 'trial',
        monthly_value: 0,
        billing_cycle: 'monthly',
        start_date: new Date().toISOString(),
        trial_days: trialDays,
        trial_end_date: trialEndDate.toISOString().split('T')[0],
      });
      
      loadSubcontas();
    } catch (error) {
      console.error('Erro ao criar trial:', error);
    }
  };

  // Stats
  const stats = {
    total: subcontas.length,
    withSubscription: subcontas.filter(s => s.subscription).length,
    active: subcontas.filter(s => s.subscription?.status === 'active').length,
    noSubscription: subcontas.filter(s => !s.subscription).length,
    mrr: subcontas.reduce((sum, s) => sum + Number(s.subscription?.monthly_value || 0), 0)
  };

  if (loading || loadingSubcontas) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subcontas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Subcontas</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Com Assinatura</p>
                <p className="text-2xl font-bold text-blue-600">{stats.withSubscription}</p>
              </div>
              <CreditCard className="h-8 w-8 text-blue-600/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pagantes Ativos</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-600/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sem Assinatura</p>
                <p className="text-2xl font-bold text-amber-600">{stats.noSubscription}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-600/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">MRR Total</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.mrr)}</p>
              </div>
              <FileText className="h-8 w-8 text-emerald-600/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Subcontas ({subcontas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredSubcontas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma subconta encontrada</p>
              <p className="text-sm mt-2">As subcontas criadas em Configurações aparecerão aqui</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Plano Sistema</TableHead>
                    <TableHead>Status Sistema</TableHead>
                    <TableHead>Status Financeiro</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubcontas.map((subconta) => (
                    <TableRow key={subconta.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {subconta.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {subconta.cnpj || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {subconta.plan || 'Não definido'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subconta.status)}
                      </TableCell>
                      <TableCell>
                        {getSubscriptionStatusBadge(subconta.subscription)}
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {subconta.subscription 
                          ? formatCurrency(subconta.subscription.monthly_value)
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {format(new Date(subconta.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {!subconta.subscription ? (
                              <>
                                <DropdownMenuItem onClick={() => handleAddSubscription(subconta)}>
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Criar Assinatura
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddTrial(subconta)}>
                                  <Clock className="h-4 w-4 mr-2" />
                                  Iniciar Trial
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem>
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver Assinatura
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Users className="h-4 w-4 mr-2" />
                                  Ver Usuários
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaAssinaturaDialog
        open={novaAssinaturaOpen}
        onOpenChange={(open) => {
          setNovaAssinaturaOpen(open);
          if (!open) setSelectedSubconta(null);
        }}
        plans={plans}
        onSubmit={onCreateSubscription}
      />
    </>
  );
}
