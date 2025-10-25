
-- Criar índices para otimizar queries de conversas
CREATE INDEX IF NOT EXISTS idx_conversas_company_created 
ON conversas(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversas_numero 
ON conversas(numero);

CREATE INDEX IF NOT EXISTS idx_conversas_lead 
ON conversas(lead_id);

CREATE INDEX IF NOT EXISTS idx_conversas_telefone_formatado 
ON conversas(telefone_formatado);

-- Criar índice composto para buscar última conversa por número
CREATE INDEX IF NOT EXISTS idx_conversas_company_numero_created 
ON conversas(company_id, numero, created_at DESC);
