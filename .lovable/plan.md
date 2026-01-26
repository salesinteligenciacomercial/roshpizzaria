
# Calculador de Custos por Subconta

## Objetivo
Criar um módulo integrado ao Financeiro que calcule e exiba o custo operacional real de cada subconta, permitindo precificação assertiva das mensalidades.

---

## Arquitetura da Solucao

### 1. Nova Tabela de Metricas de Uso (Database)

Criar tabela `company_usage_metrics` para armazenar snapshots de uso:

```sql
CREATE TABLE public.company_usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Metricas de Uso
  total_leads INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  media_files_count INTEGER DEFAULT 0,
  storage_bytes_used BIGINT DEFAULT 0,
  edge_function_calls INTEGER DEFAULT 0,
  ia_requests INTEGER DEFAULT 0,
  automation_executions INTEGER DEFAULT 0,
  
  -- Custos Calculados (em centavos para precisao)
  database_cost INTEGER DEFAULT 0,
  storage_cost INTEGER DEFAULT 0,
  edge_functions_cost INTEGER DEFAULT 0,
  ia_cost INTEGER DEFAULT 0,
  whatsapp_cost INTEGER DEFAULT 0,
  total_cost INTEGER DEFAULT 0,
  
  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT now(),
  master_company_id UUID REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indice para busca eficiente
CREATE INDEX idx_usage_metrics_company_period 
ON company_usage_metrics(company_id, period_start, period_end);
```

### 2. Tabela de Configuracao de Custos

```sql
CREATE TABLE public.cost_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_company_id UUID NOT NULL REFERENCES companies(id),
  
  -- Custos por unidade (em centavos BRL)
  cost_per_lead INTEGER DEFAULT 5,           -- R$ 0,05 por lead
  cost_per_user INTEGER DEFAULT 500,         -- R$ 5,00 por usuario
  cost_per_message_sent INTEGER DEFAULT 4,   -- R$ 0,04 por msg enviada
  cost_per_message_received INTEGER DEFAULT 1, -- R$ 0,01 por msg recebida
  cost_per_media_file INTEGER DEFAULT 10,    -- R$ 0,10 por arquivo
  cost_per_gb_storage INTEGER DEFAULT 1000,  -- R$ 10,00 por GB
  cost_per_edge_call INTEGER DEFAULT 1,      -- R$ 0,01 por chamada
  cost_per_ia_request INTEGER DEFAULT 50,    -- R$ 0,50 por request IA
  cost_per_automation INTEGER DEFAULT 2,     -- R$ 0,02 por execucao
  
  -- Custos fixos
  base_monthly_cost INTEGER DEFAULT 2000,    -- R$ 20,00 base
  
  -- WhatsApp custos por tipo
  whatsapp_utility_cost INTEGER DEFAULT 4,   -- R$ 0,035 utilidade
  whatsapp_marketing_cost INTEGER DEFAULT 7, -- R$ 0,065 marketing
  whatsapp_auth_cost INTEGER DEFAULT 5,      -- R$ 0,045 autenticacao
  
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(master_company_id)
);
```

---

## Componentes Frontend

### 3. Novo Componente: CustoCalculator.tsx

Localizado em `src/components/financeiro/CustoCalculator.tsx`:

**Funcionalidades:**
- Cards de resumo (Custo Total, Custo Medio, Margem Sugerida)
- Tabela detalhada por subconta com breakdown de custos
- Filtros por periodo (Mes atual, Ultimos 3 meses, Custom)
- Grafico comparativo de custos vs receita
- Export para CSV/Excel

**Interface visual:**
```text
+------------------------------------------+
| CALCULADOR DE CUSTOS                     |
+------------------------------------------+
| [Card] Custo Total  | [Card] Custo Medio |
| R$ 1.234,00         | R$ 82,26/subconta  |
+------------------------------------------+
| [Card] Margem Media | [Card] Lucro Bruto |  
| 68.5%               | R$ 2.680,00        |
+------------------------------------------+

| Subconta | Leads | Msgs | Storage | WhatsApp | IA | Total | Receita | Margem |
|----------|-------|------|---------|----------|----|----- |---------|--------|
| AB CONN  | R$12  | R$47 | R$8     | R$89     | R$5| R$161| R$497   | 67.6%  |
| WR Corr  | R$8   | R$5  | R$2     | R$12     | R$0| R$27 | R$297   | 90.9%  |
```

### 4. Componente: CostConfigurationDialog.tsx

Dialog para configurar custos unitarios:
- Inputs para cada tipo de custo
- Preview de calculo com dados reais
- Salvar configuracao persistente

### 5. Componente: CostBreakdownCard.tsx

Card expansivel mostrando detalhamento:
- Pie chart de distribuicao de custos
- Linha do tempo de custos mensais
- Alertas de subcontas com margem negativa

---

## Hook Customizado

### 6. useCompanyCosts.ts

```typescript
interface CompanyUsageData {
  companyId: string;
  companyName: string;
  totalLeads: number;
  totalUsers: number;
  messagesSent: number;
  messagesReceived: number;
  mediaFiles: number;
  storageBytes: number;
  edgeFunctionCalls: number;
  iaRequests: number;
  automationExecutions: number;
}

interface CompanyCostBreakdown {
  companyId: string;
  companyName: string;
  databaseCost: number;
  storageCost: number;
  edgeFunctionsCost: number;
  iaCost: number;
  whatsappCost: number;
  totalCost: number;
  monthlyRevenue: number;
  margin: number;
  marginPercent: number;
}
```

**Funcoes:**
- `loadUsageMetrics(startDate, endDate)` - Agrega dados de uso
- `calculateCosts(usageData, config)` - Aplica custos unitarios
- `saveUsageSnapshot()` - Persiste metricas para historico
- `getCostConfiguration()` - Carrega configuracao

---

## Integracao com Financeiro.tsx

### 7. Nova Aba "Custos"

Adicionar ao TabsList:
```typescript
<TabsTrigger value="custos" className="gap-2">
  <Calculator className="h-4 w-4" />
  <span className="hidden sm:inline">Custos</span>
</TabsTrigger>
```

Adicionar TabsContent:
```typescript
<TabsContent value="custos">
  <CustoCalculator 
    subcontas={subcontas}
    subscriptions={subscriptions}
  />
</TabsContent>
```

---

## Funcao de Calculo de Metricas

### 8. Funcao SQL para Agregar Uso

```sql
CREATE OR REPLACE FUNCTION calculate_company_usage(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_leads', (SELECT COUNT(*) FROM leads WHERE company_id = p_company_id),
    'total_users', (SELECT COUNT(*) FROM user_roles WHERE company_id = p_company_id),
    'messages_sent', (SELECT COUNT(*) FROM conversas WHERE company_id = p_company_id 
                      AND fromme = true AND created_at BETWEEN p_start_date AND p_end_date),
    'messages_received', (SELECT COUNT(*) FROM conversas WHERE company_id = p_company_id 
                          AND fromme = false AND created_at BETWEEN p_start_date AND p_end_date),
    'media_files', (SELECT COUNT(*) FROM conversas WHERE company_id = p_company_id 
                    AND tipo_mensagem IN ('audio','video','image','document') 
                    AND created_at BETWEEN p_start_date AND p_end_date),
    'automation_executions', (SELECT COUNT(*) FROM automation_flow_logs 
                              WHERE company_id = p_company_id 
                              AND started_at BETWEEN p_start_date AND p_end_date),
    'ia_requests', (SELECT COALESCE(SUM(times_used), 0) FROM ia_scripts 
                    WHERE company_id = p_company_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/financeiro/CustoCalculator.tsx` | Componente principal do calculador |
| `src/components/financeiro/CostConfigurationDialog.tsx` | Dialog de configuracao de custos |
| `src/components/financeiro/CostBreakdownCard.tsx` | Card de detalhamento expandivel |
| `src/components/financeiro/CostComparisonChart.tsx` | Grafico custo vs receita |
| `src/hooks/useCompanyCosts.ts` | Hook de logica de custos |

## Arquivos a Editar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Financeiro.tsx` | Adicionar aba "Custos" |
| `src/hooks/useFinanceiro.ts` | Expor subcontas/costs data |

---

## Fluxo de Uso

```text
1. Master admin acessa Financeiro > Custos
2. Sistema carrega metricas de uso de todas subcontas
3. Aplica configuracao de custos (default ou customizada)
4. Exibe tabela com custos calculados por subconta
5. Compara com receita da assinatura para mostrar margem
6. Admin pode ajustar custos unitarios e ver simulacao
7. Opcao de exportar relatorio para analise
```

---

## Resumo Tecnico

**Complexidade:** Media-Alta  
**Migrations:** 2 tabelas + 1 funcao SQL  
**Componentes:** 5 novos  
**Hooks:** 1 novo  
**Estimativa:** ~400 linhas de codigo
