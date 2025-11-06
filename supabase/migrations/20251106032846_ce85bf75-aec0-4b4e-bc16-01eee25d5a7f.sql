-- Adicionar colunas faltantes na tabela conversas para suportar grupos e roteamento
ALTER TABLE public.conversas 
ADD COLUMN IF NOT EXISTS fromMe boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_group boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS fila_id uuid REFERENCES public.filas_atendimento(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_conversas_company_telefone ON public.conversas(company_id, telefone_formatado);
CREATE INDEX IF NOT EXISTS idx_conversas_assigned_user ON public.conversas(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_conversas_fila ON public.conversas(fila_id);