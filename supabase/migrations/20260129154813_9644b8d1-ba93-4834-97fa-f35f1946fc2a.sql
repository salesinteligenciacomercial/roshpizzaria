-- Tabela para rastrear atendimentos ativos
CREATE TABLE IF NOT EXISTS public.active_attendances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  telefone_formatado text NOT NULL,
  attending_user_id uuid NOT NULL,
  attending_user_name text,
  started_at timestamp with time zone DEFAULT now(),
  last_activity_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '5 minutes'),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(company_id, telefone_formatado)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_active_attendances_company ON public.active_attendances(company_id);
CREATE INDEX IF NOT EXISTS idx_active_attendances_expires ON public.active_attendances(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_attendances_telefone ON public.active_attendances(telefone_formatado);
CREATE INDEX IF NOT EXISTS idx_active_attendances_user ON public.active_attendances(attending_user_id);

-- RLS
ALTER TABLE public.active_attendances ENABLE ROW LEVEL SECURITY;

-- Política para SELECT - usuários podem ver atendimentos da sua empresa
CREATE POLICY "Users can view active attendances from their company" 
  ON public.active_attendances FOR SELECT 
  USING (company_id IN (SELECT get_user_company_ids()));

-- Política para INSERT
CREATE POLICY "Users can insert active attendances for their company" 
  ON public.active_attendances FOR INSERT 
  WITH CHECK (company_id IN (SELECT get_user_company_ids()));

-- Política para UPDATE
CREATE POLICY "Users can update active attendances for their company" 
  ON public.active_attendances FOR UPDATE 
  USING (company_id IN (SELECT get_user_company_ids()));

-- Política para DELETE
CREATE POLICY "Users can delete active attendances for their company" 
  ON public.active_attendances FOR DELETE 
  USING (company_id IN (SELECT get_user_company_ids()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_active_attendances_updated_at
  BEFORE UPDATE ON public.active_attendances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_attendances;