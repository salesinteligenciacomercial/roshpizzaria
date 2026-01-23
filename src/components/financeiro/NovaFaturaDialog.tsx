import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { BillingInvoice, CompanySubscription } from '@/hooks/useFinanceiro';
import { Loader2 } from 'lucide-react';

interface NovaFaturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptions: CompanySubscription[];
  onSubmit: (data: Partial<BillingInvoice>) => Promise<any>;
}

export function NovaFaturaDialog({
  open,
  onOpenChange,
  subscriptions,
  onSubmit
}: NovaFaturaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    subscription_id: '',
    amount: '',
    due_date: '',
    description: '',
    notes: ''
  });

  const handleSubscriptionChange = (subscriptionId: string) => {
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (subscription) {
      // Default due date to next billing date or 30 days from now
      const dueDate = subscription.next_billing_date || 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      setFormData(prev => ({
        ...prev,
        subscription_id: subscriptionId,
        amount: subscription.monthly_value?.toString() || '',
        due_date: dueDate,
        description: `Mensalidade - ${subscription.billing_plan?.name || 'Plano'}`
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.subscription_id || !formData.amount || !formData.due_date) return;

    const subscription = subscriptions.find(s => s.id === formData.subscription_id);
    if (!subscription) return;

    setLoading(true);
    try {
      await onSubmit({
        subscription_id: formData.subscription_id,
        company_id: subscription.company_id,
        amount: parseFloat(formData.amount),
        due_date: formData.due_date,
        description: formData.description || null,
        notes: formData.notes || null,
        status: 'pending'
      });

      onOpenChange(false);
      setFormData({
        subscription_id: '',
        amount: '',
        due_date: '',
        description: '',
        notes: ''
      });
    } finally {
      setLoading(false);
    }
  };

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Fatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Assinatura *</Label>
            <Select
              value={formData.subscription_id}
              onValueChange={handleSubscriptionChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a assinatura" />
              </SelectTrigger>
              <SelectContent>
                {activeSubscriptions.map(subscription => (
                  <SelectItem key={subscription.id} value={subscription.id}>
                    {subscription.company?.name} - R$ {subscription.monthly_value}/mês
                  </SelectItem>
                ))}
                {activeSubscriptions.length === 0 && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Nenhuma assinatura ativa
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              placeholder="Ex: Mensalidade - Plano Professional"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Notas adicionais..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || !formData.subscription_id || !formData.amount || !formData.due_date}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Fatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
