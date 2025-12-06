
-- Adicionar política para permitir que membros da empresa vejam os user_roles dos colegas
-- Isso é necessário para que usuários possam transferir atendimento, atribuir responsáveis, etc.

CREATE POLICY "company_members_view_company_roles"
ON public.user_roles
FOR SELECT
USING (
  company_id IN (
    SELECT ur.company_id 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid()
  )
);
