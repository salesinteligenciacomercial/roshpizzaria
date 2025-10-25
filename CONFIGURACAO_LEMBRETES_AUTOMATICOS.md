# Configuração de Lembretes Automáticos

Este documento explica como configurar o envio automático de lembretes via WhatsApp.

## Edge Function Criada

A edge function `enviar-lembretes` foi criada para processar e enviar lembretes pendentes automaticamente.

### O que a função faz:

1. **Busca lembretes pendentes** - Procura todos os lembretes com status `pendente` cuja data de envio já passou
2. **Valida dados** - Verifica se o compromisso, lead e telefone existem
3. **Envia WhatsApp** - Usa a Evolution API para enviar a mensagem de lembrete
4. **Atualiza status** - Marca o lembrete como `enviado` ou `erro`
5. **Registra logs** - Mantém logs detalhados de todo o processo

## Teste Manual

Você pode testar a função manualmente chamando-a diretamente:

```bash
curl -X POST https://dteppsfseusqixuppglh.supabase.co/functions/v1/enviar-lembretes \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Ou pelo frontend:

```typescript
const { data, error } = await supabase.functions.invoke('enviar-lembretes');
console.log('Resultado:', data);
```

## Configuração de Execução Automática (Cron Job)

Para executar a função automaticamente a cada hora, você precisa configurar um cron job no Supabase.

### Passo 1: Habilitar extensões necessárias

Execute o seguinte SQL no Supabase (na aba SQL Editor ou via migration):

```sql
-- Habilitar pg_cron para agendamento de tarefas
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Habilitar pg_net para fazer requisições HTTP
CREATE EXTENSION IF NOT EXISTS pg_net;
```

### Passo 2: Criar o Cron Job

Execute o seguinte SQL para agendar a execução da função a cada hora:

```sql
-- Deletar cron job existente se houver
SELECT cron.unschedule('enviar-lembretes-automatico');

-- Criar novo cron job que executa a cada hora
SELECT cron.schedule(
  'enviar-lembretes-automatico',
  '0 * * * *', -- Executa no minuto 0 de cada hora (ex: 10:00, 11:00, 12:00)
  $$
  SELECT
    net.http_post(
      url := 'https://dteppsfseusqixuppglh.supabase.co/functions/v1/enviar-lembretes',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZXBwc2ZzZXVzcWl4dXBwZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzY0OTgsImV4cCI6MjA3NjQxMjQ5OH0.eEz5cyfwi5chae1U9S0Yt1FBwglyuVnm_Fzg9HVrV_Q"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

### Opções de Frequência do Cron

Você pode ajustar a frequência alterando o padrão cron:

```sql
-- A cada 15 minutos
'*/15 * * * *'

-- A cada 30 minutos
'*/30 * * * *'

-- A cada hora (no minuto 0)
'0 * * * *'

-- A cada 2 horas
'0 */2 * * *'

-- Todos os dias às 9h
'0 9 * * *'

-- De hora em hora, apenas no horário comercial (8h às 18h)
'0 8-18 * * *'
```

### Passo 3: Verificar Cron Jobs Ativos

Para ver todos os cron jobs configurados:

```sql
SELECT * FROM cron.job;
```

Para ver o histórico de execuções:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'enviar-lembretes-automatico')
ORDER BY start_time DESC 
LIMIT 10;
```

### Passo 4: Remover Cron Job (se necessário)

Para remover o agendamento:

```sql
SELECT cron.unschedule('enviar-lembretes-automatico');
```

## Fluxo de Funcionamento

1. **Criação do Compromisso**: 
   - Usuário cria um compromisso na agenda
   - Marca opção "Enviar lembrete automático"
   - Sistema cria registro na tabela `lembretes` com status `pendente`
   - `data_envio` é calculada: data do compromisso - horas de antecedência

2. **Execução do Cron Job**:
   - A cada hora (ou conforme configurado), o cron executa a função
   - Função busca lembretes onde `data_envio <= AGORA` e `status_envio = 'pendente'`

3. **Processamento dos Lembretes**:
   - Para cada lembrete encontrado:
     - Busca dados do compromisso e lead
     - Formata telefone
     - Envia mensagem via Evolution API
     - Atualiza status para `enviado` ou `erro`

4. **Logs e Monitoramento**:
   - Todos os passos são registrados em logs
   - Você pode verificar os logs na função `enviar-lembretes`

## Estrutura da Tabela Lembretes

```sql
CREATE TABLE lembretes (
  id UUID PRIMARY KEY,
  compromisso_id UUID NOT NULL REFERENCES compromissos(id),
  canal TEXT NOT NULL, -- 'whatsapp', 'email', 'push'
  horas_antecedencia INTEGER NOT NULL DEFAULT 24,
  mensagem TEXT,
  status_envio TEXT DEFAULT 'pendente', -- 'pendente', 'enviado', 'erro'
  data_envio TIMESTAMP WITH TIME ZONE,
  company_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Troubleshooting

### Lembretes não estão sendo enviados

1. Verifique se o cron job está ativo:
```sql
SELECT * FROM cron.job WHERE jobname = 'enviar-lembretes-automatico';
```

2. Verifique se há lembretes pendentes:
```sql
SELECT * FROM lembretes WHERE status_envio = 'pendente' AND data_envio <= NOW();
```

3. Verifique os logs da função no Supabase Dashboard

4. Teste a função manualmente para ver se há erros

### Lembretes marcados como erro

1. Verifique se a conexão WhatsApp está ativa:
```sql
SELECT * FROM whatsapp_connections WHERE status = 'connected';
```

2. Verifique se o lead tem telefone cadastrado
3. Verifique os logs da Evolution API
4. Teste o envio manual de WhatsApp

## Monitoramento

Você pode criar views para monitorar os lembretes:

```sql
-- Ver estatísticas de lembretes
SELECT 
  status_envio,
  COUNT(*) as total,
  MIN(created_at) as primeiro,
  MAX(created_at) as ultimo
FROM lembretes
GROUP BY status_envio;

-- Ver lembretes que falharam
SELECT 
  l.*,
  c.tipo_servico,
  c.data_hora_inicio,
  lead.name as lead_name,
  lead.phone as lead_phone
FROM lembretes l
JOIN compromissos c ON l.compromisso_id = c.id
LEFT JOIN leads lead ON c.lead_id = lead.id
WHERE l.status_envio = 'erro'
ORDER BY l.created_at DESC;
```

## Boas Práticas

1. **Horários de Envio**: Configure o cron para executar apenas no horário comercial se apropriado
2. **Frequência**: Executar a cada 15-30 minutos garante entrega pontual
3. **Mensagens Personalizadas**: Customize as mensagens na criação do lembrete
4. **Monitoramento**: Verifique regularmente os lembretes com erro
5. **Backup**: Mantenha registros dos lembretes enviados para auditoria
