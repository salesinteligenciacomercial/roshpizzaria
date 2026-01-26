import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface BillingPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number | null;
  setup_fee: number;
  max_users: number;
  max_leads: number;
  max_messages: number;
  features: string[];
  is_active: boolean;
  company_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySubscription {
  id: string;
  company_id: string;
  billing_plan_id: string | null;
  status: 'active' | 'cancelled' | 'suspended' | 'trial' | 'pending';
  billing_cycle: 'monthly' | 'annual';
  start_date: string;
  next_billing_date: string | null;
  monthly_value: number;
  setup_fee_value: number;
  setup_fee_paid: boolean;
  payment_method: 'pix' | 'boleto' | 'cartao' | 'manual' | 'stripe' | 'asaas';
  external_subscription_id: string | null;
  external_customer_id: string | null;
  notes: string | null;
  master_company_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: {
    id: string;
    name: string;
    cnpj: string | null;
    status: string;
  };
  billing_plan?: BillingPlan;
}

export interface BillingInvoice {
  id: string;
  subscription_id: string | null;
  company_id: string;
  invoice_number: string;
  description: string | null;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  payment_method: string | null;
  external_invoice_id: string | null;
  external_payment_url: string | null;
  notes: string | null;
  master_company_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: {
    id: string;
    name: string;
  };
}

export interface BillingTransaction {
  id: string;
  invoice_id: string | null;
  subscription_id: string | null;
  company_id: string;
  amount: number;
  type: 'payment' | 'refund' | 'chargeback' | 'setup_fee' | 'adjustment';
  status: 'confirmed' | 'pending' | 'failed' | 'cancelled';
  payment_date: string;
  payment_method: string | null;
  external_transaction_id: string | null;
  receipt_url: string | null;
  notes: string | null;
  master_company_id: string | null;
  created_by: string | null;
  created_at: string;
  // Joined data
  company?: {
    id: string;
    name: string;
  };
}

export interface FinanceiroKPIs {
  mrr: number;
  mrrVariation: number;
  activeClients: number;
  paidThisMonth: number;
  pendingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  setupFeesYear: number;
  churnRate: number;
  avgLTV: number;
}

export function useFinanceiro() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [masterCompanyId, setMasterCompanyId] = useState<string | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [kpis, setKpis] = useState<FinanceiroKPIs>({
    mrr: 0,
    mrrVariation: 0,
    activeClients: 0,
    paidThisMonth: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    setupFeesYear: 0,
    churnRate: 0,
    avgLTV: 0
  });

  // Fetch master company ID
  const fetchMasterCompanyId = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_company_id');
      if (error) throw error;
      setMasterCompanyId(data);
      return data;
    } catch (error) {
      console.error('Erro ao buscar company_id:', error);
      return null;
    }
  }, []);

  // Fetch billing plans
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('billing_plans')
        .select('*')
        .order('monthly_price', { ascending: true });
      
      if (error) throw error;
      setPlans((data || []).map(p => ({
        ...p,
        features: Array.isArray(p.features) ? p.features.map(f => String(f)) : []
      })) as BillingPlan[]);
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
    }
  }, []);

  // Fetch subscriptions with company data
  const fetchSubscriptions = useCallback(async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          company:companies!company_subscriptions_company_id_fkey(id, name, cnpj, status),
          billing_plan:billing_plans(*)
        `)
        .eq('master_company_id', companyId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSubscriptions((data || []).map(s => ({
        ...s,
        billing_plan: s.billing_plan ? {
          ...s.billing_plan,
          features: Array.isArray(s.billing_plan.features) ? s.billing_plan.features.map((f: any) => String(f)) : []
        } : undefined
      })) as unknown as CompanySubscription[]);
    } catch (error) {
      console.error('Erro ao buscar assinaturas:', error);
    }
  }, []);

  // Fetch invoices
  const fetchInvoices = useCallback(async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('billing_invoices')
        .select(`
          *,
          company:companies!billing_invoices_company_id_fkey(id, name)
        `)
        .eq('master_company_id', companyId)
        .order('due_date', { ascending: false });
      
      if (error) throw error;
      setInvoices((data || []) as unknown as BillingInvoice[]);
    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = useCallback(async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('billing_transactions')
        .select(`
          *,
          company:companies!billing_transactions_company_id_fkey(id, name)
        `)
        .eq('master_company_id', companyId)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      setTransactions((data || []) as unknown as BillingTransaction[]);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
    }
  }, []);

  // Calculate KPIs
  const calculateKPIs = useCallback(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // MRR - soma de todas assinaturas ativas
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    const mrr = activeSubscriptions.reduce((sum, s) => sum + Number(s.monthly_value || 0), 0);

    // Clientes ativos
    const activeClients = activeSubscriptions.length;

    // Faturas pagas este mês
    const paidThisMonth = invoices
      .filter(i => i.status === 'paid' && i.paid_at && new Date(i.paid_at) >= startOfMonth)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    // Valor pendente
    const pendingAmount = invoices
      .filter(i => i.status === 'pending')
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);

    // Valor em atraso
    const overdueInvoices = invoices.filter(i => i.status === 'overdue');
    const overdueAmount = overdueInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
    const overdueCount = overdueInvoices.length;

    // Taxa de setup do ano - soma setup_fee_value de assinaturas pagas este ano
    const setupFeesYear = subscriptions
      .filter(s => 
        s.setup_fee_paid === true && 
        s.setup_fee_value && 
        s.setup_fee_value > 0 &&
        new Date(s.start_date) >= startOfYear
      )
      .reduce((sum, s) => sum + Number(s.setup_fee_value || 0), 0);

    // Churn rate (simplificado - baseado em assinaturas canceladas nos últimos 30 dias)
    const cancelledLastMonth = subscriptions.filter(s => 
      s.status === 'cancelled' && 
      new Date(s.updated_at) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    const totalSubs = subscriptions.length || 1;
    const churnRate = (cancelledLastMonth / totalSubs) * 100;

    // LTV médio (simplificado)
    const confirmedPayments = transactions.filter(t => 
      t.type === 'payment' && t.status === 'confirmed'
    );
    const avgLTV = activeClients > 0 
      ? confirmedPayments.reduce((sum, t) => sum + Number(t.amount || 0), 0) / activeClients 
      : 0;

    setKpis({
      mrr,
      mrrVariation: 0, // TODO: calcular com dados do mês anterior
      activeClients,
      paidThisMonth,
      pendingAmount,
      overdueAmount,
      overdueCount,
      setupFeesYear,
      churnRate,
      avgLTV
    });
  }, [subscriptions, invoices, transactions]);

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = await fetchMasterCompanyId();
      if (companyId) {
        await Promise.all([
          fetchPlans(),
          fetchSubscriptions(companyId),
          fetchInvoices(companyId),
          fetchTransactions(companyId)
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchMasterCompanyId, fetchPlans, fetchSubscriptions, fetchInvoices, fetchTransactions]);

  // Create subscription
  const createSubscription = async (data: Partial<CompanySubscription>) => {
    if (!masterCompanyId) return null;

    try {
      const insertData = {
        ...data,
        master_company_id: masterCompanyId
      };
      const { data: result, error } = await supabase
        .from('company_subscriptions')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Assinatura criada',
        description: 'A assinatura foi criada com sucesso.'
      });

      await fetchSubscriptions(masterCompanyId);
      return result;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar assinatura',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    }
  };

  // Update subscription
  const updateSubscription = async (id: string, data: Partial<CompanySubscription>) => {
    try {
      const { error } = await supabase
        .from('company_subscriptions')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Assinatura atualizada',
        description: 'A assinatura foi atualizada com sucesso.'
      });

      if (masterCompanyId) {
        await fetchSubscriptions(masterCompanyId);
      }
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar assinatura',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  // Create invoice
  const createInvoice = async (data: Partial<BillingInvoice>) => {
    if (!masterCompanyId) return null;

    try {
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const insertData = {
        ...data,
        invoice_number: invoiceNumber,
        master_company_id: masterCompanyId
      };
      const { data: result, error } = await supabase
        .from('billing_invoices')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Fatura criada',
        description: `Fatura ${invoiceNumber} criada com sucesso.`
      });

      await fetchInvoices(masterCompanyId);
      return result;
    } catch (error: any) {
      toast({
        title: 'Erro ao criar fatura',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    }
  };

  // Update invoice
  const updateInvoice = async (id: string, data: Partial<BillingInvoice>) => {
    try {
      const { error } = await supabase
        .from('billing_invoices')
        .update(data)
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Fatura atualizada',
        description: 'A fatura foi atualizada com sucesso.'
      });

      if (masterCompanyId) {
        await fetchInvoices(masterCompanyId);
      }
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar fatura',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  // Mark invoice as paid
  const markInvoiceAsPaid = async (invoiceId: string, paymentMethod?: string) => {
    if (!masterCompanyId) return false;

    try {
      const invoice = invoices.find(i => i.id === invoiceId);
      if (!invoice) throw new Error('Fatura não encontrada');

      // Update invoice
      const { error: invoiceError } = await supabase
        .from('billing_invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: paymentMethod || 'manual'
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Create transaction
      const { error: transactionError } = await supabase
        .from('billing_transactions')
        .insert({
          invoice_id: invoiceId,
          subscription_id: invoice.subscription_id,
          company_id: invoice.company_id,
          amount: invoice.amount,
          type: 'payment',
          status: 'confirmed',
          payment_method: paymentMethod || 'manual',
          master_company_id: masterCompanyId
        });

      if (transactionError) throw transactionError;

      toast({
        title: 'Pagamento registrado',
        description: 'O pagamento foi registrado com sucesso.'
      });

      await Promise.all([
        fetchInvoices(masterCompanyId),
        fetchTransactions(masterCompanyId)
      ]);

      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar pagamento',
        description: error.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  // Create transaction
  const createTransaction = async (data: Partial<BillingTransaction>) => {
    if (!masterCompanyId) return null;

    try {
      const insertData = {
        ...data,
        master_company_id: masterCompanyId
      };
      const { data: result, error } = await supabase
        .from('billing_transactions')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'Transação registrada',
        description: 'A transação foi registrada com sucesso.'
      });

      await fetchTransactions(masterCompanyId);
      return result;
    } catch (error: any) {
      toast({
        title: 'Erro ao registrar transação',
        description: error.message,
        variant: 'destructive'
      });
      return null;
    }
  };

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate KPIs when data changes
  useEffect(() => {
    calculateKPIs();
  }, [calculateKPIs]);

  return {
    loading,
    masterCompanyId,
    plans,
    subscriptions,
    invoices,
    transactions,
    kpis,
    loadData,
    createSubscription,
    updateSubscription,
    createInvoice,
    updateInvoice,
    markInvoiceAsPaid,
    createTransaction
  };
}
