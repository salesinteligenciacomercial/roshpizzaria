-- Restringir criação de companies apenas para super_admin
DROP POLICY IF EXISTS "Admins can create companies" ON public.companies;

CREATE POLICY "Only super admins create companies"
ON public.companies
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'super_admin'::app_role)
);


