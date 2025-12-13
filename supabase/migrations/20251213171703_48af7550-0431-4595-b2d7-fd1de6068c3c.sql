-- Corrigir política RLS para whatsapp_connections
-- A política ALL precisa de WITH CHECK para permitir INSERT

DROP POLICY IF EXISTS "Company users manage whatsapp_connections" ON public.whatsapp_connections;

-- Política separada para INSERT com WITH CHECK
CREATE POLICY "Company users insert whatsapp_connections" 
ON public.whatsapp_connections 
FOR INSERT 
WITH CHECK (user_belongs_to_company(auth.uid(), company_id));

-- Política para SELECT
CREATE POLICY "Company users select whatsapp_connections" 
ON public.whatsapp_connections 
FOR SELECT 
USING (user_belongs_to_company(auth.uid(), company_id));

-- Política para UPDATE
CREATE POLICY "Company users update whatsapp_connections" 
ON public.whatsapp_connections 
FOR UPDATE 
USING (user_belongs_to_company(auth.uid(), company_id));

-- Política para DELETE
CREATE POLICY "Company users delete whatsapp_connections" 
ON public.whatsapp_connections 
FOR DELETE 
USING (user_belongs_to_company(auth.uid(), company_id));