
-- Corrigir triggers das tabelas task_boards e task_columns
DROP TRIGGER IF EXISTS update_task_boards_updated_at ON public.task_boards;
DROP TRIGGER IF EXISTS update_task_columns_updated_at ON public.task_columns;

-- Aplicar triggers corretos que usam atualizado_em
CREATE TRIGGER update_task_boards_atualizado_em
  BEFORE UPDATE ON public.task_boards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em_column();

CREATE TRIGGER update_task_columns_atualizado_em
  BEFORE UPDATE ON public.task_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_atualizado_em_column();
