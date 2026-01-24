import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  dateCreated?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  status: string;
  description?: string;
  externalReference?: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  dueDate: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  description?: string;
  externalReference?: string;
}

export function useAsaas() {
  const [loading, setLoading] = useState(false);

  const callAsaasApi = useCallback(async (action: string, method: string = 'GET', body?: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-api', {
        body: { action, ...body },
        method: method as any,
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Asaas API Error:', error);
      toast.error(`Erro na API Asaas: ${error.message}`);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Clientes
  const listCustomers = useCallback(async (offset = 0, limit = 100) => {
    const { data } = await supabase.functions.invoke('asaas-api/customers', {
      method: 'GET',
    });
    return data;
  }, []);

  const createCustomer = useCallback(async (customer: Partial<AsaasCustomer>) => {
    const { data, error } = await supabase.functions.invoke('asaas-api/customers', {
      body: customer,
      method: 'POST',
    });
    if (error) throw error;
    toast.success('Cliente criado no Asaas');
    return data;
  }, []);

  const syncCustomer = useCallback(async (companyId: string) => {
    const { data, error } = await supabase.functions.invoke('asaas-api/sync-customer', {
      body: { companyId },
      method: 'POST',
    });
    if (error) throw error;
    toast.success('Cliente sincronizado com Asaas');
    return data;
  }, []);

  // Assinaturas
  const listSubscriptions = useCallback(async (offset = 0, limit = 100) => {
    const { data } = await supabase.functions.invoke('asaas-api/subscriptions', {
      method: 'GET',
    });
    return data;
  }, []);

  const createSubscription = useCallback(async (subscription: Partial<AsaasSubscription>) => {
    const { data, error } = await supabase.functions.invoke('asaas-api/subscriptions', {
      body: subscription,
      method: 'POST',
    });
    if (error) throw error;
    toast.success('Assinatura criada no Asaas');
    return data;
  }, []);

  const syncSubscription = useCallback(async (subscriptionData: any) => {
    const { data, error } = await supabase.functions.invoke('asaas-api/sync-subscription', {
      body: subscriptionData,
      method: 'POST',
    });
    if (error) throw error;
    toast.success('Assinatura sincronizada com Asaas');
    return data;
  }, []);

  // Cobranças
  const listPayments = useCallback(async (filters?: { customer?: string; subscription?: string }) => {
    let url = 'asaas-api/payments';
    const params = new URLSearchParams();
    if (filters?.customer) params.set('customer', filters.customer);
    if (filters?.subscription) params.set('subscription', filters.subscription);
    
    const { data } = await supabase.functions.invoke(url, {
      method: 'GET',
    });
    return data;
  }, []);

  const generatePayment = useCallback(async (paymentData: {
    customer_id: string;
    amount: number;
    due_date: string;
    payment_method: string;
    description?: string;
    invoice_id?: string;
  }) => {
    const { data, error } = await supabase.functions.invoke('asaas-api/generate-payment', {
      body: paymentData,
      method: 'POST',
    });
    if (error) throw error;
    toast.success('Cobrança gerada no Asaas');
    return data;
  }, []);

  const checkPaymentStatus = useCallback(async (paymentId: string) => {
    const { data, error } = await supabase.functions.invoke(`asaas-api/payment-status?id=${paymentId}`, {
      method: 'GET',
    });
    if (error) throw error;
    return data;
  }, []);

  return {
    loading,
    // Clientes
    listCustomers,
    createCustomer,
    syncCustomer,
    // Assinaturas
    listSubscriptions,
    createSubscription,
    syncSubscription,
    // Cobranças
    listPayments,
    generatePayment,
    checkPaymentStatus,
  };
}
