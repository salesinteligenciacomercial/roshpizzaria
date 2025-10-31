-- ============================================
-- 📞 Atualização Filas de Atendimento - Isolamento por Empresa
-- ============================================

-- Adicionar company_id à tabela filas_atendimento
ALTER TABLE public.filas_atendimento
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Criar índice para company_id
CREATE INDEX IF NOT EXISTS idx_filas_company_id ON public.filas_atendimento(company_id);

-- Atualizar filas existentes para associar à empresa do owner
UPDATE public.filas_atendimento
SET company_id = ur.company_id
FROM public.user_roles ur
WHERE filas_atendimento.owner_id = ur.user_id
AND filas_atendimento.company_id IS NULL;

-- Tornar company_id NOT NULL após migração dos dados
ALTER TABLE public.filas_atendimento
ALTER COLUMN company_id SET NOT NULL;

-- Remover owner_id (não precisamos mais, pois company_id controla o isolamento)
ALTER TABLE public.filas_atendimento
DROP COLUMN IF EXISTS owner_id;

-- Criar constraint de prioridade única por empresa
ALTER TABLE public.filas_atendimento
ADD CONSTRAINT unique_prioridade_por_empresa UNIQUE (company_id, prioridade);

-- Criar constraint de nome único por empresa
ALTER TABLE public.filas_atendimento
ADD CONSTRAINT unique_nome_por_empresa UNIQUE (company_id, nome);

-- Atualizar políticas RLS para isolamento por empresa
DROP POLICY IF EXISTS "Users can view their company filas" ON public.filas_atendimento;
DROP POLICY IF EXISTS "Users can create filas" ON public.filas_atendimento;
DROP POLICY IF EXISTS "Users can update their company filas" ON public.filas_atendimento;
DROP POLICY IF EXISTS "Users can delete their company filas" ON public.filas_atendimento;

-- Política para visualizar filas da própria empresa
CREATE POLICY "Users can view their company filas"
  ON public.filas_atendimento FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
  ));

-- Política para criar filas (só company_admin ou superior)
CREATE POLICY "Users can create filas"
  ON public.filas_atendimento FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('company_admin', 'super_admin')
    )
  );

-- Política para atualizar filas da própria empresa (só company_admin ou superior)
CREATE POLICY "Users can update their company filas"
  ON public.filas_atendimento FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('company_admin', 'super_admin')
    )
  );

-- Política para deletar filas da própria empresa (só company_admin ou superior)
CREATE POLICY "Users can delete their company filas"
  ON public.filas_atendimento FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('company_admin', 'super_admin')
    )
  );

-- Criar tabela para associar usuários às filas
CREATE TABLE IF NOT EXISTS public.fila_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fila_id UUID REFERENCES public.filas_atendimento(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  capacidade_maxima INTEGER DEFAULT 10,
  atendimentos_ativos INTEGER DEFAULT 0,
  status TEXT DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'ocupado', 'ausente')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fila_id, user_id)
);

-- Índices para fila_colaboradores
CREATE INDEX IF NOT EXISTS idx_fila_colaboradores_fila_id ON public.fila_colaboradores(fila_id);
CREATE INDEX IF NOT EXISTS idx_fila_colaboradores_user_id ON public.fila_colaboradores(user_id);

-- Habilitar RLS na tabela fila_colaboradores
ALTER TABLE public.fila_colaboradores ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para fila_colaboradores
CREATE POLICY "Users can view fila colaboradores from their company"
  ON public.fila_colaboradores FOR SELECT
  USING (
    fila_id IN (
      SELECT fa.id FROM public.filas_atendimento fa
      WHERE fa.company_id IN (
        SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Company admins can manage fila colaboradores"
  ON public.fila_colaboradores FOR ALL
  USING (
    fila_id IN (
      SELECT fa.id FROM public.filas_atendimento fa
      WHERE fa.company_id IN (
        SELECT ur.company_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('company_admin', 'super_admin')
      )
    )
  );

-- Trigger para manter updated_at em fila_colaboradores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE TRIGGER set_timestamp_fila_colaboradores
    BEFORE UPDATE ON public.fila_colaboradores
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
