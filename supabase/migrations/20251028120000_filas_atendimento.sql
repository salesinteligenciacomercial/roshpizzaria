-- ============================================
-- 📞 Filas de Atendimento (CRUD básico)
-- ============================================

CREATE TABLE IF NOT EXISTS public.filas_atendimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativa BOOLEAN DEFAULT TRUE,
  prioridade INT DEFAULT 0,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS idx_filas_owner_id ON public.filas_atendimento(owner_id);
CREATE INDEX IF NOT EXISTS idx_filas_prioridade ON public.filas_atendimento(prioridade);

-- Habilitar RLS
ALTER TABLE public.filas_atendimento ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (mesma linha das tabelas funis/etapas)
CREATE POLICY "Users can view their company filas"
  ON public.filas_atendimento FOR SELECT
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create filas"
  ON public.filas_atendimento FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their company filas"
  ON public.filas_atendimento FOR UPDATE
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company filas"
  ON public.filas_atendimento FOR DELETE
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- Trigger para manter updated_at
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE TRIGGER set_timestamp_filas
    BEFORE UPDATE ON public.filas_atendimento
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


