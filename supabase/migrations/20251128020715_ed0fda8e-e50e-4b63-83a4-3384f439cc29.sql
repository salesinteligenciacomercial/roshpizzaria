-- Preencher sent_by para TODAS as mensagens enviadas pela equipe que ainda estão sem assinatura
UPDATE conversas 
SET sent_by = (
  SELECT full_name 
  FROM profiles 
  WHERE profiles.id = conversas.owner_id
)
WHERE fromme = true 
  AND (sent_by IS NULL OR sent_by = '')
  AND owner_id IS NOT NULL;