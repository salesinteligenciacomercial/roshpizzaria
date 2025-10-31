-- 🔧 Correção das permissões das subcontas
-- Garante que usuários company_admin tenham acesso completo às funcionalidades

-- 1. Verificar e corrigir políticas RLS para funis
DROP POLICY IF EXISTS "Company users manage funis" ON public.funis;
CREATE POLICY "Company users manage funis"
ON public.funis FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 2. Verificar e corrigir políticas RLS para tasks
DROP POLICY IF EXISTS "Company users manage tasks" ON public.tasks;
CREATE POLICY "Company users manage tasks"
ON public.tasks FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 3. Verificar e corrigir políticas RLS para task_boards
DROP POLICY IF EXISTS "Company users manage boards" ON public.task_boards;
CREATE POLICY "Company users manage boards"
ON public.task_boards FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 4. Verificar e corrigir políticas RLS para task_columns
DROP POLICY IF EXISTS "Company users manage columns" ON public.task_columns;
CREATE POLICY "Company users manage columns"
ON public.task_columns FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 5. Verificar e corrigir políticas RLS para leads
DROP POLICY IF EXISTS "Company users manage leads" ON public.leads;
CREATE POLICY "Company users manage leads"
ON public.leads FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 6. Verificar e corrigir políticas RLS para etapas
DROP POLICY IF EXISTS "Company users manage etapas" ON public.etapas;
CREATE POLICY "Company users manage etapas"
ON public.etapas FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 7. Verificar e corrigir políticas RLS para compromissos
DROP POLICY IF EXISTS "Company users manage compromissos" ON public.compromissos;
CREATE POLICY "Company users manage compromissos"
ON public.compromissos FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 8. Verificar e corrigir políticas RLS para conversas
DROP POLICY IF EXISTS "Company users view conversations" ON public.conversas;
DROP POLICY IF EXISTS "Company users update conversations" ON public.conversas;
CREATE POLICY "Company users manage conversations"
ON public.conversas FOR ALL
USING (public.user_belongs_to_company(auth.uid(), company_id))
WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

-- 9. Verificar e corrigir políticas RLS para whatsapp_connections
-- Garante que company_admins possam gerenciar suas próprias conexões
DROP POLICY IF EXISTS "Company members view whatsapp" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Admins manage whatsapp" ON public.whatsapp_connections;
CREATE POLICY "Company admins manage whatsapp"
ON public.whatsapp_connections FOR ALL
USING (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR
  (public.has_role(auth.uid(), 'company_admin'::app_role) AND
   company_id = public.get_user_company_id(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::app_role) OR
  (public.has_role(auth.uid(), 'company_admin'::app_role) AND
   company_id = public.get_user_company_id(auth.uid()))
);

-- 10. Verificar função user_belongs_to_company (recriar se necessário)
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;

-- 11. Verificar função get_user_company_id (recriar se necessário)
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1;
$$;

-- 12. Verificar função has_role (recriar se necessário)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
