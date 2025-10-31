-- Adicionar sistema de time tracking às tarefas
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS tempo_gasto INTEGER DEFAULT 0, -- tempo em minutos
  ADD COLUMN IF NOT EXISTS time_tracking_iniciado TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS time_tracking_pausado BOOLEAN DEFAULT false;

-- Índice para consultas de time tracking
CREATE INDEX IF NOT EXISTS idx_tasks_time_tracking ON public.tasks(time_tracking_iniciado) WHERE time_tracking_iniciado IS NOT NULL;

