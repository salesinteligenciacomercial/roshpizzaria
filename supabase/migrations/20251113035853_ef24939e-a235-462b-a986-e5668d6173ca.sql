-- CORREÇÃO CRÍTICA: Remover recursão da policy company_admins_view_company_roles

-- 1. Dropar a policy com recursão
DROP POLICY IF EXISTS "company_admins_view_company_roles" ON public.user_roles;

-- 2. Recriar corretamente SEM RECURSÃO usando a função get_my_user_role()
CREATE POLICY "company_admins_view_company_roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (
  -- Super admins veem tudo
  public.is_super_admin() 
  OR
  -- Company admins veem roles da sua empresa (SEM RECURSÃO)
  (
    company_id = (SELECT company_id FROM public.get_my_user_role())
    AND
    (SELECT role FROM public.get_my_user_role()) = 'company_admin'::app_role
  )
);

-- 3. Garantir que a policy de ver próprios roles está ativa
DROP POLICY IF EXISTS "users_can_view_own_roles" ON public.user_roles;

CREATE POLICY "users_can_view_own_roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- 4. Garantir que super_admins veem tudo
DROP POLICY IF EXISTS "super_admins_view_all_roles" ON public.user_roles;

CREATE POLICY "super_admins_view_all_roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.is_super_admin());