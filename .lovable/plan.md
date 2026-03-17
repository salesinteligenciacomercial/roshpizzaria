

## Plano: Adicionar Acompanhamento de Follow-Up ao Módulo de Prospecção

### O que a planilha mostra

A planilha original tem **duas seções lado a lado**:

1. **Prospecção** (já implementada): Leads → % → Resposta → % → Oportunidades → % → Reunião → % → Vendas → Ticket → Bruto
2. **Follow-Up** (falta implementar): Follow-up → % → Resposta → % → Reunião — rastreando o retorno de leads que não responderam na primeira abordagem
3. **Painel de Influência/Benchmarks** (bônus): Métricas de referência como taxa de conexão com decisor (7%), agendamento (40%), comparecimento (80%), fechamento (10-33%)

### Implementação

**1. Banco de dados — nova tabela `followup_daily_logs`**

```sql
CREATE TABLE public.followup_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  source TEXT, -- 'whatsapp', 'ligacao', 'email'
  followups_sent INT DEFAULT 0,
  responses INT DEFAULT 0,
  meetings_scheduled INT DEFAULT 0,
  sales_closed INT DEFAULT 0,
  gross_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, user_id, log_date, source)
);
```
Com RLS por `company_id` (mesmo padrão da tabela de prospecção).

**2. Nova aba "Follow-Up" na página de Prospecção**

Adicionar uma terceira aba na página existente (`/prospeccao`):
- **Orgânico** | **Tráfego Pago** | **Follow-Up**

A aba Follow-Up terá:
- **Tabela**: Data | Follow-ups Enviados | % Resposta | Respostas | % Reunião | Reuniões | Vendas | Ticket | Bruto
- **KPIs em cards**: Total Follow-ups, Taxa de Resposta, Taxa de Reunião, Vendas via Follow-up, Ticket Médio
- **Gráfico de funil**: Follow-ups → Respostas → Reuniões → Vendas

**3. Painel de Benchmarks (lateral)**

Adicionar um card "Indicadores de Referência" visível em todas as abas:
- Taxa de conexão com decisor: 7%
- Agendamento: 40%
- Comparecimento: 80%
- Fechamento: 10-33%
- Com notas explicativas (qualidade da lista, script, alinhamento)

**4. Componentes a criar/editar**

- `src/components/prospeccao/FollowUpTable.tsx` — tabela com colunas e % entre colunas
- `src/components/prospeccao/FollowUpKPIs.tsx` — cards de métricas
- `src/components/prospeccao/FollowUpFormDialog.tsx` — formulário de registro
- `src/components/prospeccao/BenchmarkPanel.tsx` — painel de referência lateral
- `src/hooks/useFollowUpData.ts` — hook de dados
- Editar `src/pages/Prospeccao.tsx` — adicionar aba Follow-Up e painel de benchmarks

**5. Formulário de registro**

Campos: Data, Responsável, Canal (WhatsApp/Ligação/Email), Follow-ups enviados, Respostas recebidas, Reuniões agendadas, Vendas, Valor bruto, Observações.

