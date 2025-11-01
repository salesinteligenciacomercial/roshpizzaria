-- Função para atualizar nome do funil
CREATE OR REPLACE FUNCTION public.update_funil_nome(p_funil_id uuid, p_nome text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.funis f
    JOIN public.user_roles ur ON ur.company_id = f.company_id
    WHERE f.id = p_funil_id AND ur.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem acesso ao funil';
  END IF;

  UPDATE public.funis SET nome = p_nome, atualizado_em = NOW() WHERE id = p_funil_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_funil_nome(uuid, text) TO authenticated, service_role;

-- Função para atualizar etapa (nome, cor, posição)
CREATE OR REPLACE FUNCTION public.update_etapa(p_etapa_id uuid, p_nome text, p_cor text, p_posicao int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_funil_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Usuário não autenticado'; END IF;

  SELECT funil_id INTO v_funil_id FROM public.etapas WHERE id = p_etapa_id;
  IF v_funil_id IS NULL THEN RAISE EXCEPTION 'Etapa não encontrada'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.funis f
    JOIN public.user_roles ur ON ur.company_id = f.company_id
    WHERE f.id = v_funil_id AND ur.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem acesso à etapa';
  END IF;

  UPDATE public.etapas
     SET nome = COALESCE(p_nome, nome),
         cor = COALESCE(p_cor, cor),
         posicao = COALESCE(p_posicao, posicao),
         atualizado_em = NOW()
   WHERE id = p_etapa_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_etapa(uuid, text, text, int) TO authenticated, service_role;