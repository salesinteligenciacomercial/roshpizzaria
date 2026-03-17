
-- 1. Tabela de interações individuais por lead
CREATE TABLE public.prospecting_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  daily_log_id UUID,
  log_type TEXT NOT NULL DEFAULT 'prospecting',
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_name TEXT,
  lead_phone TEXT,
  user_id UUID NOT NULL,
  interaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  channel TEXT,
  script_used TEXT,
  outcome TEXT NOT NULL DEFAULT 'contacted',
  interaction_summary TEXT,
  gross_value NUMERIC DEFAULT 0,
  next_action TEXT,
  next_action_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prospecting_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view interactions in their company"
ON public.prospecting_interactions FOR SELECT
USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Users can insert interactions in their company"
ON public.prospecting_interactions FOR INSERT
WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Users can update interactions in their company"
ON public.prospecting_interactions FOR UPDATE
USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Users can delete interactions in their company"
ON public.prospecting_interactions FOR DELETE
USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE TRIGGER update_prospecting_interactions_updated_at
BEFORE UPDATE ON public.prospecting_interactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabela de scripts reutilizáveis
CREATE TABLE public.prospecting_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'geral',
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prospecting_scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scripts in their company"
ON public.prospecting_scripts FOR SELECT
USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Users can insert scripts in their company"
ON public.prospecting_scripts FOR INSERT
WITH CHECK (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Users can update scripts in their company"
ON public.prospecting_scripts FOR UPDATE
USING (company_id IN (SELECT public.get_user_company_ids()));

CREATE POLICY "Users can delete scripts in their company"
ON public.prospecting_scripts FOR DELETE
USING (company_id IN (SELECT public.get_user_company_ids()));
