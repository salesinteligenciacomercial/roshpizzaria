import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  RefreshCw, 
  Link2, 
  Unlink, 
  CreditCard, 
  Building2, 
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Zap,
  QrCode,
  FileText,
  Receipt
} from 'lucide-react';
import { useAsaas } from '@/hooks/useAsaas';
import { CompanySubscription, BillingInvoice } from '@/hooks/useFinanceiro';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AsaasIntegrationProps {
  subscriptions: CompanySubscription[];
  invoices: BillingInvoice[];
  onRefresh: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export function AsaasIntegration({ subscriptions, invoices, onRefresh }: AsaasIntegrationProps) {
  const { 
    loading, 
    syncCustomer, 
    syncSubscription, 
    generatePayment, 
    checkPaymentStatus 
  } = useAsaas();
  
  const [syncing, setSyncing] = useState<string | null>(null);
  const [generatePaymentOpen, setGeneratePaymentOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<CompanySubscription | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    billingType: 'PIX',
    value: '',
    dueDate: '',
    description: '',
  });

  // Subcontas que podem ser sincronizadas (têm assinatura ativa)
  const syncableSubscriptions = subscriptions.filter(s => s.status === 'active');
  
  // Subcontas sincronizadas com Asaas
  const syncedSubscriptions = subscriptions.filter(s => s.external_customer_id);

  const handleSyncCustomer = async (subscription: CompanySubscription) => {
    setSyncing(subscription.id);
    try {
      await syncCustomer(subscription.company_id);
      toast.success('Cliente sincronizado com Asaas!');
      onRefresh();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncSubscription = async (subscription: CompanySubscription) => {
    if (!subscription.external_customer_id) {
      toast.error('Sincronize o cliente primeiro');
      return;
    }
    
    setSyncing(subscription.id);
    try {
      await syncSubscription({
        ...subscription,
        company_name: subscription.company?.name,
      });
      toast.success('Assinatura sincronizada com Asaas!');
      onRefresh();
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(null);
    }
  };

  const handleOpenGeneratePayment = (subscription: CompanySubscription) => {
    setSelectedSubscription(subscription);
    setPaymentForm({
      billingType: 'PIX',
      value: subscription.monthly_value.toString(),
      dueDate: format(new Date(subscription.next_billing_date || new Date()), 'yyyy-MM-dd'),
      description: `Mensalidade CRM - ${subscription.company?.name}`,
    });
    setGeneratePaymentOpen(true);
  };

  const handleGeneratePayment = async () => {
    if (!selectedSubscription?.external_customer_id) {
      toast.error('Cliente não sincronizado com Asaas');
      return;
    }

    try {
      const result = await generatePayment({
        customer_id: selectedSubscription.external_customer_id,
        amount: parseFloat(paymentForm.value),
        due_date: paymentForm.dueDate,
        payment_method: paymentForm.billingType.toLowerCase(),
        description: paymentForm.description,
      });
      
      if (result?.invoiceUrl || result?.bankSlipUrl || result?.pixQrCodeUrl) {
        toast.success('Cobrança gerada com sucesso!');
        window.open(result.invoiceUrl || result.bankSlipUrl || result.pixQrCodeUrl, '_blank');
      }
      
      setGeneratePaymentOpen(false);
      onRefresh();
    } catch (error) {
      console.error('Generate payment error:', error);
    }
  };

  const handleCheckPaymentStatus = async (invoice: BillingInvoice) => {
    if (!invoice.external_invoice_id) {
      toast.error('Fatura não vinculada ao Asaas');
      return;
    }

    try {
      const result = await checkPaymentStatus(invoice.external_invoice_id);
      toast.success(`Status atualizado: ${result.status}`);
      onRefresh();
    } catch (error) {
      console.error('Check status error:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Subcontas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sincronizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {syncedSubscriptions.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendentes Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {syncableSubscriptions.length - syncedSubscriptions.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturas Asaas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {invoices.filter(i => i.external_invoice_id).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Integração Asaas
              </CardTitle>
              <CardDescription>
                Sincronize subcontas e gerencie cobranças automáticas
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {syncableSubscriptions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma assinatura ativa para sincronizar</p>
              <p className="text-sm mt-2">
                Crie assinaturas na aba "Subcontas" primeiro
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Cliente Asaas</TableHead>
                    <TableHead>Assinatura Asaas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncableSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium">
                        {subscription.company?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {subscription.billing_plan?.name || 'Personalizado'}
                      </TableCell>
                      <TableCell>
                        {formatCurrency(subscription.monthly_value)}
                      </TableCell>
                      <TableCell>
                        {subscription.external_customer_id ? (
                          <Badge variant="default" className="flex items-center w-fit">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Sincronizado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center w-fit">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Não sincronizado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {subscription.external_subscription_id ? (
                          <Badge variant="default" className="flex items-center w-fit">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Ativa
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="flex items-center w-fit">
                            <Unlink className="h-3 w-3 mr-1" />
                            Não vinculada
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!subscription.external_customer_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSyncCustomer(subscription)}
                              disabled={syncing === subscription.id}
                            >
                              {syncing === subscription.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Sincronizar Cliente
                                </>
                              )}
                            </Button>
                          ) : !subscription.external_subscription_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSyncSubscription(subscription)}
                              disabled={syncing === subscription.id}
                            >
                              {syncing === subscription.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Criar Assinatura
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenGeneratePayment(subscription)}
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              Gerar Cobrança
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Faturas com link Asaas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cobranças Asaas
          </CardTitle>
          <CardDescription>
            Faturas vinculadas ao gateway de pagamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.filter(i => i.external_invoice_id).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <QrCode className="h-10 w-10 mx-auto mb-4 opacity-50" />
              <p>Nenhuma cobrança gerada no Asaas</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fatura</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices
                    .filter(i => i.external_invoice_id)
                    .map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono text-sm">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>{invoice.company?.name}</TableCell>
                        <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                        <TableCell>
                          {format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={invoice.status === 'paid' ? 'default' : 'outline'}>
                            {invoice.status === 'paid' ? 'Pago' : 'Pendente'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCheckPaymentStatus(invoice)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            {invoice.external_payment_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(invoice.external_payment_url!, '_blank')}
                              >
                                <ExternalLink className="h-4 w-4 mr-1" />
                                Ver Cobrança
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Payment Dialog */}
      <Dialog open={generatePaymentOpen} onOpenChange={setGeneratePaymentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Cobrança Asaas</DialogTitle>
            <DialogDescription>
              Crie uma cobrança para {selectedSubscription?.company?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Cobrança</Label>
              <Select
                value={paymentForm.billingType}
                onValueChange={(v) => setPaymentForm(p => ({ ...p, billingType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentForm.value}
                onChange={(e) => setPaymentForm(p => ({ ...p, value: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input
                type="date"
                value={paymentForm.dueDate}
                onChange={(e) => setPaymentForm(p => ({ ...p, dueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={paymentForm.description}
                onChange={(e) => setPaymentForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGeneratePaymentOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGeneratePayment} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Gerar Cobrança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
