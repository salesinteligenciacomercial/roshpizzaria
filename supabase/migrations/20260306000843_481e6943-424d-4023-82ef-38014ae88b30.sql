
-- Tabela nvoip_config para armazenar NumberSIP por empresa
CREATE TABLE public.nvoip_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  number_sip text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.nvoip_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view nvoip_config"
  ON public.nvoip_config FOR SELECT
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company admins can manage nvoip_config"
  ON public.nvoip_config FOR ALL
  USING (user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER update_nvoip_config_updated_at
  BEFORE UPDATE ON public.nvoip_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Adicionar colunas à call_history
ALTER TABLE public.call_history ADD COLUMN IF NOT EXISTS nvoip_call_id text;
ALTER TABLE public.call_history ADD COLUMN IF NOT EXISTS recording_url text;

CREATE INDEX IF NOT EXISTS idx_call_history_nvoip_call_id ON public.call_history(nvoip_call_id) WHERE nvoip_call_id IS NOT NULL;
