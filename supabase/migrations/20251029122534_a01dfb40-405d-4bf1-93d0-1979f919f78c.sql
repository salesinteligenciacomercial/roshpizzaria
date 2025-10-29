-- Criar tabela filas_atendimento
CREATE TABLE IF NOT EXISTS public.filas_atendimento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN DEFAULT true,
  prioridade INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela support_queues
CREATE TABLE IF NOT EXISTS public.support_queues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela support_queue_members
CREATE TABLE IF NOT EXISTS public.support_queue_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id UUID NOT NULL REFERENCES public.support_queues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela conversation_assignments
CREATE TABLE IF NOT EXISTS public.conversation_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  telefone_formatado TEXT NOT NULL,
  assigned_user_id UUID,
  queue_id UUID REFERENCES public.support_queues(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, telefone_formatado)
);

-- Adicionar coluna checklist na tabela tasks se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'checklist'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN checklist JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.filas_atendimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_queue_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_assignments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para filas_atendimento
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

-- Políticas RLS para support_queues (baseado em company_id)
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

-- Políticas RLS para support_queue_members
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

-- Políticas RLS para conversation_assignments
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

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_filas_atendimento_owner ON public.filas_atendimento(owner_id);
CREATE INDEX IF NOT EXISTS idx_support_queues_company ON public.support_queues(company_id);
CREATE INDEX IF NOT EXISTS idx_support_queue_members_queue ON public.support_queue_members(queue_id);
CREATE INDEX IF NOT EXISTS idx_support_queue_members_user ON public.support_queue_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_company_tel ON public.conversation_assignments(company_id, telefone_formatado);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_queue ON public.conversation_assignments(queue_id);
CREATE INDEX IF NOT EXISTS idx_conversation_assignments_user ON public.conversation_assignments(assigned_user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_filas_atendimento_updated_at
  BEFORE UPDATE ON public.filas_atendimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_queues_updated_at
  BEFORE UPDATE ON public.support_queues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversation_assignments_updated_at
  BEFORE UPDATE ON public.conversation_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();