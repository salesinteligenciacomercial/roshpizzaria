-- Atualizar mensagens antigas sem sent_by
-- Preencher sent_by baseado no owner_id das mensagens enviadas pelos usuários

UPDATE public.conversas c
SET sent_by = p.full_name
FROM public.profiles p
WHERE c.owner_id = p.id
  AND c.fromme = true
  AND (c.sent_by IS NULL OR c.sent_by = '');

-- Log quantas mensagens foram atualizadas
DO $$
DECLARE
  updated_count integer;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Atualizadas % mensagens com assinatura do remetente', updated_count;
END $$;