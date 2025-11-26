-- Adicionar coluna sent_by na tabela conversas para salvar permanentemente o nome do usuário que enviou
ALTER TABLE public.conversas 
ADD COLUMN IF NOT EXISTS sent_by TEXT;