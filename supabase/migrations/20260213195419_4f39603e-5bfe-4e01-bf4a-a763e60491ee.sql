
-- Tabela para armazenar estado do fluxo de conversa
CREATE TABLE public.conversation_flow_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_number TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES public.automation_flows(id) ON DELETE CASCADE,
  current_node_id TEXT NOT NULL,
  context_data JSONB DEFAULT '{}'::jsonb,
  waiting_for_input BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '30 minutes')
);

-- Índice único por número + empresa (apenas um estado ativo por conversa)
CREATE UNIQUE INDEX idx_conversation_flow_state_unique 
  ON public.conversation_flow_state(conversation_number, company_id);

-- Índice para limpeza de expirados
CREATE INDEX idx_conversation_flow_state_expires 
  ON public.conversation_flow_state(expires_at);

-- Enable RLS
ALTER TABLE public.conversation_flow_state ENABLE ROW LEVEL SECURITY;

-- Policies (service role acessa via edge functions, users podem ver da sua empresa)
CREATE POLICY "Users can view flow states of their company"
  ON public.conversation_flow_state
  FOR SELECT
  USING (company_id IN (SELECT get_user_company_ids()));

CREATE POLICY "Users can manage flow states of their company"
  ON public.conversation_flow_state
  FOR ALL
  USING (company_id IN (SELECT get_user_company_ids()));

-- Trigger para updated_at
CREATE TRIGGER update_conversation_flow_state_updated_at
  BEFORE UPDATE ON public.conversation_flow_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_flow_state;
