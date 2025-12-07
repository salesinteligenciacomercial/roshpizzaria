-- Adicionar coluna compromisso_id para vincular tarefas a compromissos
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS compromisso_id uuid REFERENCES public.compromissos(id) ON DELETE SET NULL;

-- Adicionar coluna professional_id para filtrar tarefas por profissional
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tasks_compromisso_id ON public.tasks(compromisso_id);
CREATE INDEX IF NOT EXISTS idx_tasks_professional_id ON public.tasks(professional_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- Habilitar Realtime apenas nas tabelas que ainda não estão (tasks e leads)
DO $$ 
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- RLS: Profissionais podem criar suas próprias tarefas
DROP POLICY IF EXISTS "Profissionais podem criar tarefas via API" ON public.tasks;
CREATE POLICY "Profissionais podem criar tarefas via API"
ON public.tasks FOR INSERT
WITH CHECK (
  professional_id IS NULL OR
  EXISTS (
    SELECT 1 FROM profissionais
    WHERE profissionais.id = tasks.professional_id
    AND profissionais.user_id = auth.uid()
  )
);

-- RLS: Profissionais podem excluir suas próprias tarefas
DROP POLICY IF EXISTS "Profissionais podem excluir tarefas via API" ON public.tasks;
CREATE POLICY "Profissionais podem excluir tarefas via API"
ON public.tasks FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profissionais
    WHERE profissionais.id = tasks.professional_id
    AND profissionais.user_id = auth.uid()
  )
);