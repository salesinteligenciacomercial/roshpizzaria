-- Recriar funções RPC de forma mais robusta e testada

-- 1. Remover funções antigas
DROP FUNCTION IF EXISTS public.get_my_company_id();
DROP FUNCTION IF EXISTS public.get_my_role();

-- 2. Criar função para obter company_id com melhor tratamento
CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Verificar se usuário está autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar company_id
  SELECT company_id INTO v_company_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Log para debug
  RAISE NOTICE 'get_my_company_id: user=%, company=%', auth.uid(), v_company_id;

  RETURN v_company_id;
END;
$$;

-- 3. Criar função para obter role com melhor tratamento
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS app_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role app_role;
BEGIN
  -- Verificar se usuário está autenticado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Buscar role
  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;

  -- Log para debug
  RAISE NOTICE 'get_my_role: user=%, role=%', auth.uid(), v_role;

  RETURN v_role;
END;
$$;

-- Adicionar comentários
COMMENT ON FUNCTION public.get_my_company_id IS 'Retorna company_id do usuário autenticado (versão robusta com logs)';
COMMENT ON FUNCTION public.get_my_role IS 'Retorna role do usuário autenticado (versão robusta com logs)';