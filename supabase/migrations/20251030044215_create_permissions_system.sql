-- ============================================
-- 🔐 Sistema de Permissões Funcional
-- ============================================

-- Criar tabela de permissões específicas
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  module TEXT NOT NULL, -- 'leads', 'conversas', 'filas', 'relatorios', etc.
  action TEXT NOT NULL, -- 'create', 'read', 'update', 'delete', 'manage'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar tabela de associação role -> permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

-- Criar tabela de permissões customizadas por usuário
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT TRUE,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, permission_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON public.user_permissions(user_id);

-- Habilitar RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Anyone can view permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Super admins can manage permissions" ON public.permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Anyone can view role permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Super admins can manage role permissions" ON public.role_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

CREATE POLICY "Users can view their own permissions" ON public.user_permissions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Company admins can manage user permissions in their company" ON public.user_permissions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.company_id = ur2.company_id
    WHERE ur1.user_id = auth.uid()
    AND ur2.user_id = user_permissions.user_id
    AND ur1.role IN ('company_admin', 'super_admin')
  )
);

-- Inserir permissões padrão
INSERT INTO public.permissions (name, description, module, action) VALUES
-- Leads
('leads.create', 'Criar leads', 'leads', 'create'),
('leads.read', 'Visualizar leads', 'leads', 'read'),
('leads.update', 'Editar leads', 'leads', 'update'),
('leads.delete', 'Excluir leads', 'leads', 'delete'),
('leads.manage', 'Gerenciar leads (todas as ações)', 'leads', 'manage'),

-- Conversas
('conversas.create', 'Iniciar conversas', 'conversas', 'create'),
('conversas.read', 'Visualizar conversas', 'conversas', 'read'),
('conversas.update', 'Editar conversas', 'conversas', 'update'),
('conversas.delete', 'Excluir conversas', 'conversas', 'delete'),
('conversas.manage', 'Gerenciar conversas', 'conversas', 'manage'),

-- Filas
('filas.create', 'Criar filas', 'filas', 'create'),
('filas.read', 'Visualizar filas', 'filas', 'read'),
('filas.update', 'Editar filas', 'filas', 'update'),
('filas.delete', 'Excluir filas', 'filas', 'delete'),
('filas.manage', 'Gerenciar filas', 'filas', 'manage'),

-- Relatórios
('relatorios.read', 'Visualizar relatórios', 'relatorios', 'read'),
('relatorios.manage', 'Gerenciar relatórios', 'relatorios', 'manage'),

-- Usuários
('usuarios.create', 'Criar usuários', 'usuarios', 'create'),
('usuarios.read', 'Visualizar usuários', 'usuarios', 'read'),
('usuarios.update', 'Editar usuários', 'usuarios', 'update'),
('usuarios.delete', 'Excluir usuários', 'usuarios', 'delete'),
('usuarios.manage', 'Gerenciar usuários', 'usuarios', 'manage'),

-- WhatsApp
('whatsapp.create', 'Criar conexões WhatsApp', 'whatsapp', 'create'),
('whatsapp.read', 'Visualizar conexões WhatsApp', 'whatsapp', 'read'),
('whatsapp.update', 'Editar conexões WhatsApp', 'whatsapp', 'update'),
('whatsapp.delete', 'Excluir conexões WhatsApp', 'whatsapp', 'delete'),
('whatsapp.manage', 'Gerenciar WhatsApp', 'whatsapp', 'manage'),

-- Sistema
('sistema.config', 'Configurar sistema', 'sistema', 'manage'),
('sistema.logs', 'Visualizar logs', 'sistema', 'read')
ON CONFLICT (name) DO NOTHING;

-- Associar permissões aos roles padrão
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin'::app_role, p.id FROM public.permissions p
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'company_admin'::app_role, p.id FROM public.permissions p
WHERE p.module IN ('leads', 'conversas', 'filas', 'relatorios', 'usuarios', 'whatsapp')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'manager'::app_role, p.id FROM public.permissions p
WHERE p.module IN ('leads', 'conversas', 'relatorios')
AND p.action IN ('create', 'read', 'update')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'sales'::app_role, p.id FROM public.permissions p
WHERE p.module IN ('leads', 'conversas')
AND p.action IN ('create', 'read', 'update')
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'support'::app_role, p.id FROM public.permissions p
WHERE p.module IN ('conversas', 'filas')
AND p.action IN ('read', 'update')
ON CONFLICT (role, permission_id) DO NOTHING;

-- Função para verificar se usuário tem permissão
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    -- Verificar permissões customizadas do usuário
    SELECT 1 FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = _user_id
    AND p.name = _permission_name
    AND up.granted = TRUE
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
  ) OR EXISTS (
    -- Verificar permissões do role do usuário
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
    AND p.name = _permission_name
  );
$$;

-- Função para verificar se usuário tem qualquer permissão em um módulo
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
    AND p.module = _module
  ) OR EXISTS (
    SELECT 1 FROM public.user_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = _user_id
    AND p.module = _module
    AND up.granted = TRUE
  );
$$;
