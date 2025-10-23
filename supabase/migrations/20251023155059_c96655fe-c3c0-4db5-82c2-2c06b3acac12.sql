-- Criar tabela de agendas (configurações de agenda por usuário/empresa)
CREATE TABLE public.agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'colaborador', -- 'principal' ou 'colaborador'
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  disponibilidade JSONB DEFAULT '{"dias": ["seg", "ter", "qua", "qui", "sex"], "horario_inicio": "08:00", "horario_fim": "18:00"}'::jsonb,
  tempo_medio_servico INTEGER DEFAULT 30, -- em minutos
  capacidade_simultanea INTEGER DEFAULT 1,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de compromissos
CREATE TABLE public.compromissos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agenda_id UUID REFERENCES public.agendas(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  usuario_responsavel_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  data_hora_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_hora_fim TIMESTAMP WITH TIME ZONE NOT NULL,
  tipo_servico TEXT NOT NULL,
  status TEXT DEFAULT 'agendado', -- 'agendado', 'concluido', 'cancelado'
  observacoes TEXT,
  custo_estimado NUMERIC(10, 2),
  lembrete_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de lembretes
CREATE TABLE public.lembretes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  compromisso_id UUID REFERENCES public.compromissos(id) ON DELETE CASCADE NOT NULL,
  canal TEXT NOT NULL, -- 'whatsapp', 'email', 'push'
  horas_antecedencia INTEGER NOT NULL DEFAULT 24,
  mensagem TEXT,
  status_envio TEXT DEFAULT 'pendente', -- 'pendente', 'enviado', 'cancelado', 'erro'
  data_envio TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compromissos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agendas
CREATE POLICY "Users can view their company agendas"
  ON public.agendas FOR SELECT
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create agendas"
  ON public.agendas FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their company agendas"
  ON public.agendas FOR UPDATE
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company agendas"
  ON public.agendas FOR DELETE
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para compromissos
CREATE POLICY "Users can view their company compromissos"
  ON public.compromissos FOR SELECT
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create compromissos"
  ON public.compromissos FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their company compromissos"
  ON public.compromissos FOR UPDATE
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete their company compromissos"
  ON public.compromissos FOR DELETE
  USING (owner_id IN (SELECT id FROM profiles WHERE id = auth.uid()));

-- Políticas RLS para lembretes
CREATE POLICY "Users can view lembretes from their compromissos"
  ON public.lembretes FOR SELECT
  USING (compromisso_id IN (SELECT id FROM compromissos WHERE owner_id = auth.uid()));

CREATE POLICY "Users can create lembretes"
  ON public.lembretes FOR INSERT
  WITH CHECK (compromisso_id IN (SELECT id FROM compromissos WHERE owner_id = auth.uid()));

CREATE POLICY "Users can update lembretes from their compromissos"
  ON public.lembretes FOR UPDATE
  USING (compromisso_id IN (SELECT id FROM compromissos WHERE owner_id = auth.uid()));

CREATE POLICY "Users can delete lembretes from their compromissos"
  ON public.lembretes FOR DELETE
  USING (compromisso_id IN (SELECT id FROM compromissos WHERE owner_id = auth.uid()));

-- Triggers para atualizar updated_at
CREATE TRIGGER update_agendas_updated_at
  BEFORE UPDATE ON public.agendas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_compromissos_updated_at
  BEFORE UPDATE ON public.compromissos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para melhor performance
CREATE INDEX idx_compromissos_data_hora ON public.compromissos(data_hora_inicio);
CREATE INDEX idx_compromissos_usuario ON public.compromissos(usuario_responsavel_id);
CREATE INDEX idx_compromissos_lead ON public.compromissos(lead_id);
CREATE INDEX idx_lembretes_status ON public.lembretes(status_envio);
