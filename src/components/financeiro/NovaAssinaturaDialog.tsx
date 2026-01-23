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
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface NovaAssinaturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: BillingPlan[];
  onSubmit: (data: Partial<CompanySubscription>) => Promise<any>;
}

interface Company {
  id: string;
  name: string;
  cnpj: string | null;
}

export function NovaAssinaturaDialog({
  open,
  onOpenChange,
  plans,
  onSubmit
}: NovaAssinaturaDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [formData, setFormData] = useState({
    company_id: '',
    billing_plan_id: '',
    billing_cycle: 'monthly' as 'monthly' | 'annual',
    monthly_value: '',
    setup_fee_value: '',
    setup_fee_paid: false,
    payment_method: 'manual' as 'pix' | 'boleto' | 'cartao' | 'manual' | 'stripe' | 'asaas',
    notes: ''
  });

  // Load subcontas (companies without subscription)
  useEffect(() => {
    if (open) {
      loadCompanies();
    }
  }, [open]);

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      // Get master company id
      const { data: masterData } = await supabase.rpc('get_my_company_id');
      if (!masterData) return;

      // Get all subcontas
      const { data: subcontas, error } = await supabase
        .from('companies')
        .select('id, name, cnpj')
        .eq('parent_company_id', masterData)
        .order('name');

      if (error) throw error;

      // Get existing subscriptions
      const { data: existingSubscriptions } = await supabase
        .from('company_subscriptions')
        .select('company_id')
        .eq('master_company_id', masterData);

      const existingCompanyIds = new Set(existingSubscriptions?.map(s => s.company_id) || []);
      
      // Filter out companies that already have subscriptions
      const availableCompanies = (subcontas || []).filter(c => !existingCompanyIds.has(c.id));
      
      setCompanies(availableCompanies);
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handlePlanChange = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (plan) {
      setFormData(prev => ({
        ...prev,
        billing_plan_id: planId,
        monthly_value: plan.monthly_price.toString(),
        setup_fee_value: plan.setup_fee.toString()
      }));
    }
  };

  const handleSubmit = async () => {
    if (!formData.company_id) return;

    setLoading(true);
    try {
      // Calculate next billing date (1 month from now)
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      await onSubmit({
        company_id: formData.company_id,
        billing_plan_id: formData.billing_plan_id || null,
        billing_cycle: formData.billing_cycle,
        monthly_value: parseFloat(formData.monthly_value) || 0,
        setup_fee_value: parseFloat(formData.setup_fee_value) || 0,
        setup_fee_paid: formData.setup_fee_paid,
        payment_method: formData.payment_method,
        notes: formData.notes || null,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
        next_billing_date: nextBillingDate.toISOString().split('T')[0]
      });

      onOpenChange(false);
      setFormData({
        company_id: '',
        billing_plan_id: '',
        billing_cycle: 'monthly',
        monthly_value: '',
        setup_fee_value: '',
        setup_fee_paid: false,
        payment_method: 'manual',
        notes: ''
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Assinatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Subconta *</Label>
            <Select
              value={formData.company_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, company_id: value }))}
              disabled={loadingCompanies}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCompanies ? "Carregando..." : "Selecione a subconta"} />
              </SelectTrigger>
              <SelectContent>
                {companies.map(company => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                    {company.cnpj && <span className="text-muted-foreground ml-2">({company.cnpj})</span>}
                  </SelectItem>
                ))}
                {companies.length === 0 && !loadingCompanies && (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Todas as subcontas já possuem assinatura
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

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
            disabled={loading || !formData.company_id || !formData.monthly_value}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
