-- Adicionar coluna para múltiplos responsáveis na tabela tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS responsaveis UUID[] DEFAULT ARRAY[]::UUID[];

-- Criar índice para melhorar performance de buscas
CREATE INDEX IF NOT EXISTS idx_tasks_responsaveis ON public.tasks USING gin(responsaveis);

-- Comentário explicativo
COMMENT ON COLUMN public.tasks.responsaveis IS 'Array de UUIDs dos usuários responsáveis pela tarefa (permite múltiplos responsáveis)';
