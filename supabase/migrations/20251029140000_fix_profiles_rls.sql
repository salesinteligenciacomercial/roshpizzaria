-- 🔧 Correção das políticas RLS da tabela profiles
-- Permite que admins vejam os perfis dos usuários de suas empresas

-- Criar função auxiliar para verificar se usuários pertencem à mesma empresa
CREATE OR REPLACE FUNCTION public.user_belongs_to_company_from_user_id(_current_user_id UUID, _target_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur1
    JOIN public.user_roles ur2 ON ur1.company_id = ur2.company_id
    WHERE ur1.user_id = _current_user_id AND ur2.user_id = _target_user_id
  );
$$;

-- Atualizar políticas RLS para profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

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
