-- Corrigir avisos de segurança das políticas RLS permissivas

-- Remover políticas permissivas de ia_commercial_metrics
DROP POLICY IF EXISTS "System can insert/update metrics" ON public.ia_commercial_metrics;
DROP POLICY IF EXISTS "System can update metrics" ON public.ia_commercial_metrics;

-- Criar políticas mais seguras para ia_commercial_metrics (edge functions usam service role)
CREATE POLICY "Users can insert metrics for their company"
  ON public.ia_commercial_metrics FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update metrics for their company"
  ON public.ia_commercial_metrics FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Corrigir função com search_path
DROP FUNCTION IF EXISTS public.update_ia_intelligence_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION public.update_ia_intelligence_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recriar triggers
CREATE TRIGGER update_ia_lead_intelligence_updated_at
  BEFORE UPDATE ON public.ia_lead_intelligence
  FOR EACH ROW EXECUTE FUNCTION public.update_ia_intelligence_updated_at();

CREATE TRIGGER update_ia_cadence_rules_updated_at
  BEFORE UPDATE ON public.ia_cadence_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_ia_intelligence_updated_at();

CREATE TRIGGER update_ia_scripts_updated_at
  BEFORE UPDATE ON public.ia_scripts
  FOR EACH ROW EXECUTE FUNCTION public.update_ia_intelligence_updated_at();

CREATE TRIGGER update_ia_commercial_metrics_updated_at
  BEFORE UPDATE ON public.ia_commercial_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_ia_intelligence_updated_at();