-- ✅ CORREÇÃO CRÍTICA: Política RLS para permitir webhook inserir conversas
-- O webhook usa SERVICE_ROLE_KEY então pode inserir diretamente

-- Remover política antiga de webhook se existir
DROP POLICY IF EXISTS "Webhook insert conversations" ON public.conversas;

-- Criar nova política que permite inserção via service_role (webhook)
-- Service role bypassa RLS automaticamente, então não precisamos de política
-- Mas vamos manter uma política explícita para documentação

CREATE POLICY "Service role insert conversations"
ON public.conversas
FOR INSERT
TO service_role
WITH CHECK (true);

-- Adicionar comentário para documentação
COMMENT ON POLICY "Service role insert conversations" ON public.conversas IS 
'Permite que o webhook (usando service_role) insira conversas sem restrições RLS';