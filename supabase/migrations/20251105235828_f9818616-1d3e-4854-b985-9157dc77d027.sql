-- Adicionar colunas de hierarquia de contas mestre
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS is_master_account BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índice para melhor performance nas consultas de hierarquia
CREATE INDEX IF NOT EXISTS idx_companies_parent ON public.companies(parent_company_id);
CREATE INDEX IF NOT EXISTS idx_companies_master ON public.companies(is_master_account) WHERE is_master_account = TRUE;

-- Promover a empresa do usuário jeovauzumak@gmail.com como conta mestre
UPDATE public.companies
SET is_master_account = TRUE,
    parent_company_id = NULL
WHERE id IN (
  SELECT ur.company_id 
  FROM public.user_roles ur
  JOIN auth.users au ON ur.user_id = au.id
  WHERE au.email ILIKE 'jeovauzumak@gmail.com'
  LIMIT 1
);

-- Garantir que o usuário é super admin
INSERT INTO public.user_roles (user_id, company_id, role)
SELECT 
  au.id,
  ur.company_id,
  'super_admin'::app_role
FROM auth.users au
CROSS JOIN LATERAL (
  SELECT company_id FROM public.user_roles WHERE user_id = au.id LIMIT 1
) ur
WHERE au.email ILIKE 'jeovauzumak@gmail.com'
ON CONFLICT (user_id, company_id) 
DO UPDATE SET role = 'super_admin'::app_role;