-- MIGRATION: ISOLAMENTO COMPLETO DE DADOS POR EMPRESA - CONVERSAS
-- Esta migration garante isolamento total de conversas por empresa

-- 1. Popular company_id nas conversas existentes (usando owner_id para determinar empresa)
UPDATE public.conversas
SET company_id = ur.company_id
FROM public.user_roles ur
WHERE conversas.owner_id = ur.user_id
AND conversas.company_id IS NULL;

-- 2. Para conversas sem owner_id, atribuir à empresa padrão (primeira empresa criada)
UPDATE public.conversas
SET company_id = (SELECT id FROM public.companies ORDER BY created_at LIMIT 1)
WHERE company_id IS NULL;

-- 3. Garantir que todas as conversas futuras tenham company_id obrigatório
ALTER TABLE public.conversas ALTER COLUMN company_id SET NOT NULL;

-- 4. Recriar políticas RLS com isolamento rigoroso
DROP POLICY IF EXISTS "Webhook insert conversations" ON public.conversas;
DROP POLICY IF EXISTS "Company users view conversations" ON public.conversas;
DROP POLICY IF EXISTS "Company users update conversations" ON public.conversas;
DROP POLICY IF EXISTS "Company users delete conversations" ON public.conversas;

-- Política para webhook inserir (mantém compatibilidade, mas company_id deve ser fornecido)
CREATE POLICY "Webhook insert conversations"
ON public.conversas
FOR INSERT
WITH CHECK (company_id IS NOT NULL);

-- Política para usuários da empresa verem apenas suas conversas
CREATE POLICY "Company users view conversations"
ON public.conversas
FOR SELECT
USING (public.user_belongs_to_company(auth.uid(), company_id));

-- Política para usuários atualizarem conversas da empresa
CREATE POLICY "Company users update conversations"
ON public.conversas
FOR UPDATE
USING (public.user_belongs_to_company(auth.uid(), company_id));

-- Política para usuários deletarem conversas da empresa
CREATE POLICY "Company users delete conversations"
ON public.conversas
FOR DELETE
USING (public.user_belongs_to_company(auth.uid(), company_id));

-- 5. Índice para melhorar performance das consultas filtradas por empresa
CREATE INDEX IF NOT EXISTS idx_conversas_company_id ON public.conversas(company_id);
CREATE INDEX IF NOT EXISTS idx_conversas_company_numero ON public.conversas(company_id, numero);

-- 6. Atualizar comentários da tabela
COMMENT ON TABLE public.conversas IS 'Conversas WhatsApp isoladas por empresa - company_id obrigatório';
COMMENT ON COLUMN public.conversas.company_id IS 'Empresa proprietária da conversa (obrigatório)';

-- 7. Verificação final: garantir que não há conversas sem company_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.conversas WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Existem conversas sem company_id após migration. Abortando.';
  END IF;
END $$;
