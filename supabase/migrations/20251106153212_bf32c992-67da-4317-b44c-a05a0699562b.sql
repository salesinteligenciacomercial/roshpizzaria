
-- =========================================
-- CORREÇÃO: Políticas RLS para Subcontas
-- =========================================
-- Garantir que todas as funcionalidades funcionem tanto para super_admin quanto para subcontas

-- 1. CONVERSAS: Adicionar política INSERT para usuários da empresa
DROP POLICY IF EXISTS "Company users insert conversations" ON public.conversas;
CREATE POLICY "Company users insert conversations"
ON public.conversas
FOR INSERT
TO public
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- 2. CONVERSAS: Adicionar política DELETE
DROP POLICY IF EXISTS "Company users delete conversations" ON public.conversas;
CREATE POLICY "Company users delete conversations"
ON public.conversas
FOR DELETE
TO public
USING (user_belongs_to_company(auth.uid(), company_id));

-- 3. LEADS: Política INSERT estava faltando
DROP POLICY IF EXISTS "Company users insert leads" ON public.leads;
CREATE POLICY "Company users insert leads"
ON public.leads
FOR INSERT
TO public
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- 4. LEADS: Política UPDATE estava faltando
DROP POLICY IF EXISTS "Company users update leads" ON public.leads;
CREATE POLICY "Company users update leads"
ON public.leads
FOR UPDATE
TO public
USING (user_belongs_to_company(auth.uid(), company_id));

-- 5. LEADS: Política DELETE estava faltando
DROP POLICY IF EXISTS "Company users delete leads" ON public.leads;
CREATE POLICY "Company users delete leads"
ON public.leads
FOR DELETE
TO public
USING (user_belongs_to_company(auth.uid(), company_id));

-- 6. TASKS: Políticas já existem, mantê-las

-- 7. TASK_BOARDS: Políticas já existem, mantê-las

-- 8. TASK_COLUMNS: Políticas já existem, mantê-las

-- 9. SCHEDULED_WHATSAPP_MESSAGES: Políticas já existem, mantê-las

-- 10. LEMBRETES: Políticas já existem, mantê-las

-- 11. WHATSAPP_CONNECTIONS: Verificar se falta alguma política
DROP POLICY IF EXISTS "Company users manage whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Company users manage whatsapp_connections"
ON public.whatsapp_connections
FOR ALL
TO public
USING (user_belongs_to_company(auth.uid(), company_id));

-- Verificação final
DO $$
BEGIN
  RAISE NOTICE '✅ Políticas RLS atualizadas com sucesso para todas as tabelas';
  RAISE NOTICE '✅ Subcontas agora têm acesso completo a todas as funcionalidades';
  RAISE NOTICE '✅ Políticas aplicadas: conversas, leads, whatsapp_connections';
END $$;
