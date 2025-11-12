-- Adiciona campo slug para links públicos das agendas
ALTER TABLE public.agendas
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Criar índice para busca rápida por slug
CREATE INDEX IF NOT EXISTS idx_agendas_slug ON public.agendas(slug);

-- Função para gerar slug único automaticamente (opcional, pode ser feito no frontend)
-- O slug será gerado no frontend baseado no nome do colaborador

-- Comentário para documentação
COMMENT ON COLUMN public.agendas.slug IS 'Slug único para acesso público à agenda (ex: drjeohvah, medico-cardiologista)';

