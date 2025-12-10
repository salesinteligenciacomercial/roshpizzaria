-- Adicionar coluna midia_url à tabela lembretes para suportar envio de imagens/arquivos
ALTER TABLE public.lembretes 
ADD COLUMN IF NOT EXISTS midia_url TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.lembretes.midia_url IS 'URL da mídia (imagem/arquivo) a ser enviada junto com o lembrete';