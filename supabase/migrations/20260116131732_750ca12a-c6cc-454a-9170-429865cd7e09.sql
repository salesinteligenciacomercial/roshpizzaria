-- Adicionar colunas para integração Gmail na tabela tenant_integrations
ALTER TABLE public.tenant_integrations 
ADD COLUMN IF NOT EXISTS gmail_access_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS gmail_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gmail_email TEXT,
ADD COLUMN IF NOT EXISTS gmail_status TEXT DEFAULT 'disconnected';

-- Comentários para documentação
COMMENT ON COLUMN public.tenant_integrations.gmail_access_token IS 'Token de acesso OAuth do Gmail';
COMMENT ON COLUMN public.tenant_integrations.gmail_refresh_token IS 'Token de refresh OAuth do Gmail';
COMMENT ON COLUMN public.tenant_integrations.gmail_token_expires_at IS 'Data de expiração do token de acesso';
COMMENT ON COLUMN public.tenant_integrations.gmail_email IS 'Email conectado do Gmail';
COMMENT ON COLUMN public.tenant_integrations.gmail_status IS 'Status da conexão: connected, disconnected, error';