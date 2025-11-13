-- Remover TODAS as políticas que podem causar recursão
DROP POLICY IF EXISTS "company_admins_view_company_roles" ON public.user_roles;

-- Manter apenas as políticas simples e diretas
-- 1. Usuários veem suas próprias roles
-- (já existe: users_can_view_own_roles)

-- 2. Super admins veem tudo
-- (já existe: super_admins_view_all_roles)

-- 3. Criar nova política para company admins que NÃO cause recursão
-- Usar função SECURITY DEFINER que retorna TRUE/FALSE se usuário é company admin
CREATE OR REPLACE FUNCTION public.is_user_company_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role = 'company_admin'
  );
$$;

-- Nova política usando a função que não causa recursão
CREATE POLICY "company_admins_view_roles_safe" ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (
    -- Se é company admin E pertence à mesma empresa
    public.is_user_company_admin(auth.uid()) = true
    AND company_id = public.get_user_company_id(auth.uid())
  );

COMMENT ON FUNCTION public.is_user_company_admin IS 'Verifica se usuário é company admin sem causar recursão';
COMMENT ON POLICY "company_admins_view_roles_safe" ON public.user_roles IS 'Permite company admins verem roles de sua empresa (100% sem recursão)';