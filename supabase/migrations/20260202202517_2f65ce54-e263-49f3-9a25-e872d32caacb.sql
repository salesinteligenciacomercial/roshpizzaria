-- Add pixel_id to tenant_integrations
ALTER TABLE public.tenant_integrations 
ADD COLUMN IF NOT EXISTS pixel_id TEXT;

-- Create table for tracking pixel events
CREATE TABLE IF NOT EXISTS public.pixel_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  user_email TEXT,
  user_phone TEXT,
  fbc TEXT,
  fbp TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  event_source_url TEXT,
  custom_data JSONB,
  meta_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pixel_events ENABLE ROW LEVEL SECURITY;

-- Create policies for pixel_events
CREATE POLICY "Company members can view pixel events"
ON public.pixel_events FOR SELECT
USING (
  company_id IN (SELECT get_user_company_ids())
);

CREATE POLICY "System can insert pixel events"
ON public.pixel_events FOR INSERT
WITH CHECK (true);

-- Create index for performance
CREATE INDEX idx_pixel_events_company_id ON public.pixel_events(company_id);
CREATE INDEX idx_pixel_events_event_time ON public.pixel_events(event_time);
CREATE INDEX idx_pixel_events_lead_id ON public.pixel_events(lead_id);

-- Add realtime for pixel_events
ALTER PUBLICATION supabase_realtime ADD TABLE public.pixel_events;