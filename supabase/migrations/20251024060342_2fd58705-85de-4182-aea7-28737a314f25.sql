-- Criar lead para o número de telefone do teste
INSERT INTO leads (name, telefone, company_id, status, stage, owner_id)
SELECT 'Jeohvah Lima', '558791426333', 'a3d2003b-486e-400e-a7ab-4d8d6cc331b6', 'novo', 'prospeccao', '67d47823-930d-48ea-b0f4-3eb2ef6161c6'
WHERE NOT EXISTS (
  SELECT 1 FROM leads WHERE telefone = '558791426333' OR phone = '558791426333'
);

-- Atualizar TODAS as conversas com company_id errado para o correto
UPDATE conversas 
SET company_id = 'a3d2003b-486e-400e-a7ab-4d8d6cc331b6'
WHERE company_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' 
  OR company_id IS NULL;