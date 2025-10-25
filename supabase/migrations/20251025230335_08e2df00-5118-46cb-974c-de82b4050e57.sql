-- Atualizar para nova instância IA

-- 1. Deletar conexão CRM antiga
DELETE FROM whatsapp_connections WHERE company_id = '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78';

-- 2. Criar nova conexão IA
INSERT INTO whatsapp_connections (
  company_id,
  instance_name,
  status,
  whatsapp_number,
  evolution_api_key,
  evolution_api_url,
  last_connected_at
) VALUES (
  '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78',
  'ia',
  'connected',
  '558791426333',
  '6769D9D15D7F-43F2-98B9-1980704884C7',
  'https://evolution-evolution-api.kxuvcf.easypanel.host',
  NOW()
);