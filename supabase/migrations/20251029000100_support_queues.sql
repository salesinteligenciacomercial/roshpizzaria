-- Tabelas de Filas de Atendimento e Atribuições de Conversas

-- Filas de atendimento por empresa
CREATE TABLE IF NOT EXISTS public.support_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_queues_company ON public.support_queues(company_id);

-- Membros (usuários) de cada fila
CREATE TABLE IF NOT EXISTS public.support_queue_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES public.support_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_queue_member ON public.support_queue_members(queue_id, user_id);

-- Atribuição de conversas a usuário ou fila (por telefone normalizado + empresa)
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  telefone_formatado TEXT NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  queue_id UUID REFERENCES public.support_queues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, telefone_formatado)
);

CREATE INDEX IF NOT EXISTS idx_conv_assign_company_phone ON public.conversation_assignments(company_id, telefone_formatado);

-- RLS
ALTER TABLE public.support_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;

-- Policies: restringir por company_id via função user_belongs_to_company
CREATE POLICY IF NOT EXISTS "queues_select"
  ON public.support_queues FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY IF NOT EXISTS "queues_modify"
  ON public.support_queues FOR ALL
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY IF NOT EXISTS "queue_members_select"
  ON public.support_queue_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_queues q
      WHERE q.id = support_queue_members.queue_id
      AND public.user_belongs_to_company(auth.uid(), q.company_id)
    )
  );

CREATE POLICY IF NOT EXISTS "queue_members_modify"
  ON public.support_queue_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.support_queues q
      WHERE q.id = support_queue_members.queue_id
      AND public.user_belongs_to_company(auth.uid(), q.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_queues q
      WHERE q.id = support_queue_members.queue_id
      AND public.user_belongs_to_company(auth.uid(), q.company_id)
    )
  );

CREATE POLICY IF NOT EXISTS "conv_assign_select"
  ON public.conversation_assignments FOR SELECT
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY IF NOT EXISTS "conv_assign_modify"
  ON public.conversation_assignments FOR ALL
  USING (public.user_belongs_to_company(auth.uid(), company_id))
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_support_queues_updated
BEFORE UPDATE ON public.support_queues
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_conversation_assignments_updated
BEFORE UPDATE ON public.conversation_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_queues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_queue_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_assignments;

