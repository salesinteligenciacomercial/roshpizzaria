-- Tabela para histórico de tags
CREATE TABLE IF NOT EXISTS public.lead_tag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('added', 'removed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_lead_tag_history_lead_id ON public.lead_tag_history(lead_id);
CREATE INDEX idx_lead_tag_history_company_id ON public.lead_tag_history(company_id);
CREATE INDEX idx_lead_tag_history_created_at ON public.lead_tag_history(created_at);
CREATE INDEX idx_lead_tag_history_tag_name ON public.lead_tag_history(tag_name);

-- RLS Policies
ALTER TABLE public.lead_tag_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tag history of their company"
  ON public.lead_tag_history FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert tag history for their company"
  ON public.lead_tag_history FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tag_history;