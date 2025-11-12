-- ============================================
-- 🔧 CORREÇÃO ESPECÍFICA: Menu Conversas em Subcontas
-- ============================================
-- Este script corrige problemas específicos do menu Conversas
-- que podem estar afetando subcontas

-- ============================================
-- 1. GARANTIR QUE TODAS AS CONVERSAS TÊM company_id
-- ============================================
-- Se houver conversas sem company_id, vincular à empresa do usuário
UPDATE conversas c
SET company_id = (
  SELECT ur.company_id
  FROM user_roles ur
  WHERE ur.user_id = c.owner_id
  LIMIT 1
)
WHERE c.company_id IS NULL
AND c.owner_id IS NOT NULL;

-- ============================================
-- 2. GARANTIR QUE TODAS AS EMPRESAS TÊM CONEXÃO WHATSAPP
-- ============================================
-- Criar registro de conexão WhatsApp para empresas que não têm
DO $$
DECLARE
  empresa RECORD;
  connection_id UUID;
BEGIN
  FOR empresa IN 
    SELECT id, name FROM companies 
    WHERE status = 'active'
    AND id NOT IN (SELECT company_id FROM whatsapp_connections WHERE company_id IS NOT NULL)
  LOOP
    -- Criar conexão WhatsApp vazia (usuário precisa configurar depois)
    INSERT INTO whatsapp_connections (
      company_id,
      instance_name,
      status,
      created_at,
      updated_at
    )
    VALUES (
      empresa.id,
      'INSTANCE_' || SUBSTRING(empresa.id::text, 1, 8),
      'disconnected',
      NOW(),
      NOW()
    )
    ON CONFLICT (company_id) DO NOTHING;
    
    RAISE NOTICE 'Conexão WhatsApp criada para empresa: %', empresa.name;
  END LOOP;
END $$;

-- ============================================
-- 3. VERIFICAR E CORRIGIR DADOS DE CONVERSAS
-- ============================================
-- Garantir que todas as conversas têm telefone_formatado válido
UPDATE conversas
SET telefone_formatado = numero
WHERE telefone_formatado IS NULL
AND numero IS NOT NULL;

-- ============================================
-- 4. GARANTIR QUE TODAS AS EMPRESAS TÊM PERMISSÕES CORRETAS
-- ============================================
-- Verificar se todos os usuários admin têm role correta
DO $$
DECLARE
  empresa RECORD;
  admin_user RECORD;
BEGIN
  FOR empresa IN 
    SELECT id, name FROM companies 
    WHERE status = 'active'
  LOOP
    -- Buscar primeiro usuário admin da empresa
    SELECT ur.user_id INTO admin_user
    FROM user_roles ur
    WHERE ur.company_id = empresa.id
    AND ur.role IN ('super_admin', 'company_admin')
    LIMIT 1;
    
    -- Se não tem admin, criar role para o primeiro usuário
    IF admin_user IS NULL THEN
      SELECT ur.user_id INTO admin_user
      FROM user_roles ur
      WHERE ur.company_id = empresa.id
      LIMIT 1;
      
      IF admin_user IS NOT NULL THEN
        -- Atualizar role para company_admin
        UPDATE user_roles
        SET role = 'company_admin'
        WHERE user_id = admin_user.user_id
        AND company_id = empresa.id;
        
        RAISE NOTICE 'Role atualizada para empresa: %', empresa.name;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 5. CRIAR ESTRUTURAS DE DADOS PADRÃO (se necessário)
-- ============================================
-- Exemplo: Criar funil padrão se não existir
DO $$
DECLARE
  empresa RECORD;
  funil_id UUID;
BEGIN
  FOR empresa IN 
    SELECT id, name FROM companies 
    WHERE status = 'active'
  LOOP
    -- Verificar se já tem funil
    SELECT id INTO funil_id
    FROM funis
    WHERE company_id = empresa.id
    LIMIT 1;
    
    -- Se não tem, criar funil padrão
    IF funil_id IS NULL THEN
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
-- 6. VERIFICAR E CORRIGIR ISOLAMENTO DE DADOS
-- ============================================
-- Garantir que leads estão vinculados à empresa correta
UPDATE leads l
SET company_id = (
  SELECT ur.company_id
  FROM user_roles ur
  WHERE ur.user_id = l.owner_id
  LIMIT 1
)
WHERE l.company_id IS NULL
AND l.owner_id IS NOT NULL;

-- Garantir que funis estão vinculados à empresa correta
UPDATE funis f
SET company_id = (
  SELECT ur.company_id
  FROM user_roles ur
  WHERE ur.user_id = f.owner_id
  LIMIT 1
)
WHERE f.company_id IS NULL
AND f.owner_id IS NOT NULL;

-- Garantir que etapas estão vinculadas à empresa correta
UPDATE etapas e
SET company_id = (
  SELECT f.company_id
  FROM funis f
  WHERE f.id = e.funil_id
  LIMIT 1
)
WHERE e.company_id IS NULL
AND e.funil_id IS NOT NULL;

-- ============================================
-- 7. LOG DE VERIFICAÇÃO
-- ============================================
-- Criar relatório de verificação
DO $$
DECLARE
  total_empresas INT;
  empresas_sem_conversas INT;
  empresas_sem_whatsapp INT;
  empresas_sem_funil INT;
BEGIN
  SELECT COUNT(*) INTO total_empresas
  FROM companies
  WHERE status = 'active';
  
  SELECT COUNT(*) INTO empresas_sem_conversas
  FROM companies c
  WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM conversas WHERE company_id = c.id
  );
  
  SELECT COUNT(*) INTO empresas_sem_whatsapp
  FROM companies c
  WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM whatsapp_connections WHERE company_id = c.id
  );
  
  SELECT COUNT(*) INTO empresas_sem_funil
  FROM companies c
  WHERE c.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM funis WHERE company_id = c.id
  );
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RELATÓRIO DE VERIFICAÇÃO';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total de empresas ativas: %', total_empresas;
  RAISE NOTICE 'Empresas sem conversas: %', empresas_sem_conversas;
  RAISE NOTICE 'Empresas sem WhatsApp: %', empresas_sem_whatsapp;
  RAISE NOTICE 'Empresas sem funil: %', empresas_sem_funil;
  RAISE NOTICE '========================================';
END $$;

