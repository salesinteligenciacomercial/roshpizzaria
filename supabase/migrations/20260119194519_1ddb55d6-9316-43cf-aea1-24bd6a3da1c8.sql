-- Remover política permissiva e criar uma mais restritiva
DROP POLICY IF EXISTS "Service role can insert webhook logs" ON public.webhook_logs;

-- Permitir inserção apenas quando company_id é fornecido (Edge Functions usam service role que bypassa RLS)
-- Esta política permite inserção via anon key se necessário, mas a Edge Function usará service role
CREATE POLICY "Allow insert webhook logs with valid company"
ON public.webhook_logs FOR INSERT
WITH CHECK (company_id IS NOT NULL);