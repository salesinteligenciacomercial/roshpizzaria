-- Migration: Adicionar suporte para Meta WhatsApp Business API
-- Mantém compatibilidade total com Evolution API existente

-- Adicionar campos para Meta API na tabela whatsapp_connections
ALTER TABLE whatsapp_connections 
ADD COLUMN IF NOT EXISTS api_provider VARCHAR(20) DEFAULT 'evolution' CHECK (api_provider IN ('evolution', 'meta', 'both')),
ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
ADD COLUMN IF NOT EXISTS meta_webhook_verify_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS meta_business_account_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS meta_token_expires_at TIMESTAMP WITH TIME ZONE;

-- Índice para busca rápida por provider
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_api_provider 
ON whatsapp_connections(api_provider, company_id);

-- Comentários para documentação
COMMENT ON COLUMN whatsapp_connections.api_provider IS 'Tipo de API: evolution, meta, ou both para usar ambas';
COMMENT ON COLUMN whatsapp_connections.meta_phone_number_id IS 'Phone Number ID do Meta WhatsApp Business API';
COMMENT ON COLUMN whatsapp_connections.meta_access_token IS 'Access Token do Meta (criptografado)';
COMMENT ON COLUMN whatsapp_connections.meta_webhook_verify_token IS 'Token para verificação de webhook do Meta';
COMMENT ON COLUMN whatsapp_connections.meta_business_account_id IS 'WhatsApp Business Account ID do Meta';
COMMENT ON COLUMN whatsapp_connections.meta_token_expires_at IS 'Data de expiração do token Meta';