-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Super admins manage companies" ON public.companies;
DROP POLICY IF EXISTS "Super admins view all companies" ON public.companies;
DROP POLICY IF EXISTS "Company members view their company" ON public.companies;

-- Create more permissive policies for company management
CREATE POLICY "Super admins full access to companies"
ON public.companies
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'))
WITH CHECK (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company admins can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'company_admin')
);

CREATE POLICY "Company admins view companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR 
  has_role(auth.uid(), 'company_admin') OR
  id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid())
);

CREATE POLICY "Company admins update their companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR 
  (has_role(auth.uid(), 'company_admin') AND id = get_user_company_id(auth.uid()))
)
WITH CHECK (
  has_role(auth.uid(), 'super_admin') OR 
  (has_role(auth.uid(), 'company_admin') AND id = get_user_company_id(auth.uid()))
);

CREATE POLICY "Only super admins can delete companies"
ON public.companies
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));