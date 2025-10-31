-- Criar tabela para comentários de leads no funil
CREATE TABLE IF NOT EXISTS public.lead_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_comments_lead_id ON public.lead_comments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_comments_user_id ON public.lead_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_comments_created_at ON public.lead_comments(created_at DESC);

-- Políticas RLS (Row Level Security)
ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;

-- Política para permitir usuários verem comentários de leads da mesma empresa
CREATE POLICY "Users can view comments from leads in their company" ON public.lead_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.user_roles ur ON ur.company_id = l.company_id
      WHERE l.id = lead_comments.lead_id
      AND ur.user_id = auth.uid()
    )
  );

-- Política para permitir usuários criarem comentários em leads da mesma empresa
CREATE POLICY "Users can create comments on leads in their company" ON public.lead_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      JOIN public.user_roles ur ON ur.company_id = l.company_id
      WHERE l.id = lead_comments.lead_id
      AND ur.user_id = auth.uid()
    )
  );

-- Política para permitir usuários atualizarem seus próprios comentários
CREATE POLICY "Users can update their own comments" ON public.lead_comments
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Política para permitir usuários deletarem seus próprios comentários
CREATE POLICY "Users can delete their own comments" ON public.lead_comments
  FOR DELETE USING (user_id = auth.uid());
