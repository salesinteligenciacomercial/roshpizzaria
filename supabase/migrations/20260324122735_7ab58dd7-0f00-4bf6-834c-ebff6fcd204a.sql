CREATE POLICY "Users can update their company campaigns"
ON public.disparo_campaigns
FOR UPDATE
TO authenticated
USING (company_id IN (SELECT user_roles.company_id FROM user_roles WHERE user_roles.user_id = auth.uid()))
WITH CHECK (company_id IN (SELECT user_roles.company_id FROM user_roles WHERE user_roles.user_id = auth.uid()));