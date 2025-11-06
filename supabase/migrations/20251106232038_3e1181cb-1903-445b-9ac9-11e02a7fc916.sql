-- Configurar REPLICA IDENTITY FULL para a tabela conversas
-- Isso garante que todos os campos sejam enviados via realtime
ALTER TABLE public.conversas REPLICA IDENTITY FULL;