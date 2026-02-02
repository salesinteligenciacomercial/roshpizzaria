
# Plano: Melhorar Dashboard de Campanhas Meta Marketing

## Diagnóstico

### Situação Atual
A integração com Meta Marketing API está **funcionando corretamente**:
- Token válido e com permissões corretas
- Conta "jd promotora" conectada com sucesso
- API retorna dados corretamente

### Motivo dos Dados Zerados
A conta de anúncios **não possui campanhas criadas** no Meta Ads Manager. O dashboard exibe "Nenhuma campanha encontrada" porque realmente não existem campanhas para mostrar.

Evidência da consulta ao banco:
- 100% dos leads são marcados como `lead_source_type: organic`
- Nenhum lead possui `campaign_id`, `utm_source` ou `utm_campaign` preenchidos

## Solução Proposta

### 1. Melhorar Estado Vazio com Guia de Configuração
Quando não há campanhas, mostrar um guia visual orientando o usuário:
- Como criar campanhas no Meta Ads Manager
- Como configurar Lead Ads para captura automática
- Como configurar UTM tracking em links

### 2. Adicionar Seção "Leads por Origem" (CRM Data)
Mostrar dados do CRM mesmo sem campanhas Meta:
- Leads por `source` (WhatsApp, Indicação, etc.)
- Leads por `lead_source_type` 
- Rastreamento de conversões quando houver dados UTM

### 3. Adicionar Painel de Configuração de Lead Ads
Interface para configurar:
- Conexão com formulários de Lead Ads
- Webhook URL para receber leads automaticamente
- Mapeamento de campos do formulário

### 4. Expandir Períodos de Busca
Adicionar opção de buscar em períodos maiores:
- `lifetime` (todo o histórico)
- `this_year` (ano atual)

## Mudanças Técnicas

### Arquivos a Modificar

#### `src/components/analytics/CampaignAnalytics.tsx`
1. Adicionar estado vazio melhorado com guia visual
2. Adicionar seção de "Leads por Origem" usando dados do CRM
3. Adicionar card de configuração de Lead Ads
4. Expandir opções de período

#### `supabase/functions/meta-marketing-insights/index.ts`
1. Adicionar suporte ao `date_preset: lifetime`
2. Retornar flag indicando se conta tem campanhas históricas

### Nova Query de Leads por Origem
```sql
SELECT source, lead_source_type, utm_source, COUNT(*) as total
FROM leads WHERE company_id = ?
GROUP BY source, lead_source_type, utm_source
```

## Layout Proposto

### Quando Não Há Campanhas
```text
+--------------------------------------------------+
|  📊 Campanhas Meta Ads                           |
|                                                  |
|  ✅ Conta conectada: jd promotora               |
|  ⚠️  Nenhuma campanha encontrada                |
|                                                  |
|  +--------------------------------------------+ |
|  | 🎯 Como começar                            | |
|  |                                            | |
|  | 1. Acesse o Meta Ads Manager               | |
|  | 2. Crie uma campanha com objetivo de Leads | |
|  | 3. Configure o formulário de Lead Ads      | |
|  | 4. Os leads aparecerão automaticamente     | |
|  |                                            | |
|  | [Abrir Meta Ads Manager] [Config Lead Ads] | |
|  +--------------------------------------------+ |
|                                                  |
|  📈 Leads por Origem (dados do CRM)             |
|  +--------------------------------------------+ |
|  | WhatsApp         |  211 leads  | 24%       | |
|  | Orgânico         |  646 leads  | 74%       | |
|  | Indicação        |    1 lead   |  0%       | |
|  +--------------------------------------------+ |
+--------------------------------------------------+
```

### Quando Há Campanhas
Mantém o layout atual com a tabela hierárquica de Campanhas > Conjuntos > Anúncios

## Benefícios
1. Dashboard útil mesmo sem campanhas ativas
2. Orientação clara para usuários iniciantes
3. Visibilidade de dados do CRM para análise de origens
4. Preparação para tracking futuro com UTM

## Próximos Passos
1. Aprovar este plano
2. Implementar melhorias no componente CampaignAnalytics
3. Adicionar seção de leads por origem
4. Testar com a conta atual
