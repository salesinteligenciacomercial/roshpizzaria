-- Tabela para histórico de reuniões/chamadas
CREATE TABLE public.meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  created_by UUID NOT NULL,
  meeting_type TEXT NOT NULL DEFAULT 'internal', -- 'internal' ou 'external'
  call_type TEXT NOT NULL DEFAULT 'video', -- 'audio' ou 'video'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'ended', 'missed'
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  participants UUID[] DEFAULT ARRAY[]::UUID[],
  participant_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  public_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_meetings_company_id ON public.meetings(company_id);
CREATE INDEX idx_meetings_created_by ON public.meetings(created_by);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meetings_created_at ON public.meetings(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Company users view meetings" 
ON public.meetings 
FOR SELECT 
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users create meetings" 
ON public.meetings 
FOR INSERT 
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users update meetings" 
ON public.meetings 
FOR UPDATE 
USING (user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users delete meetings" 
ON public.meetings 
FOR DELETE 
USING (user_belongs_to_company(auth.uid(), company_id));

-- Tabela para sinalização WebRTC em tempo real
CREATE TABLE public.meeting_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  from_user UUID NOT NULL,
  to_user UUID NOT NULL,
  signal_type TEXT NOT NULL, -- 'offer', 'answer', 'ice-candidate', 'call-request', 'call-accept', 'call-reject', 'call-end'
  signal_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_signals_meeting ON public.meeting_signals(meeting_id);
CREATE INDEX idx_meeting_signals_to_user ON public.meeting_signals(to_user);
CREATE INDEX idx_meeting_signals_created ON public.meeting_signals(created_at DESC);

ALTER TABLE public.meeting_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their signals" 
ON public.meeting_signals 
FOR SELECT 
USING (auth.uid() = to_user OR auth.uid() = from_user);

CREATE POLICY "Users create signals" 
ON public.meeting_signals 
FOR INSERT 
WITH CHECK (auth.uid() = from_user);

CREATE POLICY "Users delete signals" 
ON public.meeting_signals 
FOR DELETE 
USING (auth.uid() = from_user OR auth.uid() = to_user);

-- Habilitar realtime para sinalização
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_signals;

-- Trigger para updated_at
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();