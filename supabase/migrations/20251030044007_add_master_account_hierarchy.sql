-- ============================================
-- 🏢 Hierarquia de Subcontas - Controle de Conta Mestre
-- ============================================

-- Adicionar campos para controle hierárquico
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS is_master_account BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Criar índice para parent_company_id
CREATE INDEX IF NOT EXISTS idx_companies_parent_id ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_is_master ON public.companies(is_master_account);

-- Marcar empresa existente como conta mestre
UPDATE public.companies
SET is_master_account = TRUE
WHERE id = (
  SELECT c.id FROM public.companies c
  WHERE c.owner_user_id IS NOT NULL
  LIMIT 1
);

-- Adicionar validação: apenas contas mestres podem ter parent_company_id NULL
ALTER TABLE public.companies
ADD CONSTRAINT check_master_hierarchy
CHECK (
  (is_master_account = TRUE AND parent_company_id IS NULL) OR
  (is_master_account = FALSE AND parent_company_id IS NOT NULL)
);

-- Função para verificar se usuário pode criar subcontas
CREATE OR REPLACE FUNCTION public.can_create_subcompanies(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.companies c ON c.id = ur.company_id
    WHERE ur.user_id = _user_id
    AND ur.role = 'super_admin'
    AND c.is_master_account = TRUE
  );
$$;

-- Função para verificar limites de subcontas por plano
CREATE OR REPLACE FUNCTION public.check_subcompany_limits(_parent_company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE
      WHEN pc.plan = 'free' THEN (SELECT COUNT(*) FROM public.companies WHERE parent_company_id = _parent_company_id) < 0
      WHEN pc.plan = 'basic' THEN (SELECT COUNT(*) FROM public.companies WHERE parent_company_id = _parent_company_id) < 3
      WHEN pc.plan = 'premium' THEN (SELECT COUNT(*) FROM public.companies WHERE parent_company_id = _parent_company_id) < 10
      ELSE FALSE
    END
  FROM public.companies pc
  WHERE pc.id = _parent_company_id;
$$;

-- Atualizar políticas RLS para companies com controle hierárquico
DROP POLICY IF EXISTS "Users can view companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins can manage companies" ON public.companies;

-- Política para visualizar empresas (própria empresa ou subcontas se for master)
CREATE POLICY "Users can view companies"
  ON public.companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()) OR
    parent_company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()) OR
    id IN (
      SELECT c.id FROM public.companies c
      WHERE c.parent_company_id IN (
        SELECT ur.company_id FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
      )
    )
  );

-- Política para criar empresas (só super_admin de conta master)
CREATE POLICY "Super admins can create companies"
  ON public.companies FOR INSERT
  WITH CHECK (
    public.can_create_subcompanies(auth.uid()) AND
    public.check_subcompany_limits(parent_company_id)
  );

-- Política para atualizar empresas (só super_admin da própria empresa ou subcontas)
CREATE POLICY "Super admins can update companies"
  ON public.companies FOR UPDATE
  USING (
    id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin') OR
    parent_company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Política para deletar empresas (só super_admin da conta master)
CREATE POLICY "Super admins can delete companies"
  ON public.companies FOR DELETE
  USING (
    parent_company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  );

-- Trigger para definir created_by automaticamente
CREATE OR REPLACE FUNCTION public.set_company_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_company_created_by_trigger
BEFORE INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.set_company_created_by();
