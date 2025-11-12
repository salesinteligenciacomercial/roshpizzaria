-- ============================================
-- 🔧 APLICAR MELHORIAS EM TODAS AS SUBCONTAS
-- ============================================
-- Este script aplica melhorias e dados iniciais para todas as empresas ativas
-- (incluindo conta mestre e subcontas)

-- IMPORTANTE: Adicione aqui as melhorias que precisam ser aplicadas
-- para todas as empresas, não apenas conta mestre

-- ============================================
-- EXEMPLO 1: Criar Funil Padrão para Empresas que Não Têm
-- ============================================
DO $$
DECLARE
  empresa RECORD;
  funil_id UUID;
  etapa_id UUID;
BEGIN
  FOR empresa IN 
    SELECT id, name FROM companies 
    WHERE status = 'active'
  LOOP
    -- Verificar se já tem funil padrão
    SELECT id INTO funil_id
    FROM funis
    WHERE company_id = empresa.id
    AND nome = 'Funil de Vendas'
    LIMIT 1;
    
    -- Se não tem, criar
    IF funil_id IS NULL THEN
      -- Criar funil
      INSERT INTO funis (nome, descricao, company_id, criado_em)
      VALUES ('Funil de Vendas', 'Funil padrão do sistema', empresa.id, NOW())
      RETURNING id INTO funil_id;
      
      -- Criar etapas padrão
      INSERT INTO etapas (funil_id, nome, posicao, cor, company_id)
      VALUES 
        (funil_id, 'Prospecção', 1, '#3b82f6', empresa.id),
        (funil_id, 'Qualificação', 2, '#eab308', empresa.id),
        (funil_id, 'Proposta', 3, '#8b5cf6', empresa.id),
        (funil_id, 'Negociação', 4, '#f59e0b', empresa.id),
        (funil_id, 'Fechamento', 5, '#22c55e', empresa.id)
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Funil padrão criado para empresa: %', empresa.name;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- EXEMPLO 2: Criar Quadro de Tarefas Padrão
-- ============================================
DO $$
DECLARE
  empresa RECORD;
  board_id UUID;
  coluna_id UUID;
BEGIN
  FOR empresa IN 
    SELECT id, name FROM companies 
    WHERE status = 'active'
  LOOP
    -- Verificar se já tem board padrão
    SELECT id INTO board_id
    FROM task_boards
    WHERE company_id = empresa.id
    AND nome = 'Quadro Principal'
    LIMIT 1;
    
    -- Se não tem, criar
    IF board_id IS NULL THEN
      -- Criar board
      INSERT INTO task_boards (nome, descricao, company_id, criado_em)
      VALUES ('Quadro Principal', 'Quadro padrão de tarefas', empresa.id, NOW())
      RETURNING id INTO board_id;
      
      -- Criar colunas padrão
      INSERT INTO task_columns (board_id, nome, posicao, cor, company_id)
      VALUES 
        (board_id, 'A Fazer', 0, '#3b82f6', empresa.id),
        (board_id, 'Em Progresso', 1, '#eab308', empresa.id),
        (board_id, 'Concluído', 2, '#22c55e', empresa.id)
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Quadro padrão criado para empresa: %', empresa.name;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- EXEMPLO 3: Atualizar Configurações Padrão
-- ============================================
-- Adicionar configurações padrão em companies.settings para empresas que não têm
UPDATE companies
SET settings = COALESCE(settings, '{}'::jsonb) || 
  jsonb_build_object(
    'nova_feature_enabled', true,
    'configuracao_padrao', 'valor_padrao'
  )
WHERE status = 'active'
AND (
  settings IS NULL 
  OR NOT (settings ? 'nova_feature_enabled')
);

-- ============================================
-- EXEMPLO 4: Criar Agenda Padrão
-- ============================================
DO $$
DECLARE
  empresa RECORD;
  agenda_id UUID;
BEGIN
  FOR empresa IN 
    SELECT id, name FROM companies 
    WHERE status = 'active'
  LOOP
    -- Verificar se já tem agenda padrão
    SELECT id INTO agenda_id
    FROM agendas
    WHERE company_id = empresa.id
    AND nome = 'Agenda Principal'
    LIMIT 1;
    
    -- Se não tem, criar
    IF agenda_id IS NULL THEN
      INSERT INTO agendas (
        nome, 
        tipo, 
        status, 
        capacidade_simultanea, 
        tempo_medio_servico,
        company_id,
        disponibilidade
      )
      VALUES (
        'Agenda Principal',
        'geral',
        'ativa',
        1,
        60,
        empresa.id,
        '{"dias": ["segunda", "terca", "quarta", "quinta", "sexta"], "horario_inicio": "09:00", "horario_fim": "18:00"}'::jsonb
      )
      ON CONFLICT DO NOTHING;
      
      RAISE NOTICE 'Agenda padrão criada para empresa: %', empresa.name;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- NOTA: Adicione aqui outras melhorias conforme necessário
-- ============================================
-- Sempre que adicionar uma nova feature que precisa de dados iniciais,
-- adicione aqui para garantir que todas as empresas recebam

-- Exemplo de estrutura:
-- DO $$
-- DECLARE
--   empresa RECORD;
-- BEGIN
--   FOR empresa IN SELECT id FROM companies WHERE status = 'active' LOOP
--     -- Aplicar melhoria aqui
--   END LOOP;
-- END $$;

