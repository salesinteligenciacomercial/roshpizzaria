-- Tabela para API Keys de Webhooks
CREATE TABLE public.webhook_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  allowed_ips TEXT[],
  rate_limit INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0
);

-- Tabela para Logs de Webhooks
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.webhook_api_keys(id) ON DELETE SET NULL,
  endpoint TEXT NOT NULL,
  request_method TEXT,
  request_body JSONB,
  request_headers JSONB,
  response_status INTEGER,
  response_body JSONB,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  processing_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_webhook_api_keys_company ON public.webhook_api_keys(company_id);
CREATE INDEX idx_webhook_api_keys_api_key ON public.webhook_api_keys(api_key);
CREATE INDEX idx_webhook_logs_company ON public.webhook_logs(company_id);
CREATE INDEX idx_webhook_logs_created ON public.webhook_logs(created_at DESC);
CREATE INDEX idx_webhook_logs_api_key ON public.webhook_logs(api_key_id);

-- RLS para webhook_api_keys
ALTER TABLE public.webhook_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company webhook keys"
ON public.webhook_api_keys FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can create webhook keys for their company"
ON public.webhook_api_keys FOR INSERT
WITH CHECK (company_id IN (
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update their company webhook keys"
ON public.webhook_api_keys FOR UPDATE
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can delete their company webhook keys"
ON public.webhook_api_keys FOR DELETE
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
));

-- RLS para webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company webhook logs"
ON public.webhook_logs FOR SELECT
USING (company_id IN (
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
));

-- Permitir inserção via service role (Edge Functions)
CREATE POLICY "Service role can insert webhook logs"
ON public.webhook_logs FOR INSERT
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_webhook_api_keys_updated_at
BEFORE UPDATE ON public.webhook_api_keys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();