-- Remover políticas existentes que podem estar causando conflito
DROP POLICY IF EXISTS "Company admins can update company user profiles" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can view company user profiles" ON public.profiles;

-- Recriar política de UPDATE com WITH CHECK
CREATE POLICY "Company admins can update company user profiles"
ON public.profiles
FOR UPDATE
USING (
  -- Super admin pode editar qualquer profile
  is_super_admin() 
  OR 
  -- Company admin pode editar profiles de usuários da mesma empresa
  (
    id IN (
      SELECT ur1.user_id
      FROM public.user_roles ur1
      WHERE ur1.company_id IN (
        SELECT ur2.company_id
        FROM public.user_roles ur2
        WHERE ur2.user_id = auth.uid()
        AND ur2.role IN ('company_admin', 'super_admin')
      )
    )
  )
)
WITH CHECK (
  -- Super admin pode editar qualquer profile
  is_super_admin() 
  OR 
  -- Company admin pode editar profiles de usuários da mesma empresa
  (
    id IN (
      SELECT ur1.user_id
      FROM public.user_roles ur1
      WHERE ur1.company_id IN (
        SELECT ur2.company_id
        FROM public.user_roles ur2
        WHERE ur2.user_id = auth.uid()
        AND ur2.role IN ('company_admin', 'super_admin')
      )
    )
  )
);

-- Recriar política de SELECT
CREATE POLICY "Company admins can view company user profiles"
ON public.profiles
FOR SELECT
USING (
  -- Super admin pode ver qualquer profile
  is_super_admin() 
  OR 
  -- Company admin pode ver profiles de usuários da mesma empresa
  (
    id IN (
      SELECT ur1.user_id
      FROM public.user_roles ur1
      WHERE ur1.company_id IN (
        SELECT ur2.company_id
        FROM public.user_roles ur2
        WHERE ur2.user_id = auth.uid()
        AND ur2.role IN ('company_admin', 'super_admin')
      )
    )
  )
);