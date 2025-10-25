
-- Associar usuário atual à empresa JEOVA COSTA DE LIMA
INSERT INTO user_roles (
  user_id,
  company_id,
  role,
  created_at
) VALUES (
  '677a7847-1f34-44d0-b03b-c148b4b166b7',
  '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78',
  'company_admin',
  now()
);

-- Atualizar owner_user_id da empresa
UPDATE companies
SET owner_user_id = '677a7847-1f34-44d0-b03b-c148b4b166b7'
WHERE id = '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78';
