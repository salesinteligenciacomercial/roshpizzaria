-- ⚡ MIGRAÇÃO DEFINITIVA: Preencher assinaturas para TODAS as mensagens enviadas
-- Esta migração garante que todas as mensagens enviadas (fromme = true) tenham assinatura

-- PASSO 1: Preencher sent_by baseado no owner_id (quando disponível)
UPDATE public.conversas c
SET sent_by = COALESCE(
  (SELECT p.full_name FROM public.profiles p WHERE p.id = c.owner_id),
  (SELECT p.email FROM public.profiles p WHERE p.id = c.owner_id),
  'Equipe'
)
WHERE c.fromme = true
  AND (c.sent_by IS NULL OR c.sent_by = '' OR TRIM(c.sent_by) = '');

-- PASSO 2: Para mensagens sem owner_id mas com company_id, usar primeiro usuário da empresa
UPDATE public.conversas c
SET sent_by = COALESCE(
  (
    SELECT p.full_name 
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    WHERE ur.company_id = c.company_id
    AND p.full_name IS NOT NULL 
    AND TRIM(p.full_name) != ''
    LIMIT 1
  ),
  'Equipe'
)
WHERE c.fromme = true
  AND c.owner_id IS NULL
  AND c.company_id IS NOT NULL
  AND (c.sent_by IS NULL OR c.sent_by = '' OR TRIM(c.sent_by) = '');

-- PASSO 3: Fallback final - mensagens enviadas que ainda não têm assinatura
UPDATE public.conversas
SET sent_by = 'Equipe'
WHERE fromme = true
  AND (sent_by IS NULL OR sent_by = '' OR TRIM(sent_by) = '');

-- Log de verificação
DO $$
DECLARE
  total_enviadas integer;
  com_assinatura integer;
  sem_assinatura integer;
BEGIN
  SELECT COUNT(*) INTO total_enviadas FROM public.conversas WHERE fromme = true;
  SELECT COUNT(*) INTO com_assinatura FROM public.conversas WHERE fromme = true AND sent_by IS NOT NULL AND TRIM(sent_by) != '';
  SELECT COUNT(*) INTO sem_assinatura FROM public.conversas WHERE fromme = true AND (sent_by IS NULL OR TRIM(sent_by) = '');
  
  RAISE NOTICE '📊 Relatório de Assinaturas:';
  RAISE NOTICE '   Total de mensagens enviadas: %', total_enviadas;
  RAISE NOTICE '   Com assinatura: %', com_assinatura;
  RAISE NOTICE '   Sem assinatura (restantes): %', sem_assinatura;
END $$;




