-- Adicionar campo para controlar atendimentos simultâneos nas agendas
-- Se já existir capacidade_simultanea, este comando falhará mas é seguro ignorar
ALTER TABLE public.agendas 
ADD COLUMN IF NOT EXISTS permite_simultaneo BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.agendas.permite_simultaneo IS 'Se true, permite múltiplos atendimentos ao mesmo tempo. Se false, apenas 1 atendimento por vez';

-- Atualizar agendas existentes baseado na capacidade_simultanea
UPDATE public.agendas 
SET permite_simultaneo = (capacidade_simultanea > 1)
WHERE permite_simultaneo IS NULL;