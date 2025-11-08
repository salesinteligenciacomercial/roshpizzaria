-- Adiciona coluna 'titulo' à tabela compromissos (idempotente)
ALTER TABLE public.compromissos
ADD COLUMN IF NOT EXISTS titulo TEXT;

-- Opcional: comentário para documentação
COMMENT ON COLUMN public.compromissos.titulo IS 'Título curto/assunto do compromisso';

