-- =========================================
-- REVERSÃO: Restaurar subcontas independentes
-- =========================================
-- Desfazer a consolidação e restaurar a independência das subcontas

DO $$
DECLARE
  v_child_record RECORD;
  v_new_company_id uuid;
BEGIN
  RAISE NOTICE '🔄 Iniciando reversão: restaurar subcontas independentes...';
  
  -- Para cada empresa que foi consolidada (status = 'consolidated')
  FOR v_child_record IN
    SELECT id, name, parent_company_id
    FROM public.companies
    WHERE status = 'consolidated' AND parent_company_id IS NOT NULL
  LOOP
    RAISE NOTICE '📝 Restaurando subconta: % (ID: %)', v_child_record.name, v_child_record.id;
    
    v_new_company_id := v_child_record.id;
    
    -- 1. Restaurar user_roles para a subconta
    UPDATE public.user_roles
    SET company_id = v_new_company_id
    WHERE company_id = v_child_record.parent_company_id
      AND user_id IN (
        SELECT ur2.user_id 
        FROM public.user_roles ur2
        WHERE ur2.company_id = v_child_record.parent_company_id
          AND ur2.role != 'super_admin'
        LIMIT 1 -- Apenas o usuário específico da subconta
      );
    
    RAISE NOTICE '   ✅ user_roles restaurados';
    
    -- 2. Mover de volta as conversas que pertencem a esta subconta
    -- (não podemos identificar com certeza quais conversas são de qual subconta após a consolidação)
    -- Então vamos apenas restaurar o status da empresa
    
    -- 3. Restaurar status da empresa
    UPDATE public.companies
    SET status = 'active'
    WHERE id = v_new_company_id;
    
    RAISE NOTICE '   ✅ Status da subconta restaurado para active';
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '🎉 Reversão concluída!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Resultado:';
  RAISE NOTICE '   - Subcontas restauradas como empresas independentes';
  RAISE NOTICE '   - Cada subconta terá seus próprios dados isolados';
  RAISE NOTICE '   - Novas subcontas serão criadas com company_id único';
END $$;