-- Adicionar campo de data de nascimento na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS data_nascimento DATE;
CREATE INDEX IF NOT EXISTS idx_leads_data_nascimento ON leads(data_nascimento);

-- Criar tabela de mensagens de aniversário
CREATE TABLE IF NOT EXISTS aniversario_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  midia_url TEXT,
  canal TEXT DEFAULT 'whatsapp',
  ativo BOOLEAN DEFAULT true,
  horario_envio TIME DEFAULT '09:00:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de histórico de envios
CREATE TABLE IF NOT EXISTS aniversario_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  mensagem_id UUID REFERENCES aniversario_mensagens(id) ON DELETE SET NULL,
  data_envio TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pendente',
  ano INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice único para evitar duplicatas no mesmo ano
CREATE UNIQUE INDEX IF NOT EXISTS idx_aniversario_envio_unico ON aniversario_envios(lead_id, ano);

-- Habilitar RLS
ALTER TABLE aniversario_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE aniversario_envios ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para aniversario_mensagens
CREATE POLICY "aniversario_mensagens_select" ON aniversario_mensagens
  FOR SELECT USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "aniversario_mensagens_insert" ON aniversario_mensagens
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "aniversario_mensagens_update" ON aniversario_mensagens
  FOR UPDATE USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "aniversario_mensagens_delete" ON aniversario_mensagens
  FOR DELETE USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

-- Políticas RLS para aniversario_envios
CREATE POLICY "aniversario_envios_select" ON aniversario_envios
  FOR SELECT USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "aniversario_envios_insert" ON aniversario_envios
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "aniversario_envios_update" ON aniversario_envios
  FOR UPDATE USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

-- Habilitar realtime para as novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE aniversario_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE aniversario_envios;