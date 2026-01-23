
-- Tabela de planos de cobrança
CREATE TABLE public.billing_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  annual_price DECIMAL(10,2),
  setup_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_users INTEGER NOT NULL DEFAULT 3,
  max_leads INTEGER NOT NULL DEFAULT 500,
  max_messages INTEGER NOT NULL DEFAULT 2000,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de assinaturas das subcontas
CREATE TABLE public.company_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  billing_plan_id UUID REFERENCES public.billing_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'suspended', 'trial', 'pending')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  next_billing_date DATE,
  monthly_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  setup_fee_value DECIMAL(10,2) DEFAULT 0,
  setup_fee_paid BOOLEAN DEFAULT false,
  payment_method TEXT DEFAULT 'manual' CHECK (payment_method IN ('pix', 'boleto', 'cartao', 'manual', 'stripe', 'asaas')),
  external_subscription_id TEXT,
  external_customer_id TEXT,
  notes TEXT,
  master_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Tabela de faturas
CREATE TABLE public.billing_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  payment_method TEXT,
  external_invoice_id TEXT,
  external_payment_url TEXT,
  notes TEXT,
  master_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de transações/pagamentos
CREATE TABLE public.billing_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.company_subscriptions(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('payment', 'refund', 'chargeback', 'setup_fee', 'adjustment')),
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'failed', 'cancelled')),
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT,
  external_transaction_id TEXT,
  receipt_url TEXT,
  notes TEXT,
  master_company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_billing_plans_company ON public.billing_plans(company_id);
CREATE INDEX idx_company_subscriptions_company ON public.company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_master ON public.company_subscriptions(master_company_id);
CREATE INDEX idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX idx_billing_invoices_company ON public.billing_invoices(company_id);
CREATE INDEX idx_billing_invoices_master ON public.billing_invoices(master_company_id);
CREATE INDEX idx_billing_invoices_status ON public.billing_invoices(status);
CREATE INDEX idx_billing_invoices_due_date ON public.billing_invoices(due_date);
CREATE INDEX idx_billing_transactions_company ON public.billing_transactions(company_id);
CREATE INDEX idx_billing_transactions_master ON public.billing_transactions(master_company_id);
CREATE INDEX idx_billing_transactions_invoice ON public.billing_transactions(invoice_id);

-- Triggers para updated_at
CREATE TRIGGER update_billing_plans_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_subscriptions_updated_at
  BEFORE UPDATE ON public.company_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_billing_invoices_updated_at
  BEFORE UPDATE ON public.billing_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para billing_plans (apenas master accounts)
CREATE POLICY "Master accounts can manage billing plans"
  ON public.billing_plans
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
      AND (billing_plans.company_id = c.id OR billing_plans.company_id IS NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
    )
  );

-- Políticas RLS para company_subscriptions (apenas master accounts)
CREATE POLICY "Master accounts can manage subscriptions"
  ON public.company_subscriptions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
      AND company_subscriptions.master_company_id = c.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
    )
  );

-- Políticas RLS para billing_invoices (apenas master accounts)
CREATE POLICY "Master accounts can manage invoices"
  ON public.billing_invoices
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
      AND billing_invoices.master_company_id = c.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
    )
  );

-- Políticas RLS para billing_transactions (apenas master accounts)
CREATE POLICY "Master accounts can manage transactions"
  ON public.billing_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
      AND billing_transactions.master_company_id = c.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.companies c ON c.id = ur.company_id
      WHERE ur.user_id = auth.uid()
      AND c.is_master_account = true
    )
  );

-- Inserir planos padrão
INSERT INTO public.billing_plans (name, description, monthly_price, annual_price, setup_fee, max_users, max_leads, max_messages, features, company_id) VALUES
('Starter', 'Plano inicial para pequenas equipes', 197.00, 2127.60, 497.00, 3, 500, 2000, '["CRM Básico", "WhatsApp", "Agenda", "Relatórios básicos"]', NULL),
('Professional', 'Para equipes em crescimento', 397.00, 4285.60, 997.00, 5, 2000, 5000, '["CRM Completo", "WhatsApp", "Agenda", "IA Básica", "Relatórios avançados"]', NULL),
('Business', 'Para empresas consolidadas', 697.00, 7527.60, 1997.00, 10, 10000, 15000, '["CRM Completo", "WhatsApp", "Agenda", "IA Completa", "API", "Relatórios avançados", "Integrações"]', NULL),
('Enterprise', 'Solução personalizada', 1997.00, NULL, 0, 999, 999999, 999999, '["Tudo do Business", "Usuários ilimitados", "Leads ilimitados", "Suporte prioritário", "Customizações"]', NULL);
