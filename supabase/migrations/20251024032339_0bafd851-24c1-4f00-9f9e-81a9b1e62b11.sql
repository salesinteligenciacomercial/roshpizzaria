-- Atualizar conversa sem company_id para empresa principal
UPDATE conversas 
SET company_id = 'a3d2003b-486e-400e-a7ab-4d8d6cc331b6'
WHERE company_id IS NULL;