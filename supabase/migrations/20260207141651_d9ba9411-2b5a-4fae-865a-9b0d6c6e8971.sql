-- Tabela de bancos disponiveis
CREATE TABLE public.bancos_disponiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir bancos padrao para todas as empresas existentes
INSERT INTO public.bancos_disponiveis (company_id, nome) 
SELECT c.id, b.nome
FROM public.companies c
CROSS JOIN (VALUES 
  ('Digio'), ('C6 Bank'), ('Pan'), ('BMG'), 
  ('Itau'), ('Santander'), ('Happy'), ('Icred')
) AS b(nome);

-- Tabela de propostas bancarias
CREATE TABLE public.propostas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  banco TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('novo', 'refinanciamento', 'portabilidade_pura', 'portabilidade_refin')),
  valor_liberado NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'aguardando_cip', 'aguardando_averbacao', 'aguardando_pagamento', 'pendente', 'cancelado', 'pago')),
  motivo_cancelamento TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX idx_propostas_bancarias_company ON public.propostas_bancarias(company_id);
CREATE INDEX idx_propostas_bancarias_lead ON public.propostas_bancarias(lead_id);
CREATE INDEX idx_bancos_disponiveis_company ON public.bancos_disponiveis(company_id);

-- RLS
ALTER TABLE public.propostas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancos_disponiveis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage propostas of their company" ON public.propostas_bancarias
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage bancos of their company" ON public.bancos_disponiveis
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_propostas_bancarias_updated_at
  BEFORE UPDATE ON public.propostas_bancarias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();