-- Adicionar colunas de controle de acesso aos módulos premium
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS allow_chat_equipe BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_reunioes BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_discador BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_processos_comerciais BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_automacao BOOLEAN DEFAULT false;