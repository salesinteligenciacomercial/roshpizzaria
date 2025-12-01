-- Adicionar campo start_date para data de início do prazo nas tarefas
-- Esta migration adiciona suporte para definir um prazo com data inicial e final

-- Adicionar coluna start_date se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE tasks ADD COLUMN start_date TIMESTAMPTZ;
    COMMENT ON COLUMN tasks.start_date IS 'Data de início do prazo estimado da tarefa';
  END IF;
END $$;

-- Criar índice para melhorar performance de consultas por período
CREATE INDEX IF NOT EXISTS idx_tasks_date_range ON tasks(start_date, due_date) WHERE start_date IS NOT NULL;







