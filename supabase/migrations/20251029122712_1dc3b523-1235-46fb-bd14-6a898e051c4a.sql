-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Usuários podem ver suas próprias filas" ON public.filas_atendimento;
DROP POLICY IF EXISTS "Usuários podem criar suas próprias filas" ON public.filas_atendimento;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias filas" ON public.filas_atendimento;
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias filas" ON public.filas_atendimento;

DROP POLICY IF EXISTS "Usuários podem ver filas da empresa" ON public.support_queues;
DROP POLICY IF EXISTS "Usuários podem criar filas da empresa" ON public.support_queues;
DROP POLICY IF EXISTS "Usuários podem atualizar filas da empresa" ON public.support_queues;
DROP POLICY IF EXISTS "Usuários podem deletar filas da empresa" ON public.support_queues;

DROP POLICY IF EXISTS "Membros podem ver membros da fila" ON public.support_queue_members;
DROP POLICY IF EXISTS "Usuários podem adicionar membros à fila" ON public.support_queue_members;
DROP POLICY IF EXISTS "Usuários podem remover membros da fila" ON public.support_queue_members;

DROP POLICY IF EXISTS "Usuários podem ver atribuições da empresa" ON public.conversation_assignments;
DROP POLICY IF EXISTS "Usuários podem criar/atualizar atribuições" ON public.conversation_assignments;
DROP POLICY IF EXISTS "Usuários podem atualizar atribuições da empresa" ON public.conversation_assignments;
DROP POLICY IF EXISTS "Usuários podem deletar atribuições da empresa" ON public.conversation_assignments;

-- Recriar políticas RLS para filas_atendimento
CREATE POLICY "Usuários podem ver suas próprias filas"
  ON public.filas_atendimento FOR SELECT
  USING (auth.uid() = owner_id);

CREATE POLICY "Usuários podem criar suas próprias filas"
  ON public.filas_atendimento FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Usuários podem atualizar suas próprias filas"
  ON public.filas_atendimento FOR UPDATE
  USING (auth.uid() = owner_id);

CREATE POLICY "Usuários podem deletar suas próprias filas"
  ON public.filas_atendimento FOR DELETE
  USING (auth.uid() = owner_id);

-- Recriar políticas RLS para support_queues
CREATE POLICY "Usuários podem ver filas da empresa"
  ON public.support_queues FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar filas da empresa"
  ON public.support_queues FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar filas da empresa"
  ON public.support_queues FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar filas da empresa"
  ON public.support_queues FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

-- Recriar políticas RLS para support_queue_members
CREATE POLICY "Membros podem ver membros da fila"
  ON public.support_queue_members FOR SELECT
  USING (
    queue_id IN (
      SELECT id FROM public.support_queues
      WHERE company_id IN (
        SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuários podem adicionar membros à fila"
  ON public.support_queue_members FOR INSERT
  WITH CHECK (
    queue_id IN (
      SELECT id FROM public.support_queues
      WHERE company_id IN (
        SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Usuários podem remover membros da fila"
  ON public.support_queue_members FOR DELETE
  USING (
    queue_id IN (
      SELECT id FROM public.support_queues
      WHERE company_id IN (
        SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
      )
    )
  );

-- Recriar políticas RLS para conversation_assignments
CREATE POLICY "Usuários podem ver atribuições da empresa"
  ON public.conversation_assignments FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar/atualizar atribuições"
  ON public.conversation_assignments FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar atribuições da empresa"
  ON public.conversation_assignments FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar atribuições da empresa"
  ON public.conversation_assignments FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );