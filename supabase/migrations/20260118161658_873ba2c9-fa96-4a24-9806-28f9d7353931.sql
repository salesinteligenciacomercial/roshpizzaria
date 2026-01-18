-- Tabela para rastrear scripts gerados por IA
CREATE TABLE public.ia_scripts_generated (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  context TEXT NOT NULL,
  script_content TEXT NOT NULL,
  objections_addressed TEXT[],
  key_points TEXT[],
  suggested_channel TEXT,
  was_used BOOLEAN DEFAULT false,
  got_response BOOLEAN,
  response_time_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ia_scripts_generated ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view scripts from their company"
ON public.ia_scripts_generated
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create scripts for their company"
ON public.ia_scripts_generated
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update scripts from their company"
ON public.ia_scripts_generated
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);

-- Index for faster queries
CREATE INDEX idx_ia_scripts_generated_lead ON public.ia_scripts_generated(lead_id);
CREATE INDEX idx_ia_scripts_generated_company ON public.ia_scripts_generated(company_id);

-- Trigger for updated_at
CREATE TRIGGER update_ia_scripts_generated_updated_at
BEFORE UPDATE ON public.ia_scripts_generated
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();