import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ASAAS_API_URL = 'https://api.asaas.com/v3';

interface AsaasCustomer {
  id?: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
}

interface AsaasSubscription {
  id?: string;
  customer: string;
  billingType: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  description?: string;
  externalReference?: string;
}

interface AsaasPayment {
  id?: string;
  customer: string;
  billingType: string;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}

async function asaasRequest(endpoint: string, method: string = 'GET', body?: any) {
  const apiKey = Deno.env.get('ASAAS_API_KEY');
  
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': apiKey,
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Asaas API Error:', errorText);
    throw new Error(`Asaas API Error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se é super admin (master account)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('company_id, role')
      .eq('user_id', userData.user.id)
      .single();

    if (!userRole) {
      return new Response(JSON.stringify({ error: 'Usuário sem empresa' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: company } = await supabase
      .from('companies')
      .select('is_master_account')
      .eq('id', userRole.company_id)
      .single();

    if (!company?.is_master_account) {
      return new Response(JSON.stringify({ error: 'Acesso restrito a conta master' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();
    const body = req.method !== 'GET' ? await req.json() : null;

    let result;

    switch (action) {
      // ================== CUSTOMERS ==================
      case 'customers':
        if (req.method === 'GET') {
          const offset = url.searchParams.get('offset') || '0';
          const limit = url.searchParams.get('limit') || '100';
          result = await asaasRequest(`/customers?offset=${offset}&limit=${limit}`);
        } else if (req.method === 'POST') {
          result = await asaasRequest('/customers', 'POST', body);
          
          // Atualizar external_customer_id na subscription local
          if (result.id && body.externalReference) {
            await supabase
              .from('company_subscriptions')
              .update({ external_customer_id: result.id })
              .eq('company_id', body.externalReference);
          }
        }
        break;

      case 'customer':
        if (req.method === 'GET') {
          const customerId = url.searchParams.get('id');
          result = await asaasRequest(`/customers/${customerId}`);
        } else if (req.method === 'PUT') {
          result = await asaasRequest(`/customers/${body.id}`, 'PUT', body);
        } else if (req.method === 'DELETE') {
          const customerId = url.searchParams.get('id');
          result = await asaasRequest(`/customers/${customerId}`, 'DELETE');
        }
        break;

      // ================== SUBSCRIPTIONS ==================
      case 'subscriptions':
        if (req.method === 'GET') {
          const offset = url.searchParams.get('offset') || '0';
          const limit = url.searchParams.get('limit') || '100';
          result = await asaasRequest(`/subscriptions?offset=${offset}&limit=${limit}`);
        } else if (req.method === 'POST') {
          result = await asaasRequest('/subscriptions', 'POST', body);
          
          // Atualizar external_subscription_id na subscription local
          if (result.id && body.externalReference) {
            await supabase
              .from('company_subscriptions')
              .update({ external_subscription_id: result.id })
              .eq('id', body.externalReference);
          }
        }
        break;

      case 'subscription':
        if (req.method === 'GET') {
          const subscriptionId = url.searchParams.get('id');
          result = await asaasRequest(`/subscriptions/${subscriptionId}`);
        } else if (req.method === 'PUT') {
          result = await asaasRequest(`/subscriptions/${body.id}`, 'PUT', body);
        } else if (req.method === 'DELETE') {
          const subscriptionId = url.searchParams.get('id');
          result = await asaasRequest(`/subscriptions/${subscriptionId}`, 'DELETE');
        }
        break;

      // ================== PAYMENTS ==================
      case 'payments':
        if (req.method === 'GET') {
          const offset = url.searchParams.get('offset') || '0';
          const limit = url.searchParams.get('limit') || '100';
          const customerId = url.searchParams.get('customer');
          const subscriptionId = url.searchParams.get('subscription');
          
          let endpoint = `/payments?offset=${offset}&limit=${limit}`;
          if (customerId) endpoint += `&customer=${customerId}`;
          if (subscriptionId) endpoint += `&subscription=${subscriptionId}`;
          
          result = await asaasRequest(endpoint);
        } else if (req.method === 'POST') {
          result = await asaasRequest('/payments', 'POST', body);
          
          // Criar fatura local se criada no Asaas
          if (result.id && body.externalReference) {
            const invoiceNumber = `ASS-${Date.now()}`;
            await supabase
              .from('billing_invoices')
              .insert({
                subscription_id: body.externalReference,
                company_id: body.companyId,
                master_company_id: userRole.company_id,
                amount: body.value,
                due_date: body.dueDate,
                status: 'pending',
                invoice_number: invoiceNumber,
                external_invoice_id: result.id,
                external_payment_url: result.invoiceUrl || result.bankSlipUrl,
                description: body.description,
              });
          }
        }
        break;

      case 'payment':
        if (req.method === 'GET') {
          const paymentId = url.searchParams.get('id');
          result = await asaasRequest(`/payments/${paymentId}`);
        } else if (req.method === 'PUT') {
          result = await asaasRequest(`/payments/${body.id}`, 'PUT', body);
        } else if (req.method === 'DELETE') {
          const paymentId = url.searchParams.get('id');
          result = await asaasRequest(`/payments/${paymentId}`, 'DELETE');
        }
        break;

      case 'payment-status':
        // Receber o ID da cobrança e verificar status no Asaas
        const paymentId = url.searchParams.get('id');
        result = await asaasRequest(`/payments/${paymentId}`);
        
        // Atualizar status local baseado no Asaas
        if (result.status) {
          const statusMap: Record<string, string> = {
            'PENDING': 'pending',
            'RECEIVED': 'paid',
            'CONFIRMED': 'paid',
            'OVERDUE': 'overdue',
            'REFUNDED': 'cancelled',
            'RECEIVED_IN_CASH': 'paid',
            'REFUND_REQUESTED': 'pending',
            'CHARGEBACK_REQUESTED': 'pending',
            'CHARGEBACK_DISPUTE': 'pending',
            'AWAITING_CHARGEBACK_REVERSAL': 'pending',
            'DUNNING_REQUESTED': 'overdue',
            'DUNNING_RECEIVED': 'paid',
            'AWAITING_RISK_ANALYSIS': 'pending',
          };
          
          const localStatus = statusMap[result.status] || 'pending';
          
          await supabase
            .from('billing_invoices')
            .update({ 
              status: localStatus,
              paid_at: localStatus === 'paid' ? new Date().toISOString() : null,
            })
            .eq('external_invoice_id', paymentId);
        }
        break;

      // ================== SYNC ==================
      case 'sync-customer':
        // Sincronizar/criar cliente no Asaas baseado na subconta
        const companyId = body.companyId;
        
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name, cnpj')
          .eq('id', companyId)
          .single();

        if (!companyData) {
          throw new Error('Empresa não encontrada');
        }

        // Verificar se já existe no Asaas
        const { data: subscription } = await supabase
          .from('company_subscriptions')
          .select('external_customer_id')
          .eq('company_id', companyId)
          .single();

        if (subscription?.external_customer_id) {
          // Atualizar cliente existente
          result = await asaasRequest(`/customers/${subscription.external_customer_id}`, 'PUT', {
            name: companyData.name,
            cpfCnpj: companyData.cnpj?.replace(/[^\d]/g, ''),
          });
        } else {
          // Criar novo cliente
          result = await asaasRequest('/customers', 'POST', {
            name: companyData.name,
            cpfCnpj: companyData.cnpj?.replace(/[^\d]/g, ''),
            externalReference: companyId,
          });
        }
        break;

      case 'sync-subscription':
        // Sincronizar assinatura local com Asaas
        const subscriptionData = body;
        
        if (!subscriptionData.external_customer_id) {
          throw new Error('Cliente não sincronizado com Asaas');
        }

        const cycleMap: Record<string, string> = {
          'monthly': 'MONTHLY',
          'quarterly': 'QUARTERLY',
          'semiannual': 'SEMIANNUALLY',
          'annual': 'YEARLY',
        };

        const asaasSubscription = {
          customer: subscriptionData.external_customer_id,
          billingType: 'BOLETO', // ou PIX, CREDIT_CARD
          value: subscriptionData.monthly_value,
          nextDueDate: subscriptionData.next_billing_date,
          cycle: cycleMap[subscriptionData.billing_cycle] || 'MONTHLY',
          description: `Assinatura CRM - ${subscriptionData.company_name}`,
          externalReference: subscriptionData.id,
        };

        if (subscriptionData.external_subscription_id) {
          result = await asaasRequest(`/subscriptions/${subscriptionData.external_subscription_id}`, 'PUT', asaasSubscription);
        } else {
          result = await asaasRequest('/subscriptions', 'POST', asaasSubscription);
          
          if (result.id) {
            await supabase
              .from('company_subscriptions')
              .update({ external_subscription_id: result.id })
              .eq('id', subscriptionData.id);
          }
        }
        break;

      case 'generate-payment':
        // Gerar cobrança avulsa no Asaas
        const paymentData = body;
        
        if (!paymentData.customer_id) {
          throw new Error('Cliente Asaas não informado');
        }

        const billingTypeMap: Record<string, string> = {
          'pix': 'PIX',
          'boleto': 'BOLETO',
          'cartao': 'CREDIT_CARD',
          'transferencia': 'TRANSFER',
        };

        result = await asaasRequest('/payments', 'POST', {
          customer: paymentData.customer_id,
          billingType: billingTypeMap[paymentData.payment_method] || 'PIX',
          value: paymentData.amount,
          dueDate: paymentData.due_date,
          description: paymentData.description || 'Cobrança CRM',
          externalReference: paymentData.invoice_id,
        });

        // Atualizar fatura local com dados do Asaas
        if (result.id) {
          await supabase
            .from('billing_invoices')
            .update({ 
              external_invoice_id: result.id,
              external_payment_url: result.invoiceUrl || result.bankSlipUrl,
            })
            .eq('id', paymentData.invoice_id);
        }
        break;

      // ================== WEBHOOK ==================
      case 'webhook':
        // Processar webhook do Asaas
        const event = body;
        console.log('Asaas Webhook received:', event);

        if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
          // Atualizar fatura como paga
          await supabase
            .from('billing_invoices')
            .update({ 
              status: 'paid',
              paid_at: new Date().toISOString(),
              payment_method: event.payment?.billingType?.toLowerCase(),
            })
            .eq('external_invoice_id', event.payment?.id);

          // Criar transação
          const { data: invoice } = await supabase
            .from('billing_invoices')
            .select('*')
            .eq('external_invoice_id', event.payment?.id)
            .single();

          if (invoice) {
            await supabase
              .from('billing_transactions')
              .insert({
                company_id: invoice.company_id,
                master_company_id: invoice.master_company_id,
                subscription_id: invoice.subscription_id,
                invoice_id: invoice.id,
                type: 'payment',
                amount: event.payment?.value || invoice.amount,
                payment_date: new Date().toISOString(),
                payment_method: event.payment?.billingType?.toLowerCase(),
                status: 'confirmed',
                external_transaction_id: event.payment?.id,
                notes: 'Pagamento confirmado via Asaas',
              });
          }
        } else if (event.event === 'PAYMENT_OVERDUE') {
          await supabase
            .from('billing_invoices')
            .update({ status: 'overdue' })
            .eq('external_invoice_id', event.payment?.id);
        }

        result = { success: true };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Ação não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
