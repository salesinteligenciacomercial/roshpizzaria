-- Enforce only one active (status = 'connected') WhatsApp connection per company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uniq_active_whatsapp_connection_per_company'
  ) THEN
    CREATE UNIQUE INDEX uniq_active_whatsapp_connection_per_company
      ON public.whatsapp_connections (company_id)
      WHERE (status = 'connected');
  END IF;
END$$;

-- Optional: surface a clearer error if violated in future app logic (handled in UI/toasts)

