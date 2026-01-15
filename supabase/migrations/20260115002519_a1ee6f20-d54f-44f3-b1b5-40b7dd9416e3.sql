-- =====================================================
-- FASE 1-5: MELHORIAS DO SISTEMA DE INTELIGÊNCIA COMERCIAL
-- =====================================================

-- 1. Tabela para rastrear progresso de cadências por lead
CREATE TABLE IF NOT EXISTS public.lead_cadence_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cadence_rule_id UUID REFERENCES public.ia_cadence_rules(id) ON DELETE SET NULL,
  cadence_name TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  total_steps INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_steps JSONB DEFAULT '[]'::jsonb,
  next_action_at TIMESTAMPTZ,
  next_action_channel TEXT,
  next_action_description TEXT,
  assigned_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_lead_cadence_progress_lead_id ON public.lead_cadence_progress(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_cadence_progress_company_id ON public.lead_cadence_progress(company_id);
CREATE INDEX IF NOT EXISTS idx_lead_cadence_progress_status ON public.lead_cadence_progress(status);
CREATE INDEX IF NOT EXISTS idx_lead_cadence_progress_next_action ON public.lead_cadence_progress(next_action_at) WHERE status = 'active';

-- 3. Habilitar RLS
ALTER TABLE public.lead_cadence_progress ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS
CREATE POLICY "Users can view cadence progress of their company" 
ON public.lead_cadence_progress FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert cadence progress for their company" 
ON public.lead_cadence_progress FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update cadence progress of their company" 
ON public.lead_cadence_progress FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete cadence progress of their company" 
ON public.lead_cadence_progress FOR DELETE 
USING (
  company_id IN (
    SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 5. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_lead_cadence_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_lead_cadence_progress_timestamp
  BEFORE UPDATE ON public.lead_cadence_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_lead_cadence_progress_updated_at();

-- 6. Habilitar Realtime para lead_cadence_progress
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_cadence_progress;

-- 7. Adicionar colunas extras na tabela ia_commercial_alerts para ações
ALTER TABLE public.ia_commercial_alerts 
ADD COLUMN IF NOT EXISTS action_buttons JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS auto_action_type TEXT,
ADD COLUMN IF NOT EXISTS auto_action_data JSONB;

-- 8. Adicionar colunas para métricas de scripts
ALTER TABLE public.ia_scripts
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS conversion_count INTEGER DEFAULT 0;

-- 9. Adicionar índice de última análise para cron job
CREATE INDEX IF NOT EXISTS idx_ia_lead_intelligence_last_analysis 
ON public.ia_lead_intelligence(last_analysis_at);

-- 10. Adicionar constraint unique para lead_id em lead_cadence_progress (um lead pode ter apenas uma cadência ativa)
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_cadence_unique_active 
ON public.lead_cadence_progress(lead_id) 
WHERE status = 'active';