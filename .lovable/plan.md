

# Plano: Funcionalidades Jurídicas para Segmento Advocacia

## Visão Geral

Criar um conjunto de funcionalidades exclusivas para empresas do segmento "advocacia", seguindo o mesmo padrão já implementado para segmentos financeiros (`isSegmentoFinanceiro`). O sistema exibirá campos e painéis específicos para gestão de processos jurídicos (comerciais e trabalhistas) nos módulos Relatórios, Bate-Papo, Funil de Vendas, Tarefas e Agenda.

---

## Etapa 1: Infraestrutura de Segmento Jurídico

**Arquivo: `src/lib/segmentos.ts`**
- Adicionar constante `SEGMENTOS_JURIDICOS = ["advocacia"]`
- Criar função `isSegmentoJuridico(segmento)` (espelhando `isSegmentoFinanceiro`)

---

## Etapa 2: Tabela de Processos Jurídicos (Database)

Criar tabela `legal_processes` com campos essenciais:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | ID |
| company_id | uuid FK | Empresa |
| lead_id | uuid FK (nullable) | Cliente/Lead vinculado |
| numero_processo | text | Número do processo (CNJ) |
| tipo | enum | `comercial`, `trabalhista`, `civil`, `tributario`, `criminal`, `administrativo` |
| vara | text | Vara/Tribunal |
| comarca | text | Comarca |
| status | enum | `em_andamento`, `aguardando_audiencia`, `aguardando_pericia`, `suspenso`, `arquivado`, `ganho`, `perdido` |
| valor_causa | numeric | Valor da causa |
| valor_honorarios | numeric | Valor dos honorários |
| data_distribuicao | date | Data de distribuição |
| data_audiencia | timestamptz | Próxima audiência |
| parte_contraria | text | Parte contrária |
| descricao | text | Resumo do processo |
| prioridade | text | `baixa`, `media`, `alta`, `urgente` |
| responsavel_id | uuid | Advogado responsável |
| created_at / updated_at | timestamptz | Timestamps |

**RLS**: Acesso baseado em `company_id` do usuário autenticado (mesmo padrão das outras tabelas).

Criar tabela auxiliar `legal_process_events` para movimentações:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid PK | ID |
| process_id | uuid FK | Processo vinculado |
| company_id | uuid FK | Empresa |
| tipo_evento | text | `audiencia`, `petição`, `despacho`, `sentença`, `acordo`, `recurso`, `pericia`, `outro` |
| descricao | text | Descrição do evento |
| data_evento | date | Data |
| created_by | uuid | Quem registrou |
| created_at | timestamptz | Timestamp |

---

## Etapa 3: Módulo Relatórios (Analytics)

**Arquivo: `src/pages/Analytics.tsx`**
- Adicionar nova aba "Jurídico" (visível apenas quando `isSegmentoJuridico(companySegmento) || isMasterAccount`)
- Ajustar grid de tabs dinamicamente (como já feito para Propostas)

**Novo componente: `src/components/analytics/JuridicoAnalytics.tsx`**
- Cards de resumo: Total de processos ativos, por tipo (comercial/trabalhista), valor total em causa, próximas audiências
- Gráfico de processos por status
- Gráfico de processos por tipo
- Lista de processos com audiências próximas (próximos 30 dias)
- Taxa de êxito (ganhos vs perdidos)

---

## Etapa 4: Módulo Bate-Papo (Conversas)

**Arquivo: `src/pages/Conversas.tsx`**
- Adicionar painel lateral "Processos Jurídicos" (similar ao `PropostasBancariasPanel`)
- Visível apenas para segmento advocacia
- Mostra processos vinculados ao lead/contato da conversa ativa
- Permite criar novo processo diretamente do chat

**Novo componente: `src/components/conversas/ProcessosJuridicosPanel.tsx`**
- Lista processos do lead selecionado
- Botão "Novo Processo" para vincular
- Status visual com badges coloridas

---

## Etapa 5: Módulo Funil de Vendas (Kanban)

**Arquivo: `src/components/funil/LeadCard.tsx`**
- Para segmento advocacia, exibir badge com quantidade de processos vinculados ao lead
- Ícone de balança (Scale) quando tem processos ativos
- Tooltip com resumo: "3 processos ativos | Próxima audiência: 25/03"

Será necessário um hook `useCompanySegmento()` para que o LeadCard saiba o segmento sem prop drilling excessivo.

---

## Etapa 6: Módulo Tarefas

- Ao criar tarefa, se segmento é advocacia, exibir campo opcional "Processo Vinculado" (select com processos ativos)
- Badge na tarefa indicando processo vinculado
- Requer coluna `legal_process_id` (nullable) na tabela de tarefas

---

## Etapa 7: Módulo Agenda

- Ao criar compromisso, se segmento é advocacia, exibir campo opcional "Processo Vinculado"
- Tipo de compromisso adicional: "Audiência", "Perícia", "Prazo Processual"
- Sincronizar datas de audiência da tabela `legal_processes` como eventos automáticos na agenda
- Requer coluna `legal_process_id` (nullable) na tabela de agenda

---

## Etapa 8: Hook Compartilhado

**Novo: `src/hooks/useCompanySegmento.ts`**
- Retorna `{ segmento, isJuridico, isFinanceiro, isMasterAccount, loading }`
- Centraliza a lógica que hoje é duplicada em Analytics e Conversas

---

## Resumo de Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/lib/segmentos.ts` |
| Criar | `src/hooks/useCompanySegmento.ts` |
| Criar | Migration SQL (tabelas `legal_processes`, `legal_process_events`) |
| Criar | `src/components/analytics/JuridicoAnalytics.tsx` |
| Editar | `src/pages/Analytics.tsx` |
| Criar | `src/components/conversas/ProcessosJuridicosPanel.tsx` |
| Editar | `src/pages/Conversas.tsx` |
| Editar | `src/components/funil/LeadCard.tsx` |
| Editar | Componentes de Tarefas (campo processo vinculado) |
| Editar | Componentes de Agenda (campo processo vinculado + tipos audiência) |
| Migration | Adicionar `legal_process_id` às tabelas de tarefas e agenda |

