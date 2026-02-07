
# Plano: Sistema de Propostas Bancarias para Promotoras/Correspondentes

## Objetivo
Criar um sistema completo de gerenciamento de propostas bancarias no menu Conversas, especifico para o segmento de promotora e correspondente bancario.

---

## Estrutura de Dados

### Nova Tabela: `propostas_bancarias`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | Identificador unico |
| company_id | UUID | Empresa dona da proposta |
| lead_id | UUID | Lead/cliente vinculado |
| banco | TEXT | Banco selecionado |
| tipo | TEXT | Tipo de operacao |
| valor_liberado | NUMERIC | Valor em R$ |
| status | TEXT | Status atual da proposta |
| motivo_cancelamento | TEXT | Motivo (quando cancelada) |
| responsavel_id | UUID | Usuario responsavel |
| notas | TEXT | Observacoes |
| created_at | TIMESTAMP | Data de criacao |
| updated_at | TIMESTAMP | Ultima atualizacao |

### Nova Tabela: `bancos_disponiveis`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| id | UUID | Identificador unico |
| company_id | UUID | Empresa (permite bancos customizados) |
| nome | TEXT | Nome do banco |
| ativo | BOOLEAN | Se esta disponivel |
| created_at | TIMESTAMP | Data de criacao |

---

## Opcoes Pre-definidas

### Bancos (com opcao de cadastrar novos)
- Digio
- C6 Bank
- Pan
- BMG
- Itau
- Santander
- Happy
- Icred
- + Cadastrar Banco (permite adicionar novos)

### Tipos de Operacao
- Novo
- Refinanciamento
- Portabilidade pura
- Portabilidade + Refin

### Status da Proposta
- Em andamento
- Aguardando CIP
- Aguardando averbacao
- Aguardando Pagamento
- Pendente
- Cancelado (com campo para motivo)
- Pago

---

## Componentes a Criar

### 1. `PropostaBancariaDialog.tsx`
Dialog para adicionar nova proposta com:
- Seletor de Banco (com opcao de cadastrar novo)
- Seletor de Tipo de operacao
- Campo de Valor Liberado (formatado em R$)
- Seletor de Status
- Campo de Observacoes
- Botao Salvar

### 2. `PropostasBancariasPanel.tsx`
Painel colapsavel no menu Conversas mostrando:
- Lista de propostas do lead
- Status visual com cores
- Valor total liberado
- Acoes rapidas (alterar status, excluir)
- Botao "Adicionar Proposta"

---

## Interface Visual

```text
+-----------------------------------------------+
| Propostas Bancarias                    [+]    |
+-----------------------------------------------+
| [Em andamento] BMG - Novo                     |
| Valor: R$ 4.000,00                            |
| [Alterar Status] [Excluir]                    |
+-----------------------------------------------+
| [Pago] C6 Bank - Refinanciamento              |
| Valor: R$ 12.500,00                           |
+-----------------------------------------------+
| Total Liberado: R$ 16.500,00                  |
+-----------------------------------------------+
```

---

## Cores dos Status

| Status | Cor |
|--------|-----|
| Em andamento | Azul |
| Aguardando CIP | Amarelo |
| Aguardando averbacao | Laranja |
| Aguardando Pagamento | Roxo |
| Pendente | Cinza |
| Cancelado | Vermelho |
| Pago | Verde |

---

## Integracao

O painel de Propostas Bancarias sera adicionado **logo abaixo do painel de Vendas/Negociacoes** existente na area de informacoes do lead no menu Conversas.

---

## Detalhes Tecnicos

### Migration SQL

```sql
-- Tabela de bancos disponiveis
CREATE TABLE public.bancos_disponiveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inserir bancos padrao (sem company_id = disponiveis para todos)
INSERT INTO public.bancos_disponiveis (company_id, nome) 
SELECT c.id, b.nome
FROM public.companies c
CROSS JOIN (VALUES 
  ('Digio'), ('C6 Bank'), ('Pan'), ('BMG'), 
  ('Itau'), ('Santander'), ('Happy'), ('Icred')
) AS b(nome);

-- Tabela de propostas bancarias
CREATE TABLE public.propostas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  banco TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('novo', 'refinanciamento', 'portabilidade_pura', 'portabilidade_refin')),
  valor_liberado NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'aguardando_cip', 'aguardando_averbacao', 'aguardando_pagamento', 'pendente', 'cancelado', 'pago')),
  motivo_cancelamento TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indices
CREATE INDEX idx_propostas_bancarias_company ON public.propostas_bancarias(company_id);
CREATE INDEX idx_propostas_bancarias_lead ON public.propostas_bancarias(lead_id);
CREATE INDEX idx_bancos_disponiveis_company ON public.bancos_disponiveis(company_id);

-- RLS
ALTER TABLE public.propostas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bancos_disponiveis ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage propostas of their company" ON public.propostas_bancarias
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage bancos of their company" ON public.bancos_disponiveis
  FOR ALL USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
```

### Arquivos a Criar

1. `src/components/conversas/PropostaBancariaDialog.tsx`
2. `src/components/conversas/PropostasBancariasPanel.tsx`

### Arquivos a Modificar

1. `src/pages/Conversas.tsx` - Adicionar import e renderizar o painel

---

## Fluxo de Uso

1. Usuario abre conversa com lead
2. No painel lateral, ve secao "Propostas Bancarias"
3. Clica em "+" para adicionar nova proposta
4. Preenche: Banco, Tipo, Valor Liberado, Status
5. Salva proposta
6. Proposta aparece na lista com status visual
7. Pode alterar status conforme evolucao
8. Quando status = "Pago", proposta fica verde
