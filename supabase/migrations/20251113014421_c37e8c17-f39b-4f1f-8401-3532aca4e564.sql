-- Criar função segura para verificar se é super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  -- Buscar email do usuário autenticado
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Verificar se está na lista de super admins
  RETURN LOWER(v_email) IN ('jeovauzumak@gmail.com', 'jeovauzuak@gmail.com');
END;
$$;

-- Recriar policy de super admins usando a função segura
DROP POLICY IF EXISTS "super_admins_view_all_roles" ON public.user_roles;

CREATE POLICY "super_admins_view_all_roles" 
ON public.user_roles
FOR SELECT
USING (public.is_super_admin());

-- Permitir que company admins vejam roles da sua empresa
DROP POLICY IF EXISTS "company_admins_view_company_roles" ON public.user_roles;

CREATE POLICY "company_admins_view_company_roles"
ON public.user_roles
FOR SELECT
USING (
  company_id IN (
    SELECT ur.company_id 
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('company_admin', 'super_admin')
  )
);