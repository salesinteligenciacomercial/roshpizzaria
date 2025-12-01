-- Adicionar campo responsaveis para múltiplos responsáveis nas tarefas
-- Esta migration adiciona suporte para atribuir múltiplos responsáveis a uma tarefa

-- Adicionar coluna responsaveis (array de UUIDs) se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'responsaveis'
  ) THEN
    ALTER TABLE tasks ADD COLUMN responsaveis UUID[] DEFAULT '{}';
    COMMENT ON COLUMN tasks.responsaveis IS 'Array de IDs dos responsáveis adicionais da tarefa';
  END IF;
END $$;

-- Criar índice GIN para melhorar performance de consultas por responsáveis
CREATE INDEX IF NOT EXISTS idx_tasks_responsaveis ON tasks USING GIN(responsaveis) WHERE responsaveis IS NOT NULL AND array_length(responsaveis, 1) > 0;







