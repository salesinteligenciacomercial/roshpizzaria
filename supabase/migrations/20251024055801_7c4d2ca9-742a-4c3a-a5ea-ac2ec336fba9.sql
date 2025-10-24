-- Atualizar conversas com company_id correto baseado no lead
UPDATE conversas 
SET company_id = leads.company_id
FROM leads
WHERE conversas.telefone_formatado = formatar_telefone(COALESCE(leads.telefone, leads.phone, ''))
  AND conversas.company_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  AND leads.company_id IS NOT NULL;