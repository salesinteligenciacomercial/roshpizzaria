-- Adiciona campo status na tabela etapas
ALTER TABLE public.etapas
ADD COLUMN IF NOT EXISTS status text DEFAULT 'normal'::text;

-- Adiciona check constraint para garantir valores válidos
ALTER TABLE public.etapas
ADD CONSTRAINT etapas_status_check 
CHECK (status IN ('normal', 'final'));

-- Garante que o campo status na tabela leads suporte os novos estados
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_status_check 
CHECK (status IN ('ativo', 'inativo', 'ganho', 'perdido'));

-- Função para criar funil padrão se não existir nenhum
CREATE OR REPLACE FUNCTION public.create_default_funnel()
RETURNS void AS $$
DECLARE
    v_funil_id uuid;
    v_company_id uuid;
BEGIN
    -- Verifica se já existe algum funil
    IF NOT EXISTS (SELECT 1 FROM public.funis LIMIT 1) THEN
        -- Pega a primeira company_id (assumindo que existe pelo menos uma)
        SELECT id INTO v_company_id FROM public.companies LIMIT 1;
        
        IF v_company_id IS NOT NULL THEN
            -- Cria o funil padrão
            INSERT INTO public.funis (nome, company_id)
            VALUES ('Funil Principal', v_company_id)
            RETURNING id INTO v_funil_id;

            -- Cria as etapas padrão
            INSERT INTO public.etapas (nome, funil_id, posicao, cor, company_id, status)
            VALUES 
                ('Novo Lead', v_funil_id, 1, '#ef4444', v_company_id, 'normal'),
                ('Contato Realizado', v_funil_id, 2, '#f97316', v_company_id, 'normal'),
                ('Proposta Enviada', v_funil_id, 3, '#eab308', v_company_id, 'normal'),
                ('Negociação', v_funil_id, 4, '#3b82f6', v_company_id, 'normal'),
                ('Ganho', v_funil_id, 99, '#22c55e', v_company_id, 'final'),
                ('Perdido', v_funil_id, 100, '#ef4444', v_company_id, 'final');
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger para garantir que todo funil tenha as etapas Ganho e Perdido
CREATE OR REPLACE FUNCTION public.ensure_final_stages()
RETURNS trigger AS $$
DECLARE
    v_company_id uuid;
BEGIN
    -- Pega o company_id do funil
    SELECT company_id INTO v_company_id FROM public.funis WHERE id = NEW.id;

    -- Adiciona etapas Ganho e Perdido se não existirem
    IF NOT EXISTS (
        SELECT 1 FROM public.etapas 
        WHERE funil_id = NEW.id AND nome = 'Ganho'
    ) THEN
        INSERT INTO public.etapas (nome, funil_id, posicao, cor, company_id, status)
        VALUES ('Ganho', NEW.id, 99, '#22c55e', v_company_id, 'final');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.etapas 
        WHERE funil_id = NEW.id AND nome = 'Perdido'
    ) THEN
        INSERT INTO public.etapas (nome, funil_id, posicao, cor, company_id, status)
        VALUES ('Perdido', NEW.id, 100, '#ef4444', v_company_id, 'final');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para adicionar etapas finais em novos funis
CREATE TRIGGER ensure_final_stages_trigger
AFTER INSERT ON public.funis
FOR EACH ROW
EXECUTE FUNCTION public.ensure_final_stages();

-- Trigger para atualizar status do lead quando movido para etapa final
CREATE OR REPLACE FUNCTION public.update_lead_status()
RETURNS trigger AS $$
BEGIN
    -- Se o lead foi movido para uma etapa final
    IF EXISTS (
        SELECT 1 FROM public.etapas 
        WHERE id = NEW.etapa_id AND status = 'final'
    ) THEN
        -- Atualiza o status do lead baseado na etapa
        UPDATE public.leads
        SET status = CASE 
            WHEN (SELECT nome FROM public.etapas WHERE id = NEW.etapa_id) = 'Ganho' THEN 'ganho'
            WHEN (SELECT nome FROM public.etapas WHERE id = NEW.etapa_id) = 'Perdido' THEN 'perdido'
            ELSE status
        END
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar status do lead
CREATE TRIGGER update_lead_status_trigger
AFTER UPDATE OF etapa_id ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_lead_status();

-- Executa a função para criar o funil padrão se necessário
SELECT public.create_default_funnel();

