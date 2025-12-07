-- Tabela multi-tenant para integrações Meta
CREATE TABLE public.tenant_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Meta OAuth tokens
  meta_access_token TEXT,
  meta_refresh_token TEXT,
  meta_token_expires_at TIMESTAMPTZ,
  meta_app_scoped_user_id TEXT,
  
  -- WhatsApp Cloud API
  waba_id TEXT,
  whatsapp_phone_number_id TEXT,
  whatsapp_phone_number TEXT,
  whatsapp_status TEXT DEFAULT 'disconnected',
  
  -- Instagram Messaging
  instagram_ig_id TEXT,
  instagram_username TEXT,
  instagram_status TEXT DEFAULT 'disconnected',
  
  -- Facebook Messenger
  messenger_page_id TEXT,
  messenger_page_name TEXT,
  messenger_page_access_token TEXT,
  messenger_status TEXT DEFAULT 'disconnected',
  
  -- Marketing API (Lead Ads)
  ad_account_id TEXT,
  lead_form_ids TEXT[],
  marketing_status TEXT DEFAULT 'disconnected',
  
  -- Permissões concedidas
  granted_permissions TEXT[],
  
  -- Prioridade de fallback
  provider_priority TEXT DEFAULT 'both' CHECK (provider_priority IN ('meta', 'evolution', 'both')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(company_id)
);

-- Índices
CREATE INDEX idx_tenant_integrations_company ON public.tenant_integrations(company_id);
CREATE INDEX idx_tenant_integrations_waba ON public.tenant_integrations(waba_id) WHERE waba_id IS NOT NULL;
CREATE INDEX idx_tenant_integrations_instagram ON public.tenant_integrations(instagram_ig_id) WHERE instagram_ig_id IS NOT NULL;
CREATE INDEX idx_tenant_integrations_messenger ON public.tenant_integrations(messenger_page_id) WHERE messenger_page_id IS NOT NULL;

-- RLS
ALTER TABLE public.tenant_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users manage integrations"
ON public.tenant_integrations
FOR ALL
USING (user_belongs_to_company(auth.uid(), company_id));

-- Trigger para updated_at
CREATE TRIGGER update_tenant_integrations_updated_at
BEFORE UPDATE ON public.tenant_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tenant_integrations;