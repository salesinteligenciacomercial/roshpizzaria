-- Create notificacoes table for storing all notifications
CREATE TABLE public.notificacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  referencia_id UUID,
  referencia_tipo TEXT,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_notificacoes_usuario_id ON public.notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_company_id ON public.notificacoes(company_id);
CREATE INDEX idx_notificacoes_created_at ON public.notificacoes(created_at DESC);
CREATE INDEX idx_notificacoes_lida ON public.notificacoes(lida);

-- Enable Row Level Security
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own notifications" 
ON public.notificacoes 
FOR SELECT 
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can create their own notifications" 
ON public.notificacoes 
FOR INSERT 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notificacoes 
FOR UPDATE 
USING (auth.uid() = usuario_id);

CREATE POLICY "Users can delete their own notifications" 
ON public.notificacoes 
FOR DELETE 
USING (auth.uid() = usuario_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;