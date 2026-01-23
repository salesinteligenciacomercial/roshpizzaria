import { useState } from 'react';
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
  Plus, 
  Search, 
  MoreHorizontal, 
  Edit, 
  FileText, 
  XCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { CompanySubscription, BillingPlan } from '@/hooks/useFinanceiro';
import { NovaAssinaturaDialog } from './NovaAssinaturaDialog';
import { EditarAssinaturaDialog } from './EditarAssinaturaDialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AssinaturasManagerProps {
  subscriptions: CompanySubscription[];
  plans: BillingPlan[];
  loading?: boolean;
  onCreateSubscription: (data: Partial<CompanySubscription>) => Promise<any>;
  onUpdateSubscription: (id: string, data: Partial<CompanySubscription>) => Promise<boolean>;
  onCreateInvoice: (data: any) => Promise<any>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    active: { label: 'Ativo', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    trial: { label: 'Trial', variant: 'secondary', icon: <Clock className="h-3 w-3 mr-1" /> },
    pending: { label: 'Pendente', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
    suspended: { label: 'Suspenso', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    cancelled: { label: 'Cancelado', variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> }
  };

  const config = configs[status] || configs.pending;
  
  return (
    <Badge variant={config.variant} className="flex items-center w-fit">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function AssinaturasManager({
  subscriptions,
  plans,
  loading,
  onCreateSubscription,
  onUpdateSubscription,
  onCreateInvoice
}: AssinaturasManagerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [novaAssinaturaOpen, setNovaAssinaturaOpen] = useState(false);
  const [editarAssinaturaOpen, setEditarAssinaturaOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<CompanySubscription | null>(null);

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchSearch = sub.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
                       sub.billing_plan?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleEdit = (subscription: CompanySubscription) => {
    setSelectedSubscription(subscription);
    setEditarAssinaturaOpen(true);
  };

  const handleGenerateInvoice = async (subscription: CompanySubscription) => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    await onCreateInvoice({
      subscription_id: subscription.id,
      company_id: subscription.company_id,
      amount: subscription.monthly_value,
      due_date: subscription.next_billing_date || nextMonth.toISOString().split('T')[0],
      description: `Mensalidade - ${subscription.billing_plan?.name || 'Plano'}`
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assinaturas</CardTitle>
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Assinaturas ({subscriptions.length})</CardTitle>
          <Button onClick={() => setNovaAssinaturaOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Assinatura
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa ou plano..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="h-4 w-4 mr-2" />
                  {statusFilter === 'all' ? 'Todos os status' : statusFilter}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  Todos os status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                  Ativos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('trial')}>
                  Trial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                  Pendentes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('suspended')}>
                  Suspensos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('cancelled')}>
                  Cancelados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {filteredSubscriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Nenhuma assinatura encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor Mensal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Próximo Vencimento</TableHead>
                    <TableHead>Taxa Setup</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">
                        {subscription.company?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {subscription.billing_plan?.name || 'Personalizado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-emerald-600">
                        {formatCurrency(subscription.monthly_value)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(subscription.status)}
                      </TableCell>
                      <TableCell>
                        {subscription.next_billing_date 
                          ? format(new Date(subscription.next_billing_date), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {subscription.setup_fee_paid ? (
                          <Badge variant="default" className="bg-emerald-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Pago
                          </Badge>
                        ) : subscription.setup_fee_value && subscription.setup_fee_value > 0 ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatCurrency(subscription.setup_fee_value)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(subscription)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleGenerateInvoice(subscription)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Gerar Fatura
                            </DropdownMenuItem>
                            {subscription.status === 'active' && (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => onUpdateSubscription(subscription.id, { status: 'suspended' })}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Suspender
                              </DropdownMenuItem>
                            )}
                            {subscription.status === 'suspended' && (
                              <DropdownMenuItem 
                                onClick={() => onUpdateSubscription(subscription.id, { status: 'active' })}
                              >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Reativar
                              </DropdownMenuItem>
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
        onOpenChange={setNovaAssinaturaOpen}
        plans={plans}
        onSubmit={onCreateSubscription}
      />

      {selectedSubscription && (
        <EditarAssinaturaDialog
          open={editarAssinaturaOpen}
          onOpenChange={setEditarAssinaturaOpen}
          subscription={selectedSubscription}
          plans={plans}
          onSubmit={(data) => onUpdateSubscription(selectedSubscription.id, data)}
        />
      )}
    </>
  );
}
