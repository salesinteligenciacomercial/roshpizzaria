# 🧪 GUIA DE TESTES - MENU LEADS

## 📋 CHECKLIST DE TESTES MANUAIS

### ✅ TESTE 1: Validação Crítica de Company ID

**Objetivo:** Verificar se erro é exibido quando usuário não tem company_id

**Passos:**
1. Acesse a página de Leads
2. Clique em "Novo Lead"
3. Preencha todos os campos obrigatórios
4. Clique em "Criar Lead"

**Resultado Esperado:**
- Se usuário NÃO tem company_id: 
  - ⚠️ Toast de erro: "Sua conta não está vinculada a uma empresa. Solicite configuração ao administrador."
  - Lead NÃO é criado
- Se usuário TEM company_id:
  - ✅ Toast de sucesso: "Lead criado com sucesso!"
  - Lead aparece na lista

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 2: Importação CSV com Validação

**Objetivo:** Validar importação com dados inválidos

**Arquivo de Teste:** Criar `test_leads.csv`
```csv
nome,email,telefone,valor
João Silva,joao@email.com,11987654321,1000
Maria Santos,email_invalido,999,abc
Pedro Costa,pedro@email.com,11912345678,5000
Ana Silva,,123,
Carlos,carlos@email.com,11998877665,-500
```

**Passos:**
1. Acesse a página de Leads
2. Clique em "Importar"
3. Selecione o arquivo `test_leads.csv`
4. Verifique a prévia
5. Clique em "Importar Leads"

**Resultado Esperado:**
- Relatório mostra:
  - Total: 5 linhas
  - Sucesso: 3 leads (João, Pedro, Carlos)
  - Erros: 2 linhas
    - Linha 3: Email inválido, Telefone inválido, Valor inválido
    - Linha 4: Nome é obrigatório, Telefone inválido

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 3: Exportação CSV

**Objetivo:** Validar exportação de leads

**Passos:**
1. Acesse a página de Leads
2. Adicione alguns filtros (opcional)
3. Clique em "Exportar"
4. Abra o arquivo CSV baixado

**Resultado Esperado:**
- Arquivo CSV baixado com nome `leads_YYYY-MM-DD.csv`
- Colunas: Nome, Email, Telefone, CPF, Empresa, Origem, Status, Valor, Tags, Observações, Data
- Dados corretos e completos
- Caracteres especiais escapados corretamente
- Tags separadas por ponto-e-vírgula

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 4: Busca Avançada

**Objetivo:** Validar todos os tipos de busca

#### 4.1 Busca por Nome
**Input:** Digite parte de um nome
**Esperado:** Mostra apenas leads com esse nome

#### 4.2 Busca por Email
**Input:** Digite parte de um email
**Esperado:** Mostra apenas leads com esse email

#### 4.3 Busca por Telefone
**Input:** Digite parte de um telefone
**Esperado:** Mostra apenas leads com esse telefone

#### 4.4 Busca por CPF
**Input:** Digite parte de um CPF
**Esperado:** Mostra apenas leads com esse CPF

#### 4.5 Busca por Valor (Operadores)
**Testes:**
- Input: `>1000` → Esperado: Leads com valor > R$ 1.000,00
- Input: `<500` → Esperado: Leads com valor < R$ 500,00
- Input: `=1500` → Esperado: Leads com valor exatamente R$ 1.500,00

#### 4.6 Busca por Data
**Input:** Digite uma data (DD/MM/YYYY)
**Esperado:** Mostra apenas leads criados nessa data

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 5: Scroll Infinito / Paginação

**Objetivo:** Validar carregamento progressivo

**Pré-requisito:** Ter mais de 50 leads cadastrados

**Passos:**
1. Acesse a página de Leads
2. Role até o final da lista
3. Observe o indicador de carregamento
4. Verifique se mais leads são carregados

**Resultado Esperado:**
- Carrega 50 leads inicialmente
- Ao chegar ao final, mostra "Carregando leads..." com spinner
- Carrega mais 50 leads automaticamente
- Ao atingir 1000 leads, mostra mensagem de limite
- Performance suave sem travamentos

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 6: Sincronização Realtime

**Objetivo:** Validar sincronização entre abas

**Passos:**
1. Abra a página de Leads em duas abas/janelas diferentes
2. Na Aba 1: Crie um novo lead
3. Na Aba 2: Observe se o lead aparece automaticamente
4. Na Aba 2: Edite o lead
5. Na Aba 1: Observe se a edição aparece
6. Observe o indicador de sincronização no topo

**Resultado Esperado:**
- Indicador mostra "🟢 Sincronizado" quando ocioso
- Indicador muda para "🔵 Sincronizando..." durante mudanças
- Lead criado na Aba 1 aparece instantaneamente na Aba 2
- Edições aparecem em ambas as abas
- Toast de notificação em cada mudança

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 7: Filtros

**Objetivo:** Validar filtros de status e tags

#### 7.1 Filtro por Status
**Passos:**
1. Clique em "Novos"
**Esperado:** Mostra apenas leads com status "novo"

2. Clique em "Qualificados"
**Esperado:** Mostra apenas leads com status "qualificado"

3. Clique em "Todos"
**Esperado:** Mostra todos os leads

#### 7.2 Filtro por Tag
**Passos:**
1. Clique no botão de tags
2. Selecione uma tag
**Esperado:** Mostra apenas leads com essa tag
**Visual:** Banner azul mostrando tag ativa

3. Clique em "Limpar filtro"
**Esperado:** Remove filtro e mostra todos os leads

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 8: Ações Rápidas

**Objetivo:** Validar ações em cada lead

**Passos:**
1. Clique no ícone de ações (⋮) em um lead
2. Teste cada ação:
   - **Ver Conversas:** Deve navegar para página de conversas
   - **Ligar no WhatsApp:** Deve abrir WhatsApp Web (se telefone válido)
   - **Criar Agendamento:** Deve navegar para agenda
   - **Criar Tarefa:** Deve navegar para tarefas

**Resultado Esperado:**
- Cada ação mostra toast de feedback
- Navegação funciona corretamente
- Botões desabilitados quando não aplicável (ex: WhatsApp sem telefone)

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 9: Criação de Compromisso/Tarefa

**Objetivo:** Validar criação de compromisso e tarefa vinculada ao lead

#### 9.1 Compromisso
**Passos:**
1. Clique no ícone de ações de um lead
2. Clique na aba "Compromisso"
3. Preencha: Tipo de Serviço, Data/Hora Início, Data/Hora Fim
4. Clique em "Criar Compromisso"

**Resultado Esperado:**
- ✅ Toast: "Compromisso criado com sucesso!"
- Compromisso aparece na agenda vinculado ao lead

#### 9.2 Tarefa
**Passos:**
1. Clique no ícone de ações de um lead
2. Clique na aba "Tarefa"
3. Preencha: Título, Prioridade, Data de Vencimento
4. Clique em "Criar Tarefa"

**Resultado Esperado:**
- ✅ Toast: "Tarefa criada com sucesso!"
- Tarefa aparece no quadro vinculada ao lead

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

### ✅ TESTE 10: Loading States e Feedback Visual

**Objetivo:** Validar feedback visual em todas as operações

**Verificações:**

#### 10.1 Criar Lead
- Loading: Botão desabilitado, texto "Criando..."
- Sucesso: ✅ Toast verde "Lead criado com sucesso!"
- Erro: ❌ Toast vermelho com mensagem específica

#### 10.2 Importar Leads
- Loading: Botão desabilitado, texto "Importando..."
- Preview: Mostra primeiras 5 linhas
- Sucesso: Relatório visual com estatísticas
- Erro: Lista de erros por linha

#### 10.3 Exportar Leads
- Loading: Botão desabilitado durante exportação
- Sucesso: Toast + download automático do arquivo
- Erro: Toast vermelho se nenhum lead para exportar

#### 10.4 Scroll Infinito
- Loading: Spinner animado + "Carregando leads..."
- Fim: "Todos os X leads foram carregados"
- Limite: "1000 leads carregados (limite atingido)"

#### 10.5 Sincronização Realtime
- 🟢 Verde pulsante: "Sincronizado"
- 🔵 Azul girando: "Sincronizando..."
- 🔴 Vermelho: "Desconectado" (se houver erro)

**Status:** ⬜ Não testado | ✅ Passou | ❌ Falhou

---

## 📊 RESUMO DOS TESTES

| # | Teste | Status | Observações |
|---|-------|--------|-------------|
| 1 | Validação Company ID | ⬜ | |
| 2 | Importação com Validação | ⬜ | |
| 3 | Exportação CSV | ⬜ | |
| 4 | Busca Avançada | ⬜ | |
| 5 | Scroll Infinito | ⬜ | |
| 6 | Sincronização Realtime | ⬜ | |
| 7 | Filtros | ⬜ | |
| 8 | Ações Rápidas | ⬜ | |
| 9 | Compromisso/Tarefa | ⬜ | |
| 10 | Loading States | ⬜ | |

---

## 🐛 REPORT DE BUGS

**Se encontrar algum bug, documente aqui:**

### Bug Template:
```
## BUG #X: [Título do Bug]

**Severidade:** 🔴 Crítico | 🟡 Médio | 🟢 Baixo

**Descrição:**
[Descreva o problema]

**Passos para Reproduzir:**
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

**Resultado Esperado:**
[O que deveria acontecer]

**Resultado Atual:**
[O que está acontecendo]

**Screenshots/Logs:**
[Se aplicável]
```

---

## ✅ APROVAÇÃO FINAL

**Testador:** _________________
**Data:** ____/____/____
**Resultado:** ⬜ Aprovado | ⬜ Reprovado

**Observações:**
_________________________________
_________________________________
_________________________________

---

**Todos os testes passaram?** → ✅ MENU LEADS PRONTO PARA PRODUÇÃO! 🚀



