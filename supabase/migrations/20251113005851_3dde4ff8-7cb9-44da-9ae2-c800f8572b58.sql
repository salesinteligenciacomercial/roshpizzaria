-- Remover política que ainda causa recursão circular
DROP POLICY IF EXISTS "company_admins_view_company_roles" ON public.user_roles;

-- Criar função SECURITY DEFINER para obter role do usuário sem recursão
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role 
  FROM public.user_roles 
  WHERE user_id = _user_id 
  LIMIT 1;
$$;

-- Criar função SECURITY DEFINER para obter company_id do usuário sem recursão
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id 
  FROM public.user_roles 
  WHERE user_id = _user_id 
  LIMIT 1;
$$;

-- Recriar política para company admins SEM recursão usando a função SECURITY DEFINER
CREATE POLICY "company_admins_view_company_roles" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    -- Usar função SECURITY DEFINER para evitar recursão
    public.get_user_role(auth.uid()) = 'company_admin'
    AND company_id = public.get_user_company_id(auth.uid())
  );

-- Comentário explicativo
COMMENT ON FUNCTION public.get_user_role IS 'Retorna role do usuário sem causar recursão em RLS';
COMMENT ON FUNCTION public.get_user_company_id IS 'Retorna company_id do usuário sem causar recursão em RLS';
COMMENT ON POLICY "company_admins_view_company_roles" ON public.user_roles IS 'Permite company admins visualizarem roles de sua empresa (sem recursão)';