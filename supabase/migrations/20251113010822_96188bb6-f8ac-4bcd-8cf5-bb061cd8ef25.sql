-- Remover a política que usa is_user_company_admin (pode causar recursão ainda)
DROP POLICY IF EXISTS "company_admins_can_view_company_roles" ON public.user_roles;

-- Manter apenas as 2 políticas simples que NÃO causam recursão:
-- 1. users_can_view_own_roles (já existe - user_id = auth.uid())
-- 2. super_admins_view_all_roles (já existe - verifica email diretamente)

-- Não recriar a política de company_admins por enquanto
-- Essas 2 políticas são suficientes para o super admin acessar seus dados

COMMENT ON POLICY "users_can_view_own_roles" ON public.user_roles IS 'Usuários veem suas próprias roles - POLICY PRINCIPAL';
COMMENT ON POLICY "super_admins_view_all_roles" ON public.user_roles IS 'Super admins veem todas as roles - POLICY DE SUPER ADMIN';