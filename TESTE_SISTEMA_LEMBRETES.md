# 🧪 TESTE DO SISTEMA DE LEMBRETES - AGENDA

## 📋 Cenários de Teste Obrigatórios

### ✅ TESTE 1: Criação de Compromisso com Lembrete
**Objetivo:** Verificar se lembretes são criados corretamente com data_envio calculada

**Passos:**
1. Acesse a página Agenda
2. Clique em "Novo Agendamento"
3. Preencha os dados:
   - Selecione um lead existente
   - Data: Amanhã
   - Hora: 10:00
   - Tipo: Reunião
   - Marque "Enviar lembrete automático"
   - Antecedência: 24 horas
   - Destinatário: Lead
4. Clique em "Criar Agendamento"

**Resultado Esperado:**
- ✅ Compromisso criado com sucesso
- ✅ Lembrete criado na tabela `lembretes`
- ✅ Campo `data_envio` calculado corretamente (hoje às 10:00)
- ✅ Campo `company_id` preenchido
- ✅ Status inicial: `pendente`

---

### ✅ TESTE 2: Cron Job Executando Automaticamente
**Objetivo:** Verificar se o cron job está executando a cada 5 minutos

**Passos:**
1. Aguarde 5 minutos após criar o compromisso do Teste 1
2. Verifique os logs do Supabase Edge Functions
3. Verifique o status do lembrete na aba "Lembretes"

**Resultado Esperado:**
- ✅ Cron job executado automaticamente
- ✅ Lembrete com data_envio expirada foi processado
- ✅ Status mudou para `enviado` ou `erro`
- ✅ Campo `tentativas` incrementado

---

### ✅ TESTE 3: Isolamento por Empresa
**Objetivo:** Garantir que lembretes de uma empresa não interfiram com outras

**Passos:**
1. Crie um compromisso com lembrete para Empresa A
2. Crie um compromisso com lembrete para Empresa B (se existir)
3. Verifique se cada lembrete usa a configuração WhatsApp correta da sua empresa

**Resultado Esperado:**
- ✅ Lembrete A usa configuração WhatsApp da Empresa A
- ✅ Lembrete B usa configuração WhatsApp da Empresa B
- ✅ Fallback para configuração global se empresa não tem WhatsApp próprio

---

### ✅ TESTE 4: Sistema de Retry
**Objetivo:** Verificar se falhas são tratadas com retry automático

**Passos:**
1. Crie um lembrete que vai falhar (lead sem telefone válido)
2. Aguarde o processamento automático
3. Verifique o comportamento de retry

**Resultado Esperado:**
- ✅ Primeira tentativa falha
- ✅ Status muda para `retry`
- ✅ `proxima_tentativa` agendada (5 min depois)
- ✅ Após 3 tentativas, status final `erro`

---

### ✅ TESTE 5: Reenvio Manual
**Objetivo:** Verificar funcionalidade de reenvio manual

**Passos:**
1. Na aba "Lembretes", localize um lembrete com status `erro`
2. Clique no botão "Reenviar"
3. Verifique se o lembrete é processado novamente

**Resultado Esperado:**
- ✅ Botão "Reenviar" disponível para lembretes com erro
- ✅ Lembrete processado novamente
- ✅ Status atualizado conforme resultado

---

### ✅ TESTE 6: Dashboard e Métricas
**Objetivo:** Verificar se as métricas estão sendo exibidas corretamente

**Passos:**
1. Acesse a página Agenda
2. Verifique os cards de estatísticas na parte superior
3. Na aba "Lembretes", teste os filtros

**Resultado Esperado:**
- ✅ Cards mostram números corretos (Total, Enviados, Pendentes, etc.)
- ✅ Taxa de sucesso calculada corretamente
- ✅ Filtros funcionam (Status, Canal)
- ✅ Lembretes exibidos com todas as informações (tentativas, próxima tentativa, etc.)

---

## 🔧 Comandos de Verificação

### Verificar Cron Jobs Ativos
```sql
SELECT * FROM cron.job WHERE jobname = 'enviar-lembretes-automatico';
```

### Verificar Histórico de Execuções
```sql
SELECT * FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'enviar-lembretes-automatico')
ORDER BY start_time DESC LIMIT 5;
```

### Verificar Lembretes Pendentes
```sql
SELECT l.*, c.data_hora_inicio, lead.name as lead_name
FROM lembretes l
JOIN compromissos c ON l.compromisso_id = c.id
LEFT JOIN leads lead ON c.lead_id = lead.id
WHERE l.status_envio IN ('pendente', 'retry')
AND l.data_envio <= NOW()
ORDER BY l.data_envio ASC;
```

### Verificar Estatísticas de Lembretes
```sql
SELECT
  status_envio,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as porcentagem
FROM lembretes
GROUP BY status_envio;
```

---

## 🚨 Verificação de Segurança

### Teste de Isolamento de Empresa
```sql
-- Verificar se lembretes têm company_id
SELECT
  l.id,
  l.company_id,
  c.name as company_name,
  l.status_envio
FROM lembretes l
LEFT JOIN companies c ON l.company_id = c.id
ORDER BY l.created_at DESC
LIMIT 10;
```

---

## 📊 Métricas de Sucesso

- [ ] Taxa de entrega > 95%
- [ ] Zero lembretes perdidos por falha de cron
- [ ] Sistema funcionando 24/7
- [ ] Isolamento completo entre empresas
- [ ] Dashboard com métricas precisas
- [ ] UX intuitiva e responsiva

---

## 🐛 Troubleshooting

### Cron Job não executando
1. Verificar se extensão pg_cron está habilitada
2. Verificar se job está agendado: `SELECT * FROM cron.job;`
3. Testar execução manual da Edge Function

### Lembretes não sendo criados
1. Verificar se campo `data_envio` está sendo calculado
2. Verificar se `company_id` está sendo definido
3. Verificar logs do navegador

### WhatsApp não enviando
1. Verificar configuração WhatsApp da empresa
2. Verificar se telefone do lead é válido
3. Verificar logs da Evolution API

---

## ✅ Checklist Final

- [ ] Todos os 6 cenários de teste passaram
- [ ] Cron job executando a cada 5 minutos
- [ ] Sistema de retry funcionando
- [ ] Isolamento por empresa implementado
- [ ] Dashboard mostrando métricas corretas
- [ ] Reenvio manual funcionando
- [ ] Logs detalhados disponíveis

**Status Final:** 🟢 SISTEMA PRONTO PARA PRODUÇÃO

