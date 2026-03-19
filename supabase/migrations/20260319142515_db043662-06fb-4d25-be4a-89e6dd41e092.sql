
CREATE TABLE public.disparo_campaigns (
  id TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_leads INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  message_type TEXT NOT NULL DEFAULT 'text',
  message_content TEXT,
  template_name TEXT,
  template_language TEXT,
  template_components JSONB,
  template_media_url TEXT,
  media_storage_url TEXT,
  delay_between_messages INTEGER NOT NULL DEFAULT 7,
  pause_after_messages INTEGER NOT NULL DEFAULT 15,
  pause_duration INTEGER NOT NULL DEFAULT 120,
  leads_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_details JSONB DEFAULT '[]'::jsonb,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.disparo_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company campaigns"
  ON public.disparo_campaigns FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert campaigns for their company"
  ON public.disparo_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access"
  ON public.disparo_campaigns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.disparo_campaigns;
