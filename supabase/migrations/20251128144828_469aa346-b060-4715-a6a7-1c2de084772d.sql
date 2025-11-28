-- Criar tabela de profissionais vinculada ao auth.users
CREATE TABLE IF NOT EXISTS public.profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  especialidade TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

-- Política para company users gerenciarem profissionais
CREATE POLICY "Company users manage profissionais"
ON public.profissionais
FOR ALL
USING (user_belongs_to_company(auth.uid(), company_id));

-- Política para profissionais verem seus próprios dados
CREATE POLICY "Profissionais view own data"
ON public.profissionais
FOR SELECT
USING (auth.uid() = user_id);

-- Adicionar coluna profissional_id na tabela compromissos se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compromissos' 
    AND column_name = 'profissional_id'
  ) THEN
    ALTER TABLE public.compromissos 
    ADD COLUMN profissional_id UUID REFERENCES public.profissionais(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_profissionais_company_id ON public.profissionais(company_id);
CREATE INDEX IF NOT EXISTS idx_profissionais_user_id ON public.profissionais(user_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_profissional_id ON public.compromissos(profissional_id);

-- Adicionar colunas úteis na tabela compromissos se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compromissos' 
    AND column_name = 'titulo'
  ) THEN
    ALTER TABLE public.compromissos 
    ADD COLUMN titulo TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compromissos' 
    AND column_name = 'paciente'
  ) THEN
    ALTER TABLE public.compromissos 
    ADD COLUMN paciente TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compromissos' 
    AND column_name = 'telefone'
  ) THEN
    ALTER TABLE public.compromissos 
    ADD COLUMN telefone TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compromissos' 
    AND column_name = 'duracao'
  ) THEN
    ALTER TABLE public.compromissos 
    ADD COLUMN duracao INTEGER DEFAULT 30;
  END IF;
END $$;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_profissionais_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profissionais_updated_at
BEFORE UPDATE ON public.profissionais
FOR EACH ROW
EXECUTE FUNCTION update_profissionais_updated_at();