
-- Tabela de Processos Jurídicos
CREATE TABLE public.legal_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  numero_processo TEXT,
  tipo TEXT NOT NULL DEFAULT 'civil',
  vara TEXT,
  comarca TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  valor_causa NUMERIC DEFAULT 0,
  valor_honorarios NUMERIC DEFAULT 0,
  data_distribuicao DATE,
  data_audiencia TIMESTAMPTZ,
  parte_contraria TEXT,
  descricao TEXT,
  prioridade TEXT DEFAULT 'media',
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Movimentações/Eventos do Processo
CREATE TABLE public.legal_process_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.legal_processes(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL DEFAULT 'outro',
  descricao TEXT,
  data_evento DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar coluna legal_process_id na tabela tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS legal_process_id UUID REFERENCES public.legal_processes(id) ON DELETE SET NULL;

-- Adicionar coluna legal_process_id na tabela compromissos
ALTER TABLE public.compromissos ADD COLUMN IF NOT EXISTS legal_process_id UUID REFERENCES public.legal_processes(id) ON DELETE SET NULL;

-- Trigger para updated_at
CREATE TRIGGER update_legal_processes_updated_at
  BEFORE UPDATE ON public.legal_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.legal_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_process_events ENABLE ROW LEVEL SECURITY;

-- RLS policies for legal_processes
CREATE POLICY "Users can view legal processes of their company"
  ON public.legal_processes FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert legal processes for their company"
  ON public.legal_processes FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update legal processes of their company"
  ON public.legal_processes FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete legal processes of their company"
  ON public.legal_processes FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- RLS policies for legal_process_events
CREATE POLICY "Users can view legal process events of their company"
  ON public.legal_process_events FOR SELECT
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can insert legal process events for their company"
  ON public.legal_process_events FOR INSERT
  TO authenticated
  WITH CHECK (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can update legal process events of their company"
  ON public.legal_process_events FOR UPDATE
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

CREATE POLICY "Users can delete legal process events of their company"
  ON public.legal_process_events FOR DELETE
  TO authenticated
  USING (company_id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()));

-- Enable realtime for legal_processes
ALTER PUBLICATION supabase_realtime ADD TABLE public.legal_processes;
