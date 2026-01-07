-- Adicionar campos de rastreamento de anúncios na tabela conversas
ALTER TABLE public.conversas 
ADD COLUMN IF NOT EXISTS ad_source_type TEXT,
ADD COLUMN IF NOT EXISTS ad_source_id TEXT,
ADD COLUMN IF NOT EXISTS ad_headline TEXT,
ADD COLUMN IF NOT EXISTS ctwa_clid TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.conversas.ad_source_type IS 'Tipo de origem do anúncio (ex: ad, post, etc)';
COMMENT ON COLUMN public.conversas.ad_source_id IS 'ID do anúncio de origem';
COMMENT ON COLUMN public.conversas.ad_headline IS 'Título do anúncio de origem';
COMMENT ON COLUMN public.conversas.ctwa_clid IS 'Click ID para atribuição Click-to-WhatsApp';