-- Alterar tipo da coluna horas_antecedencia de INTEGER para NUMERIC
-- para suportar valores decimais (horas com minutos)
ALTER TABLE public.lembretes 
  ALTER COLUMN horas_antecedencia TYPE NUMERIC USING horas_antecedencia::NUMERIC;

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.lembretes.horas_antecedencia IS 'Antecedência em horas (aceita decimais para suportar minutos, ex: 1.5 = 1h30min)';