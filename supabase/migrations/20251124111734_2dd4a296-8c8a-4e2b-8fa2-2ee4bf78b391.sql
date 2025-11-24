-- Adicionar campos de campanha na tabela conversas
ALTER TABLE public.conversas 
ADD COLUMN IF NOT EXISTS campanha_nome TEXT,
ADD COLUMN IF NOT EXISTS campanha_id TEXT;

-- Adicionar campos de rastreamento de leitura
ALTER TABLE public.conversas 
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_conversas_campanha_id ON public.conversas(campanha_id);
CREATE INDEX IF NOT EXISTS idx_conversas_campanha_nome ON public.conversas(campanha_nome);

-- Adicionar comentários nas colunas para documentação
COMMENT ON COLUMN public.conversas.campanha_nome IS 'Nome da campanha de disparo em massa';
COMMENT ON COLUMN public.conversas.campanha_id IS 'ID da campanha de disparo em massa';
COMMENT ON COLUMN public.conversas.read IS 'Indica se a mensagem foi lida pelo destinatário';
COMMENT ON COLUMN public.conversas.delivered IS 'Indica se a mensagem foi entregue ao destinatário';