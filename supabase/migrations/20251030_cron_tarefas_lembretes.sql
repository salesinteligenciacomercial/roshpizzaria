-- Configurar cron job para lembretes automáticos de tarefas
-- Executa a cada 30 minutos durante o horário comercial (8h às 18h)

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Deletar cron job existente se houver
SELECT cron.unschedule('tarefas-lembretes-automatico');

-- Criar novo cron job que executa a cada 30 minutos no horário comercial
SELECT cron.schedule(
  'tarefas-lembretes-automatico',
  '*/30 8-18 * * *', -- Executa a cada 30 minutos, das 8h às 18h
  $$
  SELECT
    net.http_post(
      url := 'https://dteppsfseusqixuppglh.supabase.co/functions/v1/tarefas-lembretes',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZXBwc2ZzZXVzcWl4dXBwZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzY0OTgsImV4cCI6MjA3NjQxMjQ5OH0.eEz5cyfwi5chae1U9S0Yt1FBwglyuVnm_Fzg9HVrV_Q"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verificar se o cron job foi criado
SELECT * FROM cron.job WHERE jobname = 'tarefas-lembretes-automatico';

