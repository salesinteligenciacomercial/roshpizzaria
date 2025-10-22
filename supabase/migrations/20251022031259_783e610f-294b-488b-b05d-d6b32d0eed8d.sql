-- Criar tabela de conversas para armazenar mensagens do WhatsApp
CREATE TABLE public.conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'WhatsApp',
  status TEXT NOT NULL DEFAULT 'Recebida',
  tipo_mensagem TEXT DEFAULT 'text',
  midia_url TEXT,
  nome_contato TEXT,
  owner_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_conversas_numero ON public.conversas(numero);
CREATE INDEX idx_conversas_owner ON public.conversas(owner_id);
CREATE INDEX idx_conversas_created_at ON public.conversas(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

-- Policies para acesso (permite acesso público para webhook do N8n)
CREATE POLICY "Todos podem inserir conversas"
  ON public.conversas
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ver conversas"
  ON public.conversas
  FOR SELECT
  USING (true);

CREATE POLICY "Usuários autenticados podem atualizar conversas"
  ON public.conversas
  FOR UPDATE
  USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_conversas_updated_at
  BEFORE UPDATE ON public.conversas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Habilitar Realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversas;