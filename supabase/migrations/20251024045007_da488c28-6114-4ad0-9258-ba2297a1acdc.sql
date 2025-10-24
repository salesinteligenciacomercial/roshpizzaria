-- Extend app_role enum with additional roles
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'gestor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'suporte';

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  module text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id uuid REFERENCES public.permissions(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(role, permission_id, company_id)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for permissions
CREATE POLICY "Everyone can view permissions"
ON public.permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Super admins manage permissions"
ON public.permissions FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'));

-- RLS Policies for role_permissions
CREATE POLICY "Company users view role permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (user_belongs_to_company(auth.uid(), company_id) OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Company admins manage role permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'super_admin') OR 
  (has_role(auth.uid(), 'company_admin') AND user_belongs_to_company(auth.uid(), company_id))
);

-- Insert default permissions
INSERT INTO public.permissions (name, description, module, action) VALUES
  ('leads.view', 'Visualizar leads', 'leads', 'view'),
  ('leads.create', 'Criar leads', 'leads', 'create'),
  ('leads.edit', 'Editar leads', 'leads', 'edit'),
  ('leads.delete', 'Excluir leads', 'leads', 'delete'),
  ('funil.view', 'Visualizar funil', 'funil', 'view'),
  ('funil.edit', 'Editar funil', 'funil', 'edit'),
  ('conversas.view', 'Visualizar conversas', 'conversas', 'view'),
  ('conversas.send', 'Enviar mensagens', 'conversas', 'send'),
  ('agenda.view', 'Visualizar agenda', 'agenda', 'view'),
  ('agenda.create', 'Criar compromissos', 'agenda', 'create'),
  ('agenda.edit', 'Editar compromissos', 'agenda', 'edit'),
  ('tarefas.view', 'Visualizar tarefas', 'tarefas', 'view'),
  ('tarefas.create', 'Criar tarefas', 'tarefas', 'create'),
  ('tarefas.edit', 'Editar tarefas', 'tarefas', 'edit'),
  ('fluxos.view', 'Visualizar fluxos', 'fluxos', 'view'),
  ('fluxos.edit', 'Editar fluxos', 'fluxos', 'edit'),
  ('relatorios.view', 'Visualizar relatórios', 'relatorios', 'view'),
  ('configuracoes.view', 'Visualizar configurações', 'configuracoes', 'view'),
  ('configuracoes.edit', 'Editar configurações', 'configuracoes', 'edit'),
  ('usuarios.view', 'Visualizar usuários', 'usuarios', 'view'),
  ('usuarios.manage', 'Gerenciar usuários', 'usuarios', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role AND ur.company_id = rp.company_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id
      AND p.name = _permission_name
  ) OR has_role(_user_id, 'super_admin') OR has_role(_user_id, 'company_admin');
$$;

-- Create test company
INSERT INTO public.companies (
  id,
  name,
  cnpj,
  plan,
  status,
  max_users,
  max_leads,
  settings
) VALUES (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'Empresa Teste CEUSIA',
  '00.000.000/0001-00',
  'premium',
  'active',
  50,
  10000,
  '{"telefone": "(00) 0000-0000", "responsavel": "Administrador Teste", "email": "teste@ceusia.app"}'::jsonb
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  settings = EXCLUDED.settings;