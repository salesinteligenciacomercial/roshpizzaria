-- Adicionar índices para otimizar carregamento de conversas
-- Índice para busca por company_id e ordenação por created_at
CREATE INDEX IF NOT EXISTS idx_conversas_company_created 
ON conversas(company_id, created_at DESC);

-- Índice para busca por telefone_formatado (usado em vinculação)
CREATE INDEX IF NOT EXISTS idx_conversas_telefone 
ON conversas(telefone_formatado) 
WHERE telefone_formatado IS NOT NULL;

-- Índice para busca por número (usado em queries)
CREATE INDEX IF NOT EXISTS idx_conversas_numero 
ON conversas(numero);

-- Índice composto para leads (otimiza busca de vinculação)
CREATE INDEX IF NOT EXISTS idx_leads_company_phone 
ON leads(company_id, phone);

CREATE INDEX IF NOT EXISTS idx_leads_company_telefone 
ON leads(company_id, telefone);