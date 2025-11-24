-- Permitir que usuários vejam perfis de membros da mesma empresa
CREATE POLICY "Company members can view other profiles"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT ur1.user_id
    FROM public.user_roles ur1
    WHERE ur1.company_id IN (
      SELECT ur2.company_id
      FROM public.user_roles ur2
      WHERE ur2.user_id = auth.uid()
    )
  )
);