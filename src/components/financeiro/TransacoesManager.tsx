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
  Search, 
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Filter,
  Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BillingTransaction } from '@/hooks/useFinanceiro';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransacoesManagerProps {
  transactions: BillingTransaction[];
  loading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function getTypeBadge(type: string) {
  const configs: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    payment: { label: 'Pagamento', icon: <ArrowDownCircle className="h-3 w-3 mr-1" />, color: 'text-emerald-600' },
    refund: { label: 'Reembolso', icon: <ArrowUpCircle className="h-3 w-3 mr-1" />, color: 'text-amber-600' },
    chargeback: { label: 'Chargeback', icon: <AlertTriangle className="h-3 w-3 mr-1" />, color: 'text-red-600' },
    setup_fee: { label: 'Taxa Setup', icon: <ArrowDownCircle className="h-3 w-3 mr-1" />, color: 'text-purple-600' },
    adjustment: { label: 'Ajuste', icon: <RefreshCcw className="h-3 w-3 mr-1" />, color: 'text-blue-600' }
  };

  const config = configs[type] || configs.payment;
  
  return (
    <Badge variant="outline" className={`flex items-center w-fit ${config.color}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    confirmed: { label: 'Confirmado', variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
    pending: { label: 'Pendente', variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
    failed: { label: 'Falhou', variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
    cancelled: { label: 'Cancelado', variant: 'secondary', icon: <XCircle className="h-3 w-3 mr-1" /> }
  };

  const config = configs[status] || configs.pending;
  
  return (
    <Badge variant={config.variant} className="flex items-center w-fit">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export function TransacoesManager({
  transactions,
  loading
}: TransacoesManagerProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredTransactions = transactions.filter(transaction => {
    const matchSearch = transaction.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
                       transaction.notes?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || transaction.type === typeFilter;
    return matchSearch && matchType;
  });

  // Calculate totals
  const totals = transactions.reduce((acc, t) => {
    if (t.status === 'confirmed') {
      if (t.type === 'payment' || t.type === 'setup_fee') {
        acc.received += t.amount;
      } else if (t.type === 'refund' || t.type === 'chargeback') {
        acc.refunded += t.amount;
      }
    }
    return acc;
  }, { received: 0, refunded: 0 });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transações</CardTitle>
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Transações ({transactions.length})</CardTitle>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-emerald-600">
              Recebido: {formatCurrency(totals.received)}
            </span>
            <span className="text-red-600">
              Reembolsado: {formatCurrency(totals.refunded)}
            </span>
          </div>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                {typeFilter === 'all' ? 'Todos os tipos' : typeFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setTypeFilter('all')}>
                Todos os tipos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('payment')}>
                Pagamentos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('setup_fee')}>
                Taxa Setup
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('refund')}>
                Reembolsos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter('chargeback')}>
                Chargebacks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCcw className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma transação encontrada</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {format(new Date(transaction.payment_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.company?.name || 'N/A'}
                    </TableCell>
                    <TableCell>
                      {getTypeBadge(transaction.type)}
                    </TableCell>
                    <TableCell className={`font-semibold ${
                      transaction.type === 'refund' || transaction.type === 'chargeback' 
                        ? 'text-red-600' 
                        : 'text-emerald-600'
                    }`}>
                      {transaction.type === 'refund' || transaction.type === 'chargeback' ? '-' : '+'}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(transaction.status)}
                    </TableCell>
                    <TableCell className="capitalize">
                      {transaction.payment_method || '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {transaction.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
