-- Adicionar campo origem_api na tabela conversas para identificar de qual API veio a mensagem
ALTER TABLE public.conversas 
ADD COLUMN IF NOT EXISTS origem_api TEXT DEFAULT 'evolution';

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.conversas.origem_api IS 'Origem da mensagem: evolution (não oficial) ou meta (oficial)';

-- Criar índice para filtros por origem
CREATE INDEX IF NOT EXISTS idx_conversas_origem_api ON public.conversas (origem_api);

-- Atualizar conversas existentes que vieram do webhook-meta (se houver alguma forma de identificar)
-- Por enquanto, todas existentes ficam como 'evolution' (default)