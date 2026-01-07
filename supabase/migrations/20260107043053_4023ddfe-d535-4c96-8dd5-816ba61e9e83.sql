-- Adicionar campos UTM e rastreamento na tabela leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS adset_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS campaign_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS form_id TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_source_type TEXT DEFAULT 'organic';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS ad_creative_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversion_timestamp TIMESTAMPTZ;

-- Tabela para mapear formulários de Lead Ads
CREATE TABLE IF NOT EXISTS public.lead_ad_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  form_name TEXT,
  auto_tags TEXT[] DEFAULT '{}',
  auto_funil_id UUID REFERENCES public.funis(id) ON DELETE SET NULL,
  auto_etapa_id UUID REFERENCES public.etapas(id) ON DELETE SET NULL,
  auto_responsavel_id UUID,
  auto_qualify_with_ia BOOLEAN DEFAULT true,
  qualification_prompt TEXT,
  notify_whatsapp BOOLEAN DEFAULT false,
  notify_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, form_id)
);

-- Habilitar RLS
ALTER TABLE public.lead_ad_forms ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lead_ad_forms
CREATE POLICY "Users can view their company lead ad forms"
  ON public.lead_ad_forms
  FOR SELECT
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can insert their company lead ad forms"
  ON public.lead_ad_forms
  FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can update their company lead ad forms"
  ON public.lead_ad_forms
  FOR UPDATE
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can delete their company lead ad forms"
  ON public.lead_ad_forms
  FOR DELETE
  USING (company_id IN (SELECT get_user_company_ids()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_lead_ad_forms_updated_at
  BEFORE UPDATE ON public.lead_ad_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON public.leads(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_lead_source_type ON public.leads(lead_source_type);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_ad_forms_form_id ON public.lead_ad_forms(form_id);
CREATE INDEX IF NOT EXISTS idx_lead_ad_forms_page_id ON public.lead_ad_forms(page_id);