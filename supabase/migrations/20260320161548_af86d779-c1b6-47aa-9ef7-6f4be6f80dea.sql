
-- Sequence per company for protocol numbers
CREATE SEQUENCE IF NOT EXISTS public.attendance_protocol_seq START 1;

-- Table to store attendance protocols
CREATE TABLE public.attendance_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocol_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  telefone_formatado TEXT NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  started_by TEXT NOT NULL DEFAULT 'humano',
  attending_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  attending_user_name TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_attendance_protocols_company_phone ON public.attendance_protocols(company_id, telefone_formatado);
CREATE INDEX idx_attendance_protocols_number ON public.attendance_protocols(protocol_number);
CREATE INDEX idx_attendance_protocols_status ON public.attendance_protocols(company_id, status);

-- Function to generate sequential protocol number per company
CREATE OR REPLACE FUNCTION public.generate_protocol_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_seq BIGINT;
  v_date TEXT;
  v_protocol TEXT;
BEGIN
  v_seq := nextval('attendance_protocol_seq');
  v_date := to_char(now(), 'YYYYMMDD');
  v_protocol := 'ATD-' || v_date || '-' || lpad(v_seq::text, 5, '0');
  RETURN v_protocol;
END;
$$;

-- Function to create a protocol (callable from edge functions and frontend)
CREATE OR REPLACE FUNCTION public.create_attendance_protocol(
  p_company_id UUID,
  p_telefone_formatado TEXT,
  p_channel TEXT DEFAULT 'whatsapp',
  p_started_by TEXT DEFAULT 'humano',
  p_attending_user_id UUID DEFAULT NULL,
  p_attending_user_name TEXT DEFAULT NULL,
  p_lead_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, protocol_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_protocol TEXT;
  v_id UUID;
  v_existing_id UUID;
  v_existing_protocol TEXT;
BEGIN
  -- Check for an existing open protocol for this contact
  SELECT ap.id, ap.protocol_number INTO v_existing_id, v_existing_protocol
  FROM public.attendance_protocols ap
  WHERE ap.company_id = p_company_id
    AND ap.telefone_formatado = p_telefone_formatado
    AND ap.status IN ('aberto', 'em_atendimento')
  ORDER BY ap.created_at DESC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- Return existing open protocol
    RETURN QUERY SELECT v_existing_id, v_existing_protocol;
    RETURN;
  END IF;

  -- Generate new protocol
  v_protocol := generate_protocol_number(p_company_id);

  INSERT INTO public.attendance_protocols (
    protocol_number, company_id, telefone_formatado, lead_id,
    channel, started_by, attending_user_id, attending_user_name, status
  ) VALUES (
    v_protocol, p_company_id, p_telefone_formatado, p_lead_id,
    p_channel, p_started_by, p_attending_user_id, p_attending_user_name, 'aberto'
  )
  RETURNING attendance_protocols.id INTO v_id;

  RETURN QUERY SELECT v_id, v_protocol;
END;
$$;

-- Enable RLS
ALTER TABLE public.attendance_protocols ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view protocols of their company"
  ON public.attendance_protocols FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert protocols for their company"
  ON public.attendance_protocols FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update protocols of their company"
  ON public.attendance_protocols FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_protocols;
