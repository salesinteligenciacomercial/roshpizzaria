-- Atualizar todas as conversas sem company_id para usar a primeira company
UPDATE conversas 
SET company_id = (SELECT id FROM companies LIMIT 1)
WHERE company_id IS NULL;