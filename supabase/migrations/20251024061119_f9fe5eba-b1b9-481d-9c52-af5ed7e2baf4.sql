-- Atualizar mensagens enviadas sem company_id para associar ao company_id correto
UPDATE conversas 
SET company_id = 'a3d2003b-486e-400e-a7ab-4d8d6cc331b6'
WHERE status = 'Enviada' 
  AND (company_id IS NULL OR company_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd')
  AND numero IN (
    SELECT DISTINCT numero FROM conversas WHERE company_id = 'a3d2003b-486e-400e-a7ab-4d8d6cc331b6'
  );