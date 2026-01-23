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
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  Filter,
  FileText,
  Download
} from 'lucide-react';
import { BillingInvoice, CompanySubscription } from '@/hooks/useFinanceiro';
import { NovaFaturaDialog } from './NovaFaturaDialog';
import { RegistrarPagamentoDialog } from './RegistrarPagamentoDialog';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FaturasManagerProps {
  invoices: BillingInvoice[];
  subscriptions: CompanySubscription[];
  loading?: boolean;
  onCreateInvoice: (data: Partial<BillingInvoice>) => Promise<any>;
  onUpdateInvoice: (id: string, data: Partial<BillingInvoice>) => Promise<boolean>;
  onMarkAsPaid: (invoiceId: string, paymentMethod?: string) => Promise<boolean>;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function getStatusBadge(status: string, dueDate: string) {
  // Check if overdue
  if (status === 'pending' && isAfter(new Date(), parseISO(dueDate))) {
    return (
      <Badge variant="destructive" className="flex items-center w-fit">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Em Atraso
      </Badge>
    );
  }

  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    pending: { label: 'Pendente', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
    paid: { label: 'Pago', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    overdue: { label: 'Em Atraso', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    cancelled: { label: 'Cancelada', variant: 'secondary', icon: <XCircle className="h-3 w-3 mr-1" /> },
    refunded: { label: 'Reembolsada', variant: 'secondary', icon: <XCircle className="h-3 w-3 mr-1" /> }
  };

  const config = configs[status] || configs.pending;
  
  return (
    <Badge variant={config.variant} className="flex items-center w-fit">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function FaturasManager({
  invoices,
  subscriptions,
  loading,
  onCreateInvoice,
  onUpdateInvoice,
  onMarkAsPaid
}: FaturasManagerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [novaFaturaOpen, setNovaFaturaOpen] = useState(false);
  const [registrarPagamentoOpen, setRegistrarPagamentoOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<BillingInvoice | null>(null);

  const filteredInvoices = invoices.filter(invoice => {
    const matchSearch = invoice.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
                       invoice.invoice_number?.toLowerCase().includes(search.toLowerCase());
    
    let matchStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    // Handle overdue filter
    if (statusFilter === 'overdue') {
      matchStatus = invoice.status === 'pending' && isAfter(new Date(), parseISO(invoice.due_date));
    }
    
    return matchSearch && matchStatus;
  });

  const handleMarkAsPaid = (invoice: BillingInvoice) => {
    setSelectedInvoice(invoice);
    setRegistrarPagamentoOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Faturas</CardTitle>
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
          <CardTitle>Faturas ({invoices.length})</CardTitle>
          <Button onClick={() => setNovaFaturaOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Fatura
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por empresa ou número..."
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
                <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                  Pendentes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('paid')}>
                  Pagas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('overdue')}>
                  Em Atraso
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('cancelled')}>
                  Canceladas
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma fatura encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pago em</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-sm">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.company?.name || 'N/A'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {invoice.description || '-'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status, invoice.due_date)}
                      </TableCell>
                      <TableCell>
                        {invoice.paid_at 
                          ? format(new Date(invoice.paid_at), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {invoice.status === 'pending' && (
                              <DropdownMenuItem onClick={() => handleMarkAsPaid(invoice)}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Registrar Pagamento
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Baixar PDF
                            </DropdownMenuItem>
                            {invoice.status === 'pending' && (
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => onUpdateInvoice(invoice.id, { status: 'cancelled' })}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Cancelar
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

      <NovaFaturaDialog
        open={novaFaturaOpen}
        onOpenChange={setNovaFaturaOpen}
        subscriptions={subscriptions}
        onSubmit={onCreateInvoice}
      />

      {selectedInvoice && (
        <RegistrarPagamentoDialog
          open={registrarPagamentoOpen}
          onOpenChange={setRegistrarPagamentoOpen}
          invoice={selectedInvoice}
          onConfirm={onMarkAsPaid}
        />
      )}
    </>
  );
}
