-- Remover a instância JE2 do CRM Matriz para permitir criação de nova instância
DELETE FROM whatsapp_connections 
WHERE instance_name = 'JE2' 
AND company_id = '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78';