-- Extender tabela tasks com campos solicitados
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS comments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS responsaveis UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notificacao_enviada BOOLEAN DEFAULT false;

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_responsaveis ON public.tasks USING GIN (responsaveis);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON public.tasks USING GIN (tags);

