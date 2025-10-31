-- Atualizar cron job para executar a cada 5 minutos ao invés de 30
-- Primeiro remover o cron job existente
SELECT cron.unschedule('enviar-lembretes-automatico');

-- Criar novo cron job que executa a cada 5 minutos
SELECT cron.schedule(
  'enviar-lembretes-automatico',
  '*/5 * * * *', -- Executa a cada 5 minutos
  $$
  SELECT
    net.http_post(
      url := 'https://dteppsfseusqixuppglh.supabase.co/functions/v1/enviar-lembretes',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZXBwc2ZzZXVzcWl4dXBwZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzY0OTgsImV4cCI6MjA3NjQxMjQ5OH0.eEz5cyfwi5chae1U9S0Yt1FBwglyuVnm_Fzg9HVrV_Q"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

