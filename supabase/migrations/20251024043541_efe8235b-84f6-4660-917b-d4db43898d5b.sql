-- Tabela para armazenar fluxos de automação visual
CREATE TABLE IF NOT EXISTS public.automation_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_automation_flows_company ON public.automation_flows(company_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_owner ON public.automation_flows(owner_id);
CREATE INDEX IF NOT EXISTS idx_automation_flows_active ON public.automation_flows(active);

-- RLS
ALTER TABLE public.automation_flows ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Company users manage flows"
ON public.automation_flows
FOR ALL
USING (user_belongs_to_company(auth.uid(), company_id));

-- Trigger para updated_at
CREATE TRIGGER update_automation_flows_updated_at
  BEFORE UPDATE ON public.automation_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para logs de execução de fluxos
CREATE TABLE IF NOT EXISTS public.automation_flow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  lead_id UUID,
  conversation_id UUID,
  execution_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'running', -- running, completed, failed
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  company_id UUID NOT NULL
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_flow_logs_flow ON public.automation_flow_logs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_logs_lead ON public.automation_flow_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_flow_logs_status ON public.automation_flow_logs(status);

-- RLS para logs
ALTER TABLE public.automation_flow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users view flow logs"
ON public.automation_flow_logs
FOR SELECT
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "System can insert flow logs"
ON public.automation_flow_logs
FOR INSERT
WITH CHECK (true);