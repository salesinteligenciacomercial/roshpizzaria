-- Adicionar coluna created_by na tabela lembretes para rastrear quem criou o lembrete
ALTER TABLE public.lembretes 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Comentário para documentação
COMMENT ON COLUMN public.lembretes.created_by IS 'ID do usuário que criou o lembrete';