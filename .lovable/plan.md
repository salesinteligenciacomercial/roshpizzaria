
# Melhorias no Calculador de Custos

## Visao Geral

Implementar tres novas funcionalidades no modulo de Custos do Financeiro:
1. **Custo Historico Total** - Visualizacao do custo acumulado desde a ativacao de cada subconta
2. **Comparativo Mensal** - Relatorio de evolucao de custos mes a mes
3. **Alertas de Limite** - Notificacoes automaticas quando custos excedem limites configurados

---

## 1. Custo Historico Total

### Alteracoes no Banco de Dados

Criar nova funcao SQL para calcular custo historico desde a ativacao:

```sql
CREATE OR REPLACE FUNCTION get_subconta_historical_cost(
  p_master_company_id UUID,
  p_company_id UUID
) RETURNS JSONB AS $$
DECLARE
  result JSONB;
  v_activation_date DATE;
BEGIN
  -- Buscar data de ativacao da subconta
  SELECT created_at::date INTO v_activation_date
  FROM companies WHERE id = p_company_id;
  
  SELECT jsonb_build_object(
    'activation_date', v_activation_date,
    'months_active', EXTRACT(MONTH FROM age(current_date, v_activation_date)) + 
                     EXTRACT(YEAR FROM age(current_date, v_activation_date)) * 12,
    'total_messages_sent', (SELECT COUNT(*) FROM conversas WHERE company_id = p_company_id AND fromme = true),
    'total_messages_received', (SELECT COUNT(*) FROM conversas WHERE company_id = p_company_id AND fromme = false),
    'total_media_files', (SELECT COUNT(*) FROM conversas WHERE company_id = p_company_id 
                          AND tipo_mensagem IN ('audio','video','image','document')),
    'total_automations', (SELECT COUNT(*) FROM automation_flow_logs WHERE company_id = p_company_id)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Alteracoes no Frontend

**Interface `CompanyCostBreakdown`** - Adicionar campos:
```typescript
// Em useCompanyCosts.ts
export interface CompanyCostBreakdown {
  // ... campos existentes ...
  
  // Novos campos para historico
  activationDate?: string;
  monthsActive?: number;
  historicalTotalCost?: number;
  historicalMessagesSent?: number;
  historicalMessagesReceived?: number;
  historicalMediaFiles?: number;
  historicalAutomations?: number;
}
```

**Novo componente `HistoricalCostCard.tsx`**:
- Card mostrando custo total acumulado
- Data de ativacao da subconta
- Meses ativos
- Grafico de linha com evolucao mensal
- Custo medio mensal

**Integracao na tabela principal**:
- Nova coluna "Historico" com icone clicavel
- Ao clicar, abre modal com detalhes historicos

---

## 2. Comparativo Mensal de Custos

### Alteracoes no Banco de Dados

Criar funcao SQL para retornar dados mensais agregados:

```sql
CREATE OR REPLACE FUNCTION get_monthly_cost_comparison(
  p_master_company_id UUID,
  p_months INTEGER DEFAULT 6
) RETURNS TABLE(
  month_year TEXT,
  month_date DATE,
  company_id UUID,
  company_name TEXT,
  total_cost INTEGER,
  messages_cost INTEGER,
  leads_cost INTEGER,
  media_cost INTEGER,
  revenue INTEGER,
  margin INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH months AS (
    SELECT generate_series(
      date_trunc('month', current_date - (p_months || ' months')::interval),
      date_trunc('month', current_date),
      '1 month'::interval
    )::date as month_start
  )
  -- Agregacao por mes e subconta
  SELECT 
    to_char(m.month_start, 'YYYY-MM') as month_year,
    m.month_start as month_date,
    c.id as company_id,
    c.name as company_name,
    -- Calculos de custo baseados em uso do mes
    ...
  FROM months m
  CROSS JOIN companies c
  WHERE c.parent_company_id = p_master_company_id
  ORDER BY m.month_start, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Novo Componente `MonthlyCostComparison.tsx`

**Funcionalidades**:
- Tabela pivotada com meses como colunas
- Linhas por subconta
- Cores indicando variacao (verde = reducao, vermelho = aumento)
- Porcentagem de variacao entre meses
- Grafico de area empilhada mostrando distribuicao de custos
- Filtro para selecionar numero de meses (3, 6, 12)

**Layout visual**:
```text
+--------------------------------------------------------------------+
| COMPARATIVO MENSAL                           [3 meses] [6m] [12m]  |
+--------------------------------------------------------------------+
|              | Nov/25  | Dez/25  | Jan/26  | Variacao |            |
|--------------|---------|---------|---------|----------|            |
| AB CONECTA   | R$145   | R$161   | R$178   | +10.5%   |            |
| WR CORRETORA | R$27    | R$31    | R$28    | -9.6%    |            |
| jd promotora | R$45    | R$52    | R$48    | -7.7%    |            |
+--------------------------------------------------------------------+
| [Grafico de area empilhada - evolucao por categoria de custo]      |
+--------------------------------------------------------------------+
```

### Hook `useMonthlyCostHistory.ts`

```typescript
interface MonthlyData {
  monthYear: string;
  monthDate: Date;
  companies: {
    companyId: string;
    companyName: string;
    totalCost: number;
    messagesCost: number;
    leadsCost: number;
    mediaCost: number;
    revenue: number;
    margin: number;
    percentChange: number;
  }[];
  totals: {
    totalCost: number;
    totalRevenue: number;
  };
}
```

---

## 3. Alertas de Limite de Custo

### Alteracoes no Banco de Dados

**Nova tabela `cost_alerts`**:

```sql
CREATE TABLE public.cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_company_id UUID NOT NULL REFERENCES companies(id),
  company_id UUID REFERENCES companies(id), -- NULL = todas subcontas
  alert_name TEXT NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('total_cost', 'margin_percent', 'cost_category')),
  threshold_value INTEGER NOT NULL, -- em centavos ou percentual x100
  threshold_operator TEXT CHECK (threshold_operator IN ('>', '<', '>=', '<=')),
  cost_category TEXT, -- para alertas de categoria especifica
  is_active BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT true,
  notify_in_app BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para historico de alertas disparados
CREATE TABLE public.cost_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES cost_alerts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id),
  triggered_value INTEGER NOT NULL,
  threshold_value INTEGER NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Novo Componente `CostAlertsManager.tsx`

**Funcionalidades**:
- Lista de alertas configurados
- Botao para criar novo alerta
- Dialog de configuracao com:
  - Nome do alerta
  - Tipo (custo total, margem, categoria)
  - Subconta especifica ou todas
  - Valor limite
  - Operador (maior que, menor que)
  - Opcoes de notificacao
- Indicador visual de alertas ativos
- Historico de alertas disparados

**Layout visual**:
```text
+--------------------------------------------------------------------+
| ALERTAS DE CUSTO                                    [+ Novo Alerta]|
+--------------------------------------------------------------------+
| Nome                | Tipo       | Limite    | Status  | Acoes    |
|---------------------|------------|-----------|---------|----------|
| Custo Alto AB       | Total      | > R$200   | Ativo   | [Ed][Del]|
| Margem Critica      | Margem     | < 30%     | Ativo   | [Ed][Del]|
| Msgs Excessivas     | Categoria  | > R$100   | Pausado | [Ed][Del]|
+--------------------------------------------------------------------+
```

### Componente `CostAlertBadge.tsx`

- Badge que aparece na tabela de custos quando subconta excede limite
- Icone de alerta com tooltip explicativo
- Clicavel para ver detalhes

### Integracao com Hook `useCompanyCosts.ts`

Adicionar funcao para verificar alertas:

```typescript
const checkCostAlerts = useCallback(async (breakdowns: CompanyCostBreakdown[]) => {
  // Buscar alertas configurados
  // Comparar com valores atuais
  // Retornar lista de alertas disparados
  // Salvar no historico se necessario
}, []);
```

---

## Integracao no CustoCalculator.tsx

### Nova Estrutura de Tabs Internas

```typescript
<Tabs defaultValue="overview">
  <TabsList>
    <TabsTrigger value="overview">Visao Geral</TabsTrigger>
    <TabsTrigger value="monthly">Comparativo Mensal</TabsTrigger>
    <TabsTrigger value="alerts">Alertas</TabsTrigger>
  </TabsList>
  
  <TabsContent value="overview">
    {/* Conteudo atual + coluna de historico */}
  </TabsContent>
  
  <TabsContent value="monthly">
    <MonthlyCostComparison />
  </TabsContent>
  
  <TabsContent value="alerts">
    <CostAlertsManager />
  </TabsContent>
</Tabs>
```

### Summary Cards Atualizados

Adicionar novos cards:
- **Custo Historico Total**: Soma de todos os custos desde ativacao
- **Alertas Ativos**: Contador de subcontas em alerta

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/financeiro/HistoricalCostCard.tsx` | Card de custo historico por subconta |
| `src/components/financeiro/MonthlyCostComparison.tsx` | Comparativo mensal de custos |
| `src/components/financeiro/CostAlertsManager.tsx` | Gerenciador de alertas |
| `src/components/financeiro/CostAlertDialog.tsx` | Dialog para criar/editar alertas |
| `src/components/financeiro/CostAlertBadge.tsx` | Badge de alerta na tabela |
| `src/hooks/useMonthlyCostHistory.ts` | Hook para dados mensais |
| `src/hooks/useCostAlerts.ts` | Hook para gerenciar alertas |

## Arquivos a Editar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/financeiro/CustoCalculator.tsx` | Adicionar tabs internas e integracao |
| `src/hooks/useCompanyCosts.ts` | Adicionar campos historicos e funcao de alertas |

---

## Resumo das Migrations

```sql
-- 1. Funcao para custo historico
CREATE OR REPLACE FUNCTION get_subconta_historical_cost(...);

-- 2. Funcao para comparativo mensal
CREATE OR REPLACE FUNCTION get_monthly_cost_comparison(...);

-- 3. Tabela de alertas
CREATE TABLE cost_alerts (...);
CREATE TABLE cost_alert_history (...);

-- 4. RLS policies para as novas tabelas
CREATE POLICY "Master can manage own alerts" ON cost_alerts ...;
CREATE POLICY "Master can view own alert history" ON cost_alert_history ...;
```

---

## Fluxo de Usuario

```text
1. Admin acessa Financeiro > Custos
2. Ve resumo com custo total historico e alertas ativos
3. Na tabela, clica em subconta para ver historico detalhado
4. Muda para aba "Comparativo Mensal" para analisar tendencias
5. Identifica subconta com crescimento de custo
6. Vai para aba "Alertas" e configura limite
7. Recebe notificacao quando limite for ultrapassado
```

---

## Estimativas

**Complexidade**: Alta
**Migrations**: 2 funcoes SQL + 2 tabelas + RLS
**Componentes novos**: 6
**Hooks novos**: 2
**Linhas de codigo estimadas**: ~800
