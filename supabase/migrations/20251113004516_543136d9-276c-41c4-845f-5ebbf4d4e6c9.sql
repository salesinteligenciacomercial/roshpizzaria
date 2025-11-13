-- Corrigir enum app_role para incluir os perfis corretos do CRM
-- Primeiro, vamos atualizar qualquer valor 'user' existente para 'company_admin'
UPDATE public.user_roles 
SET role = 'company_admin'::app_role 
WHERE role::text = 'user';

-- Agora vamos recriar o enum com os valores corretos
-- Passo 1: Criar um novo enum com os valores corretos
DO $$ 
BEGIN
  -- Verificar se o enum já existe e dropá-lo se necessário
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role_new') THEN
    DROP TYPE app_role_new CASCADE;
  END IF;
  
  -- Criar novo enum com valores corretos
  CREATE TYPE app_role_new AS ENUM (
    'super_admin',
    'company_admin', 
    'gestor',
    'vendedor',
    'suporte'
  );
END $$;

-- Passo 2: Alterar a coluna para usar o novo enum
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE app_role_new 
  USING (role::text::app_role_new);

ALTER TABLE public.role_permissions 
  ALTER COLUMN role TYPE app_role_new 
  USING (role::text::app_role_new);

-- Passo 3: Dropar o enum antigo e renomear o novo
DROP TYPE app_role CASCADE;
ALTER TYPE app_role_new RENAME TO app_role;

-- Passo 4: Recriar as constraints nas tabelas
ALTER TABLE public.user_roles 
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'company_admin'::app_role;

ALTER TABLE public.role_permissions 
  ALTER COLUMN role SET NOT NULL;

-- Comentário explicativo
COMMENT ON TYPE app_role IS 'Perfis de usuário válidos no sistema CRM: super_admin (acesso total), company_admin (administrador da empresa), gestor (gerente de equipe), vendedor (equipe de vendas), suporte (atendimento)';