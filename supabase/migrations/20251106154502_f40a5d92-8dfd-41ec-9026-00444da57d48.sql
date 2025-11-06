-- =========================================
-- CORREÇÃO: Consolidar subcontas na empresa master
-- =========================================
-- Fazer com que subcontas compartilhem o mesmo company_id da empresa master
-- Isso garante que todos os dados sejam sincronizados automaticamente

DO $$
DECLARE
  v_parent_id uuid;
  v_child_id uuid;
  v_child_name text;
  v_updated_roles integer;
  v_updated_convs integer;
  v_updated_leads integer;
BEGIN
  RAISE NOTICE '🔄 Iniciando consolidação de subcontas...';
  
  -- Para cada subconta (empresa com parent_company_id definido)
  FOR v_child_id, v_parent_id, v_child_name IN
    SELECT id, parent_company_id, name
    FROM public.companies
    WHERE parent_company_id IS NOT NULL
  LOOP
    RAISE NOTICE '📝 Processando subconta: % (ID: %)', v_child_name, v_child_id;
    RAISE NOTICE '   Parent company ID: %', v_parent_id;
    
    -- 1. Atualizar user_roles: vincular usuários da subconta à empresa master
    UPDATE public.user_roles
    SET company_id = v_parent_id
    WHERE company_id = v_child_id;
    
    GET DIAGNOSTICS v_updated_roles = ROW_COUNT;
    RAISE NOTICE '   ✅ % user_roles atualizados', v_updated_roles;
    
    -- 2. Atualizar conversas: mover conversas da subconta para empresa master
    UPDATE public.conversas
    SET company_id = v_parent_id
    WHERE company_id = v_child_id;
    
    GET DIAGNOSTICS v_updated_convs = ROW_COUNT;
    RAISE NOTICE '   ✅ % conversas atualizadas', v_updated_convs;
    
    -- 3. Atualizar leads: mover leads da subconta para empresa master
    UPDATE public.leads
    SET company_id = v_parent_id
    WHERE company_id = v_child_id;
    
    GET DIAGNOSTICS v_updated_leads = ROW_COUNT;
    RAISE NOTICE '   ✅ % leads atualizados', v_updated_leads;
    
    -- 4. Atualizar outras tabelas relacionadas
    UPDATE public.tasks SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.task_boards SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.task_columns SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.scheduled_whatsapp_messages SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.whatsapp_connections SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.automation_flows SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.automation_flow_logs SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.ia_configurations SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.ia_metrics SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.ia_patterns SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.ia_recommendations SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.ia_training_data SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.support_queues SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.conversation_assignments SET company_id = v_parent_id WHERE company_id = v_child_id;
    
    -- Atualizar compromissos e agendas
    UPDATE public.compromissos SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.agendas SET company_id = v_parent_id WHERE company_id = v_child_id;
    
    -- Atualizar funis e etapas
    UPDATE public.funis SET company_id = v_parent_id WHERE company_id = v_child_id;
    UPDATE public.etapas SET company_id = v_parent_id WHERE company_id IN (
      SELECT id FROM public.funis WHERE company_id = v_child_id
    );
    
    RAISE NOTICE '   ✅ Todas as tabelas relacionadas atualizadas';
    
    -- 5. NÃO deletar a empresa subconta (manter registro histórico)
    -- Apenas marcar como inativa
    UPDATE public.companies
    SET status = 'consolidated'
    WHERE id = v_child_id;
    
    RAISE NOTICE '   ✅ Subconta marcada como consolidada';
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '🎉 Consolidação concluída com sucesso!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Resumo:';
  RAISE NOTICE '   - Todas as subcontas agora compartilham o company_id da empresa master';
  RAISE NOTICE '   - Dados sincronizados automaticamente entre super admin e subcontas';
  RAISE NOTICE '   - RLS policies aplicam as mesmas regras para todos os usuários da empresa';
END $$;