-- Função para buscar subcontas de uma conta mestre
-- Usa SECURITY DEFINER para contornar RLS e garantir que super_admins vejam suas subcontas
CREATE OR REPLACE FUNCTION public.get_my_subcontas()
RETURNS TABLE (
  id uuid,
  name text,
  cnpj text,
  plan text,
  status text,
  max_users integer,
  max_leads integer,
  created_at timestamptz,
  settings jsonb,
  parent_company_id uuid,
  is_master_account boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_role app_role;
BEGIN
  -- Obter usuário atual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Buscar company_id e role do usuário
  SELECT ur.company_id, ur.role
  INTO v_company_id, v_role
  FROM public.user_roles ur
  WHERE ur.user_id = v_user_id
  LIMIT 1;
  
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Usuário sem empresa associada';
  END IF;
  
  -- Verificar se é super_admin de uma conta mestre
  IF v_role = 'super_admin' THEN
    -- Verificar se a empresa é uma conta mestre
    IF EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = v_company_id
      AND c.is_master_account = TRUE
    ) THEN
      -- Retornar todas as subcontas desta conta mestre
      RETURN QUERY
      SELECT 
        c.id,
        c.name,
        c.cnpj,
        c.plan,
        c.status,
        c.max_users,
        c.max_leads,
        c.created_at,
        c.settings,
        c.parent_company_id,
        c.is_master_account
      FROM public.companies c
      WHERE c.parent_company_id = v_company_id
      ORDER BY c.created_at DESC;
    END IF;
  END IF;
  
  -- Se não for super_admin de conta mestre, retornar vazio
  RETURN;
END;
$$;

-- Garantir que a função é executável por usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_my_subcontas() TO authenticated;






