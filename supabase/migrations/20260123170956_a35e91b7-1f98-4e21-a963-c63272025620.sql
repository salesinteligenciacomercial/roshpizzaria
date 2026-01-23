-- Adicionar campo title (título da negociação) na tabela leads
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS title TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.leads.title IS 'Título da negociação/oportunidade exibido no cartão do lead no funil';