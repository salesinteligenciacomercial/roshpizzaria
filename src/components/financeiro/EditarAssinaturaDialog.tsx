import { useState, useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { BillingPlan, CompanySubscription } from '@/hooks/useFinanceiro';
import { Loader2 } from 'lucide-react';

interface EditarAssinaturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: CompanySubscription;
  plans: BillingPlan[];
  onSubmit: (data: Partial<CompanySubscription>) => Promise<boolean>;
}

export function EditarAssinaturaDialog({
  open,
  onOpenChange,
  subscription,
  plans,
  onSubmit
}: EditarAssinaturaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    billing_plan_id: '',
    billing_cycle: 'monthly' as 'monthly' | 'annual',
    monthly_value: '',
    setup_fee_value: '',
    setup_fee_paid: false,
    payment_method: 'manual' as 'pix' | 'boleto' | 'cartao' | 'manual' | 'stripe' | 'asaas',
    status: 'active' as 'active' | 'cancelled' | 'suspended' | 'trial' | 'pending',
    next_billing_date: '',
    notes: ''
  });

  useEffect(() => {
    if (subscription) {
      setFormData({
        billing_plan_id: subscription.billing_plan_id || '',
        billing_cycle: subscription.billing_cycle,
        monthly_value: subscription.monthly_value?.toString() || '',
        setup_fee_value: subscription.setup_fee_value?.toString() || '',
        setup_fee_paid: subscription.setup_fee_paid,
        payment_method: subscription.payment_method,
        status: subscription.status,
        next_billing_date: subscription.next_billing_date || '',
        notes: subscription.notes || ''
      });
    }
  }, [subscription]);

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setFormData(prev => ({
        ...prev,
        billing_plan_id: planId,
        monthly_value: plan.monthly_price.toString()
      }));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const success = await onSubmit({
        billing_plan_id: formData.billing_plan_id || null,
        billing_cycle: formData.billing_cycle,
        monthly_value: parseFloat(formData.monthly_value) || 0,
        setup_fee_value: parseFloat(formData.setup_fee_value) || 0,
        setup_fee_paid: formData.setup_fee_paid,
        payment_method: formData.payment_method,
        status: formData.status,
        next_billing_date: formData.next_billing_date || null,
        notes: formData.notes || null
      });

      if (success) {
        onOpenChange(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Editar Assinatura - {subscription.company?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select
              value={formData.billing_plan_id}
              onValueChange={handlePlanChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um plano (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Personalizado</SelectItem>
                {plans.filter(p => p.is_active).map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name} - R$ {plan.monthly_price}/mês
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Mensal *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.monthly_value}
                onChange={(e) => setFormData(prev => ({ ...prev, monthly_value: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Ciclo</Label>
              <Select
                value={formData.billing_cycle}
                onValueChange={(value: 'monthly' | 'annual') => setFormData(prev => ({ ...prev, billing_cycle: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="annual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value: typeof formData.status) => setFormData(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Próximo Vencimento</Label>
            <Input
              type="date"
              value={formData.next_billing_date}
              onChange={(e) => setFormData(prev => ({ ...prev, next_billing_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Taxa de Setup</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={formData.setup_fee_value}
                onChange={(e) => setFormData(prev => ({ ...prev, setup_fee_value: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Setup Pago?</Label>
              <div className="flex items-center h-10">
                <Switch
                  checked={formData.setup_fee_paid}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, setup_fee_paid: checked }))}
                />
                <span className="ml-2 text-sm text-muted-foreground">
                  {formData.setup_fee_paid ? 'Sim' : 'Não'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Método de Pagamento</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value: typeof formData.payment_method) => setFormData(prev => ({ ...prev, payment_method: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
              </SelectContent>
            </Select>
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
            disabled={loading || !formData.monthly_value}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
