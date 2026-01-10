-- Criar tabela de permissões customizadas por usuário
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, permission_id, company_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_company ON public.user_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON public.user_permissions(permission_id);

-- Habilitar RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users view their own permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Company admins view permissions in their company"
ON public.user_permissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.company_id = user_permissions.company_id
    AND ur.role IN ('company_admin', 'super_admin', 'gestor')
  )
);

CREATE POLICY "Company admins manage permissions in their company"
ON public.user_permissions FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.company_id = user_permissions.company_id
    AND ur.role IN ('company_admin', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.company_id = user_permissions.company_id
    AND ur.role IN ('company_admin', 'super_admin')
  )
);