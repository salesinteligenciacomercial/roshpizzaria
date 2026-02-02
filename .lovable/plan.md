
# Plano: Integrar Dados Reais do Meta Ads ao Analytics de Campanhas

## Situacao Atual

O componente `CampaignAnalytics.tsx` atualmente:
- Busca apenas dados da tabela `leads` (lead_source_type, utm_campaign, etc)
- Mostra 869 leads como "Sem campanha" porque os campos utm estao vazios
- Nao busca dados reais da Meta Marketing API (gastos, impressoes, cliques)

Voce ja tem configurado:
- Ad Account ID: `1430046645399245`
- Meta Access Token no tenant_integrations
- Marketing Status: connected

**O que falta**: Uma edge function que busca dados REAIS das campanhas do Meta Ads

---

## Solucao Proposta

### 1. Nova Edge Function: `meta-marketing-insights`

Criar uma edge function que busca dados reais da Meta Marketing API:

```text
Endpoint: GET /meta-marketing-insights?company_id=xxx&date_preset=last_30d

Retorna:
- account_info: nome da conta, moeda, BM info
- campaigns: lista de campanhas com metricas
- adsets: conjuntos de anuncios
- ads: anuncios individuais
- summary: totais de gastos, impressoes, cliques, CPL
```

### 2. Dados que serao buscados da Meta API

Para cada campanha/conjunto/anuncio:
- **name**: Nome real da campanha
- **status**: ACTIVE, PAUSED, etc
- **objective**: LEAD_GENERATION, MESSAGES, etc
- **spend**: Valor gasto (R$)
- **impressions**: Total de impressoes
- **clicks**: Total de cliques
- **reach**: Alcance unico
- **cpm**: Custo por mil impressoes
- **cpc**: Custo por clique
- **ctr**: Taxa de cliques
- **actions**: Leads gerados, mensagens iniciadas

### 3. Atualizar CampaignAnalytics.tsx

Novo layout com dados reais:

```text
+------------------------+------------------------+------------------------+------------------------+
|   Gasto Total          |   Impressoes           |   Cliques             |   CPL (Custo/Lead)     |
|   R$ 1.500,00          |   45.000               |   1.200               |   R$ 15,00             |
+------------------------+------------------------+------------------------+------------------------+

+------------------------------------------------------------------------------------+
| Campanhas Ativas                                                                    |
+------------------------------------------------------------------------------------+
| Nome Campanha          | Objetivo      | Gasto    | Leads | Impressoes | CTR       |
|------------------------|---------------|----------|-------|------------|-----------|
| Campanha Leads Jan     | LEAD_GEN      | R$ 500   | 35    | 15.000     | 2.5%      |
| CTWA WhatsApp          | MESSAGES      | R$ 800   | 52    | 20.000     | 3.1%      |
+------------------------------------------------------------------------------------+

+------------------------------------------------------------------------------------+
| Detalhamento por Conjunto de Anuncio                                               |
+------------------------------------------------------------------------------------+
| Campanha / Conjunto    | Anuncio       | Gasto    | Leads | CTR    | Status        |
|------------------------|---------------|----------|-------|--------|---------------|
| Campanha Leads Jan     |               |          |       |        |               |
|   └ Publico 25-45      | Video Teste   | R$ 250   | 18    | 2.8%   | ● Ativo       |
|   └ Remarketing        | Carrossel     | R$ 250   | 17    | 2.2%   | ● Ativo       |
+------------------------------------------------------------------------------------+
```

### 4. Integracao com Leads do CRM

Cruzar dados da Meta API com leads do CRM:
- Associar leads pelo `campaign_id` armazenado no lead
- Calcular taxa de conversao real (leads Meta vs leads ganhos no CRM)
- Mostrar ROI: valor gerado vs valor gasto

---

## Arquivos a Criar/Modificar

### Novos Arquivos:
1. `supabase/functions/meta-marketing-insights/index.ts`
   - Buscar dados da Meta Marketing API
   - Autenticar com access_token do tenant_integrations
   - Retornar campanhas, adsets, ads com metricas

### Arquivos a Modificar:
1. `src/components/analytics/CampaignAnalytics.tsx`
   - Adicionar estado para dados da Meta API
   - Chamar edge function para buscar insights
   - Novo layout com metricas reais (gasto, impressoes, cliques, CPL)
   - Tabela hierarquica (Campanha > Adset > Ad)
   - Associar com leads do CRM para calcular ROI

---

## Fluxo de Funcionamento

```text
1. Usuario acessa Analytics > Campanhas
2. Frontend chama edge function meta-marketing-insights
3. Edge function:
   a. Busca ad_account_id e meta_access_token do tenant_integrations
   b. Chama Meta Graph API:
      GET /{ad_account_id}/campaigns?fields=name,status,objective,insights{spend,impressions,clicks...}
      GET /{ad_account_id}/adsets?fields=name,campaign_id,status,insights{...}
      GET /{ad_account_id}/ads?fields=name,adset_id,status,creative,insights{...}
   c. Retorna dados formatados
4. Frontend exibe dados reais + cruza com leads do CRM
```

---

## Metricas que serao exibidas

### KPIs Principais:
- **Gasto Total**: Soma do spend de todas campanhas
- **Impressoes**: Total de vezes que anuncios foram exibidos
- **Cliques**: Total de interacoes
- **CPL**: Custo por Lead (gasto / leads gerados)
- **CTR**: Taxa de cliques (cliques / impressoes * 100)
- **ROI**: Valor gerado no CRM / Gasto em ads

### Por Campanha:
- Nome da campanha
- Objetivo (Lead Gen, Messages, Traffic)
- Status (Ativo, Pausado)
- Gasto
- Leads gerados
- Impressoes
- CTR
- CPC

### Informacoes do BM (Business Manager):
- Nome da conta de anuncios
- Moeda configurada
- ID do Business Manager

---

## Consideracoes Tecnicas

1. **Cache**: Os dados serao buscados em tempo real, mas podemos implementar cache de 15 minutos para nao sobrecarregar a API

2. **Permissoes necessarias**: O token precisa ter `ads_read` - ja configurado no sistema

3. **Date Presets suportados**: 
   - today, yesterday
   - last_7d, last_14d, last_30d, last_90d
   - this_month, last_month

4. **Limites da API**: A Meta API tem rate limits, entao otimizaremos as chamadas

---

## Resultado Esperado

Apos implementacao, o Analytics de Campanhas mostrara:
- Dados REAIS de gastos das campanhas
- Metricas de performance (CTR, CPC, CPL)
- Hierarquia completa: Campanha > Conjunto > Anuncio
- Cruzamento com leads do CRM para calcular ROI real
- Informacoes do Business Manager conectado
