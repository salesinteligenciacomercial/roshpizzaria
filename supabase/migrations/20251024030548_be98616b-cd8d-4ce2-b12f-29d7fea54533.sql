-- PARTE 1: CRIAR ESTRUTURA (sem atualizar dados)
CREATE TYPE public.app_role AS ENUM ('super_admin', 'company_admin', 'manager', 'sales', 'support');

CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  domain TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'basic',
  max_users INTEGER DEFAULT 5,
  max_leads INTEGER DEFAULT 1000,
  max_whatsapp_messages INTEGER DEFAULT 5000,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  instance_name TEXT UNIQUE NOT NULL,
  evolution_api_url TEXT,
  evolution_api_key TEXT,
  status TEXT DEFAULT 'disconnected',
  whatsapp_number TEXT,
  qr_code TEXT,
  qr_code_expires_at TIMESTAMPTZ,
  last_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(user_id, company_id)
);

-- Adicionar company_id às tabelas existentes
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.funis ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.etapas ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.task_boards ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.task_columns ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.compromissos ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.agendas ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.lembretes ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Criar funções SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role); $$;

CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1; $$;

CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id); $$;

-- Criar empresa padrão
INSERT INTO public.companies (name, status, owner_user_id)
SELECT 'Empresa Principal', 'active', id FROM auth.users LIMIT 1;

-- Criar role de super_admin
INSERT INTO public.user_roles (user_id, company_id, role)
SELECT u.id, c.id, 'super_admin'::app_role 
FROM auth.users u 
CROSS JOIN public.companies c 
LIMIT 1
ON CONFLICT (user_id, company_id) DO NOTHING;