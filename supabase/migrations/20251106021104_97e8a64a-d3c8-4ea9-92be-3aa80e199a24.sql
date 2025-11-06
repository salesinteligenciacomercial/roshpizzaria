-- Habilitar Realtime apenas para tabelas que ainda não estão habilitadas
-- Tentar adicionar cada tabela individualmente, ignorando erros se já existir

DO $$
BEGIN
  -- Tentar adicionar leads
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'leads já está no realtime';
  END;

  -- Tentar adicionar tasks
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'tasks já está no realtime';
  END;

  -- Tentar adicionar compromissos
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.compromissos;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'compromissos já está no realtime';
  END;

  -- Tentar adicionar funis
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.funis;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'funis já está no realtime';
  END;

  -- Tentar adicionar etapas
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.etapas;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'etapas já está no realtime';
  END;

  -- Tentar adicionar conversation_assignments
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_assignments;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'conversation_assignments já está no realtime';
  END;

  -- Tentar adicionar whatsapp_connections
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_connections;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'whatsapp_connections já está no realtime';
  END;
END $$;