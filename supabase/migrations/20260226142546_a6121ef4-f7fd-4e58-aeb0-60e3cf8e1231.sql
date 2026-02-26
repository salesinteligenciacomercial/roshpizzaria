
CREATE TABLE public.conversation_ai_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  ai_mode TEXT NOT NULL DEFAULT 'off' CHECK (ai_mode IN ('off', 'atendimento', 'agendamento', 'fluxo', 'all')),
  activated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, company_id)
);

-- Index for fast lookup by conversation
CREATE INDEX idx_conversation_ai_settings_lookup ON public.conversation_ai_settings(conversation_id, company_id);

-- Updated_at trigger
CREATE TRIGGER update_conversation_ai_settings_updated_at
  BEFORE UPDATE ON public.conversation_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.conversation_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view AI settings for their company"
  ON public.conversation_ai_settings FOR SELECT
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can insert AI settings for their company"
  ON public.conversation_ai_settings FOR INSERT
  WITH CHECK (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can update AI settings for their company"
  ON public.conversation_ai_settings FOR UPDATE
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can delete AI settings for their company"
  ON public.conversation_ai_settings FOR DELETE
  USING (company_id IN (SELECT get_user_company_ids()));
