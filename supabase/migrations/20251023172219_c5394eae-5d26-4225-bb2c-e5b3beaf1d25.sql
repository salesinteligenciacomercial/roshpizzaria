-- Corrigir função formatar_telefone com search_path apropriado
CREATE OR REPLACE FUNCTION public.formatar_telefone(telefone text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN regexp_replace(telefone, '[^0-9]', '', 'g');
END;
$$;