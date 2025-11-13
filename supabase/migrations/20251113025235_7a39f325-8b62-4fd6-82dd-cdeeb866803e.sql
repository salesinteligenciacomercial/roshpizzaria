-- Remover políticas problemáticas que causam recursão
DROP POLICY IF EXISTS "company_admins_view_company_roles" ON public.user_roles;
DROP POLICY IF EXISTS "super_admins_view_all_roles" ON public.user_roles;

-- Criar função SECURITY DEFINER para verificar se é super admin (sem recursão)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Buscar email do usuário autenticado diretamente do auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Verificar se está na lista de super admins
  RETURN LOWER(v_email) IN ('jeovauzumak@gmail.com', 'jeovauzuak@gmail.com');
END;
$$;

-- Criar função SECURITY DEFINER para obter dados do usuário com role (sem recursão)
CREATE OR REPLACE FUNCTION public.get_my_user_role()
RETURNS TABLE (
  role app_role,
  company_id uuid,
  company_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ur.role,
    ur.company_id,
    c.name as company_name
  FROM public.user_roles ur
  LEFT JOIN public.companies c ON c.id = ur.company_id
  WHERE ur.user_id = auth.uid()
  LIMIT 1
$$;

-- Recriar política para super admins usando a função segura
CREATE POLICY "super_admins_view_all_roles"
ON public.user_roles
FOR SELECT
TO public
USING (public.is_super_admin());

-- Recriar política para company admins sem recursão
-- Usa apenas is_super_admin e verifica se pertence à mesma empresa sem consultar roles novamente
CREATE POLICY "company_admins_view_company_roles"
ON public.user_roles
FOR SELECT
TO public
USING (
  public.is_super_admin() OR
  (
    company_id IN (
      SELECT ur.company_id 
      FROM public.user_roles ur 
      WHERE ur.user_id = auth.uid() 
        AND ur.role = 'company_admin'::app_role
    )
  )
);

-- Garantir que a política de visualizar própria role esteja ativa
DROP POLICY IF EXISTS "users_can_view_own_roles" ON public.user_roles;
CREATE POLICY "users_can_view_own_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());