-- Adicionar campo para vincular retornos ao compromisso original
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS compromisso_origem_id UUID REFERENCES public.compromissos(id);

-- Índice para consultas de histórico de retornos
CREATE INDEX IF NOT EXISTS idx_compromissos_origem 
ON public.compromissos(compromisso_origem_id);

-- Comentário explicativo
COMMENT ON COLUMN public.compromissos.compromisso_origem_id IS 
'ID do compromisso original para rastreamento de retornos';