
-- LIMPEZA COMPLETA - ORDEM CORRETA

-- 1. Limpar tabelas dependentes primeiro
TRUNCATE TABLE conversas CASCADE;
TRUNCATE TABLE leads CASCADE;
TRUNCATE TABLE lembretes CASCADE;
TRUNCATE TABLE compromissos CASCADE;
TRUNCATE TABLE automation_flow_logs CASCADE;
TRUNCATE TABLE ia_training_data CASCADE;
TRUNCATE TABLE ia_recommendations CASCADE;
TRUNCATE TABLE ia_metrics CASCADE;
TRUNCATE TABLE tasks CASCADE;
TRUNCATE TABLE task_columns CASCADE;
TRUNCATE TABLE task_boards CASCADE;

-- 2. Limpar funis e etapas
DELETE FROM etapas;
DELETE FROM funis;

-- 3. Limpar agendas
DELETE FROM agendas;

-- 4. Deletar todas as conexões WhatsApp
DELETE FROM whatsapp_connections;

-- 5. Limpar user_roles
DELETE FROM user_roles;

-- 6. Deletar empresas antigas (manter apenas JEOVA COSTA DE LIMA)
DELETE FROM companies 
WHERE id != '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78';

-- 7. Atualizar empresa principal
UPDATE companies
SET 
  name = 'JEOVA COSTA DE LIMA',
  status = 'active',
  updated_at = now()
WHERE id = '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78';
