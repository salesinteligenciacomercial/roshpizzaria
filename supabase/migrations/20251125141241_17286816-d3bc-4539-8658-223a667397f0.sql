-- Adicionar campo responsaveis (plural) como array para suportar múltiplos responsáveis por lead
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS responsaveis uuid[] DEFAULT ARRAY[]::uuid[];

-- Adicionar índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_leads_responsaveis ON public.leads USING GIN(responsaveis);

COMMENT ON COLUMN public.leads.responsaveis IS 'Array de IDs dos usuários responsáveis pelo lead (suporte a múltiplos responsáveis)';