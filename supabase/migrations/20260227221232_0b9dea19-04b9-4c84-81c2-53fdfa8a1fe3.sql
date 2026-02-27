CREATE POLICY "Public access capture page config"
ON public.companies
FOR SELECT
TO anon
USING (capture_page_config IS NOT NULL);