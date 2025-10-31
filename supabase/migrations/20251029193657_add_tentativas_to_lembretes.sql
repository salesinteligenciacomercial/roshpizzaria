-- Adicionar campo tentativas para sistema de retry
ALTER TABLE public.lembretes
ADD COLUMN IF NOT EXISTS tentativas INTEGER DEFAULT 0;

-- Adicionar campo proxima_tentativa para controlar backoff
ALTER TABLE public.lembretes
ADD COLUMN IF NOT EXISTS proxima_tentativa TIMESTAMP WITH TIME ZONE;

-- Atualizar status para incluir estados de retry
-- Os valores possíveis agora são: 'pendente', 'enviando', 'enviado', 'erro', 'retry'

