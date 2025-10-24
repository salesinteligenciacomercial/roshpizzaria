-- PARTE 2: POPULAR DADOS E RLS (COM DROPS)

DO $$
DECLARE
  default_company_id UUID;
BEGIN
  SELECT id INTO default_company_id FROM public.companies LIMIT 1;
  
  IF default_company_id IS NOT NULL THEN
    SET session_replication_role = replica;
    UPDATE public.leads SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.funis SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.etapas SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.conversas SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.tasks SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.task_boards SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.task_columns SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.compromissos SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.agendas SET company_id = default_company_id WHERE company_id IS NULL;
    UPDATE public.lembretes SET company_id = default_company_id WHERE company_id IS NULL;
    SET session_replication_role = DEFAULT;
  END IF;
END $$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Super admins view all companies" ON public.companies;
DROP POLICY IF EXISTS "Company members view their company" ON public.companies;
DROP POLICY IF EXISTS "Super admins manage companies" ON public.companies;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Company members view whatsapp" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Admins manage whatsapp" ON public.whatsapp_connections;

CREATE POLICY "Super admins view all companies" ON public.companies FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Company members view their company" ON public.companies FOR SELECT USING (id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Super admins manage companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role) OR (public.has_role(auth.uid(), 'company_admin'::app_role) AND company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR (public.has_role(auth.uid(), 'company_admin'::app_role) AND company_id = public.get_user_company_id(auth.uid())));
CREATE POLICY "Company members view whatsapp" ON public.whatsapp_connections FOR SELECT USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Admins manage whatsapp" ON public.whatsapp_connections FOR ALL USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR (public.has_role(auth.uid(), 'company_admin'::app_role) AND company_id = public.get_user_company_id(auth.uid())));

DROP POLICY IF EXISTS "Users can create leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view leads from their company" ON public.leads;
DROP POLICY IF EXISTS "Users can update their leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their leads" ON public.leads;
DROP POLICY IF EXISTS "Company users manage leads" ON public.leads;
CREATE POLICY "Company users manage leads" ON public.leads FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Todos podem inserir conversas" ON public.conversas;
DROP POLICY IF EXISTS "Usuários autenticados podem ver conversas" ON public.conversas;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar conversas" ON public.conversas;
DROP POLICY IF EXISTS "Webhook insert conversations" ON public.conversas;
DROP POLICY IF EXISTS "Company users view conversations" ON public.conversas;
DROP POLICY IF EXISTS "Company users update conversations" ON public.conversas;
CREATE POLICY "Webhook insert conversations" ON public.conversas FOR INSERT WITH CHECK (true);
CREATE POLICY "Company users view conversations" ON public.conversas FOR SELECT USING (public.user_belongs_to_company(auth.uid(), company_id));
CREATE POLICY "Company users update conversations" ON public.conversas FOR UPDATE USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create funis" ON public.funis;
DROP POLICY IF EXISTS "Users can view their company funis" ON public.funis;
DROP POLICY IF EXISTS "Users can update their company funis" ON public.funis;
DROP POLICY IF EXISTS "Users can delete their company funis" ON public.funis;
DROP POLICY IF EXISTS "Company users manage funis" ON public.funis;
CREATE POLICY "Company users manage funis" ON public.funis FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create etapas" ON public.etapas;
DROP POLICY IF EXISTS "Users can view etapas from their funis" ON public.etapas;
DROP POLICY IF EXISTS "Users can update etapas from their funis" ON public.etapas;
DROP POLICY IF EXISTS "Users can delete etapas from their funis" ON public.etapas;
DROP POLICY IF EXISTS "Company users manage etapas" ON public.etapas;
CREATE POLICY "Company users manage etapas" ON public.etapas FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can view their company tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their company tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their company tasks" ON public.tasks;
DROP POLICY IF EXISTS "Company users manage tasks" ON public.tasks;
CREATE POLICY "Company users manage tasks" ON public.tasks FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create boards" ON public.task_boards;
DROP POLICY IF EXISTS "Users can view their company boards" ON public.task_boards;
DROP POLICY IF EXISTS "Users can update their company boards" ON public.task_boards;
DROP POLICY IF EXISTS "Users can delete their company boards" ON public.task_boards;
DROP POLICY IF EXISTS "Company users manage boards" ON public.task_boards;
CREATE POLICY "Company users manage boards" ON public.task_boards FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create columns" ON public.task_columns;
DROP POLICY IF EXISTS "Users can view columns from their boards" ON public.task_columns;
DROP POLICY IF EXISTS "Users can update columns from their boards" ON public.task_columns;
DROP POLICY IF EXISTS "Users can delete columns from their boards" ON public.task_columns;
DROP POLICY IF EXISTS "Company users manage columns" ON public.task_columns;
CREATE POLICY "Company users manage columns" ON public.task_columns FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Users can view their company compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Users can update their company compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Users can delete their company compromissos" ON public.compromissos;
DROP POLICY IF EXISTS "Company users manage compromissos" ON public.compromissos;
CREATE POLICY "Company users manage compromissos" ON public.compromissos FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can view their company agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can update their company agendas" ON public.agendas;
DROP POLICY IF EXISTS "Users can delete their company agendas" ON public.agendas;
DROP POLICY IF EXISTS "Company users manage agendas" ON public.agendas;
CREATE POLICY "Company users manage agendas" ON public.agendas FOR ALL USING (public.user_belongs_to_company(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can create lembretes" ON public.lembretes;
DROP POLICY IF EXISTS "Users can view lembretes from their compromissos" ON public.lembretes;
DROP POLICY IF EXISTS "Users can update lembretes from their compromissos" ON public.lembretes;
DROP POLICY IF EXISTS "Users can delete lembretes from their compromissos" ON public.lembretes;
DROP POLICY IF EXISTS "Company users manage lembretes" ON public.lembretes;
CREATE POLICY "Company users manage lembretes" ON public.lembretes FOR ALL USING (EXISTS (SELECT 1 FROM public.compromissos WHERE compromissos.id = lembretes.compromisso_id AND public.user_belongs_to_company(auth.uid(), compromissos.company_id)));