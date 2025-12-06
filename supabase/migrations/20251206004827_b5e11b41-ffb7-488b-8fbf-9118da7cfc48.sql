-- Remover a política problemática que causa recursão infinita
DROP POLICY IF EXISTS "company_members_view_company_roles" ON public.user_roles;

-- Criar uma função SECURITY DEFINER para obter o company_id do usuário atual
-- Isso evita a recursão infinita pois a função bypassa as políticas RLS
CREATE OR REPLACE FUNCTION public.get_user_company_ids()
RETURNS TABLE(company_id uuid) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT user_roles.company_id FROM public.user_roles WHERE user_roles.user_id = auth.uid();
$$;

-- Recriar a política usando a função SECURITY DEFINER
CREATE POLICY "company_members_view_company_roles"
ON public.user_roles
FOR SELECT
USING (
  company_id IN (SELECT public.get_user_company_ids())
);