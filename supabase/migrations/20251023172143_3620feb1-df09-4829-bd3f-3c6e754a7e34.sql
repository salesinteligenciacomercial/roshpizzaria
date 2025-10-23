-- Adicionar lead_id na tabela conversas para vincular conversas a leads
ALTER TABLE public.conversas ADD COLUMN lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX idx_conversas_lead_id ON public.conversas(lead_id);

-- Adicionar campo telefone_formatado para facilitar matching
ALTER TABLE public.conversas ADD COLUMN telefone_formatado text;

-- Criar função para formatar telefone (remover caracteres especiais)
CREATE OR REPLACE FUNCTION public.formatar_telefone(telefone text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN regexp_replace(telefone, '[^0-9]', '', 'g');
END;
$$;

-- Criar trigger para auto-vincular conversas a leads pelo telefone
CREATE OR REPLACE FUNCTION public.vincular_conversa_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lead_encontrado uuid;
BEGIN
  -- Formatar telefone da conversa
  NEW.telefone_formatado := regexp_replace(NEW.numero, '[^0-9]', '', 'g');
  
  -- Buscar lead com telefone correspondente
  SELECT id INTO lead_encontrado
  FROM public.leads
  WHERE regexp_replace(COALESCE(telefone, phone, ''), '[^0-9]', '', 'g') = NEW.telefone_formatado
  LIMIT 1;
  
  -- Se encontrou lead, vincular
  IF lead_encontrado IS NOT NULL THEN
    NEW.lead_id := lead_encontrado;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na inserção de conversas
DROP TRIGGER IF EXISTS trigger_vincular_conversa_lead ON public.conversas;
CREATE TRIGGER trigger_vincular_conversa_lead
  BEFORE INSERT ON public.conversas
  FOR EACH ROW
  EXECUTE FUNCTION public.vincular_conversa_lead();

-- Atualizar conversas existentes para vincular aos leads
UPDATE public.conversas c
SET lead_id = l.id,
    telefone_formatado = regexp_replace(c.numero, '[^0-9]', '', 'g')
FROM public.leads l
WHERE regexp_replace(COALESCE(l.telefone, l.phone, ''), '[^0-9]', '', 'g') = regexp_replace(c.numero, '[^0-9]', '', 'g')
AND c.lead_id IS NULL;