
-- =========================================
-- CORREÇÃO: Restaurar instância WhatsApp da Super Admin
-- =========================================
-- A instância da subconta substituiu incorretamente a instância da super admin
-- Vamos transferir a instância "JDPROMOTORA" de volta para a super admin

DO $$
DECLARE
  v_super_admin_company_id uuid := '3d34ff74-b8ad-4c7e-b538-3bdb0d30dc78'; -- JEOVA COSTA DE LIMA
  v_subconta_company_id uuid := '3f9bab91-1137-4fd9-8120-9179bcfca30b'; -- jd promotora
BEGIN
  RAISE NOTICE '🔄 Corrigindo transferência de instância WhatsApp...';
  
  -- 1. Transferir a instância WhatsApp da subconta para a super admin
  UPDATE public.whatsapp_connections
  SET company_id = v_super_admin_company_id
  WHERE company_id = v_subconta_company_id
    AND instance_name = 'JDPROMOTORA';
  
  RAISE NOTICE '✅ Instância WhatsApp restaurada para super admin';
  
  -- 2. Atualizar parent_company_id da subconta para NULL
  -- (cada subconta deve ser independente)
  UPDATE public.companies
  SET parent_company_id = NULL
  WHERE id = v_subconta_company_id;
  
  RAISE NOTICE '✅ Subconta configurada como independente';
  
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Correção concluída!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Resultado:';
  RAISE NOTICE '   - Instância WhatsApp "JDPROMOTORA" restaurada para super admin';
  RAISE NOTICE '   - Subconta "jd promotora" agora é independente';
  RAISE NOTICE '   - Subconta precisa configurar sua própria instância WhatsApp';
END $$;
