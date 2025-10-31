-- Criar tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  avatar_url TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile and company profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id OR
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.user_belongs_to_company_from_user_id(auth.uid(), id)
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can manage profiles"
  ON public.profiles
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role) OR
    public.user_belongs_to_company_from_user_id(auth.uid(), id)
  );

-- Função para criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil ao registrar usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Criar tabela de leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  value DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'novo',
  stage TEXT DEFAULT 'prospeccao',
  owner_id UUID REFERENCES public.profiles(id),
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para leads
CREATE POLICY "Users can view leads from their company"
  ON public.leads
  FOR SELECT
  USING (
    owner_id IN (
      SELECT id FROM public.profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create leads"
  ON public.leads
  FOR INSERT
  WITH CHECK (
    owner_id = auth.uid()
  );

CREATE POLICY "Users can update their leads"
  ON public.leads
  FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their leads"
  ON public.leads
  FOR DELETE
  USING (owner_id = auth.uid());

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();