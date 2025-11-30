-- ============================================================
-- 📝 SCRIPT PARA LIMPAR DUPLICATAS E CORRIGIR ASSINATURAS
-- ============================================================
-- Este script remove mensagens duplicadas criadas pelo webhook
-- e mantém apenas as mensagens com sent_by correto
-- ============================================================

-- PASSO 1: Identificar e marcar duplicatas para exclusão
-- Duplicatas são mensagens com mesmo conteúdo, telefone e timestamp aproximado (mesmo minuto)
-- Manter a mensagem que tem sent_by mais específico (não "Equipe")

-- Criar tabela temporária com IDs das mensagens a manter
CREATE TEMP TABLE mensagens_para_manter AS
SELECT DISTINCT ON (
  telefone_formatado, 
  LEFT(mensagem, 50), 
  fromme, 
  DATE_TRUNC('minute', created_at)
) 
  id,
  sent_by
FROM public.conversas
WHERE fromme = true
ORDER BY 
  telefone_formatado, 
  LEFT(mensagem, 50), 
  fromme, 
  DATE_TRUNC('minute', created_at),
  -- Priorizar mensagens com sent_by específico (não "Equipe" ou vazio)
  CASE 
    WHEN sent_by IS NOT NULL AND sent_by != '' AND sent_by != 'Equipe' THEN 0 
    ELSE 1 
  END,
  created_at ASC;

-- PASSO 2: Deletar duplicatas (mantendo apenas as marcadas)
DELETE FROM public.conversas
WHERE fromme = true
  AND id NOT IN (SELECT id FROM mensagens_para_manter);

-- PASSO 3: Atualizar sent_by que ainda está vazio ou "Equipe" baseado no owner_id
UPDATE public.conversas c
SET sent_by = COALESCE(
  (SELECT p.full_name FROM public.profiles p WHERE p.id = c.owner_id),
  (SELECT p.email FROM public.profiles p WHERE p.id = c.owner_id),
  c.sent_by,
  'Equipe'
)
WHERE c.fromme = true
  AND c.owner_id IS NOT NULL
  AND (c.sent_by IS NULL OR c.sent_by = '' OR c.sent_by = 'Equipe');

-- Limpar tabela temporária
DROP TABLE IF EXISTS mensagens_para_manter;

-- VERIFICAÇÃO: Mostrar estatísticas
SELECT 
  'Mensagens enviadas' as tipo,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE sent_by IS NOT NULL AND sent_by != '' AND sent_by != 'Equipe') as com_assinatura_especifica,
  COUNT(*) FILTER (WHERE sent_by = 'Equipe') as com_equipe,
  COUNT(*) FILTER (WHERE sent_by IS NULL OR sent_by = '') as sem_assinatura
FROM public.conversas
WHERE fromme = true;








