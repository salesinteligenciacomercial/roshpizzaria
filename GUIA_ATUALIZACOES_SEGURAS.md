# 🔒 Guia: Sistema de Atualizações Seguras para Subcontas

## 🎯 Princípios de Segurança

Este sistema foi projetado com **máxima segurança** para garantir que:

✅ **NUNCA altera dados existentes**  
✅ **Apenas adiciona dados novos**  
✅ **Rastreia versões aplicadas**  
✅ **Aplica apenas atualizações pendentes**  
✅ **Preserva todas as configurações existentes**  

## 📋 Como Funciona

### 1. **Sistema de Versionamento**

Cada atualização tem:
- **ID único**: Identificador da atualização
- **Versão**: Versão do sistema (ex: "1.0.0", "1.1.0")
- **Descrição**: O que a atualização faz
- **Safe**: Garantia de que não altera dados existentes

### 2. **Rastreamento de Aplicações**

O sistema armazena em `companies.settings.applied_updates`:
```json
{
  "applied_updates": ["1.0.0", "1.0.1"],
  "last_update_applied": "2024-11-04T10:30:00Z",
  "system_version": "1.0.1"
}
```

### 3. **Aplicação Seletiva**

O sistema:
1. Verifica quais atualizações já foram aplicadas
2. Aplica apenas as pendentes
3. Pula subcontas que já estão atualizadas
4. Registra novas versões aplicadas

## 🔒 Garantias de Segurança

### ✅ Apenas Cria Dados Novos

Todas as atualizações verificam se dados já existem antes de criar:

```typescript
// Exemplo: Funil padrão
const { data: funisExistentes } = await supabaseAdmin
  .from('funis')
  .select('id')
  .eq('company_id', subconta.id)
  .limit(1);

// SÓ CRIA SE NÃO EXISTIR
if (!funisExistentes || funisExistentes.length === 0) {
  // Criar funil...
}
```

### ✅ Não Sobrescreve Configurações

As configurações são mescladas (merge), não sobrescritas:

```typescript
const updatedSettings = {
  ...currentSettings, // PRESERVA tudo que já existe
  applied_updates: newVersions, // Adiciona apenas novas versões
  last_update_applied: new Date().toISOString()
};
```

### ✅ Apenas Corrige Dados Inválidos

Correções apenas preenchem campos NULL, nunca alteram valores existentes:

```typescript
// Apenas corrige conversas com company_id NULL
await supabaseAdmin
  .from('conversas')
  .update({ company_id: subconta.id })
  .is('company_id', null) // APENAS NULL
  .eq('owner_id', adminUser.user_id);
```

## 📝 Adicionar Nova Atualização

Quando você implementar uma nova melhoria:

### Passo 1: Adicionar na Configuração

Edite: `supabase/functions/aplicar-atualizacoes-subcontas/index.ts`

Adicione em `AVAILABLE_UPDATES`:

```typescript
{
  id: 'sua-nova-atualizacao',
  version: '1.1.0', // Nova versão
  description: 'Descrição do que faz',
  appliesTo: 'all', // ou 'new_only'
  safe: true // true = não altera dados existentes
}
```

### Passo 2: Implementar a Lógica

Adicione no loop de atualizações:

```typescript
// ============================================
// ATUALIZAÇÃO: sua-nova-atualizacao
// ============================================
else if (update.id === 'sua-nova-atualizacao') {
  // Verificar se já existe
  const { data: existente } = await supabaseAdmin
    .from('sua_tabela')
    .select('id')
    .eq('company_id', subconta.id)
    .limit(1);

  // SÓ CRIA SE NÃO EXISTIR
  if (!existente || existente.length === 0) {
    await supabaseAdmin
      .from('sua_tabela')
      .insert({
        company_id: subconta.id,
        // ... seus campos
      });
    appliedUpdateIds.push(update.id);
  }
}
```

### Passo 3: Atualizar Versão

Atualize `CURRENT_SYSTEM_VERSION`:

```typescript
const CURRENT_SYSTEM_VERSION = '1.1.0'; // Nova versão
```

## 🎯 Exemplos de Atualizações Seguras

### ✅ Exemplo 1: Criar Funil Padrão

```typescript
// SEGURO: Apenas cria se não existir
const { data: funisExistentes } = await supabaseAdmin
  .from('funis')
  .select('id')
  .eq('company_id', subconta.id)
  .limit(1);

if (!funisExistentes || funisExistentes.length === 0) {
  // Criar funil...
}
```

### ✅ Exemplo 2: Adicionar Nova Coluna de Tarefa

```typescript
// SEGURO: Apenas adiciona se não existir
const { data: colunaExistente } = await supabaseAdmin
  .from('task_columns')
  .select('id')
  .eq('board_id', boardId)
  .eq('nome', 'Nova Coluna')
  .limit(1);

if (!colunaExistente || colunaExistente.length === 0) {
  // Adicionar coluna...
}
```

### ✅ Exemplo 3: Corrigir Dados Inválidos

```typescript
// SEGURO: Apenas corrige NULL, não altera existentes
await supabaseAdmin
  .from('conversas')
  .update({ company_id: subconta.id })
  .is('company_id', null) // APENAS NULL
  .eq('owner_id', adminUser.user_id);
```

## ❌ O Que NUNCA Fazer

### ❌ NÃO Alterar Dados Existente

```typescript
// ❌ ERRADO: Altera dados existentes
await supabaseAdmin
  .from('funis')
  .update({ nome: 'Novo Nome' }) // NÃO FAZER ISSO
  .eq('company_id', subconta.id);
```

### ❌ NÃO Sobrescrever Configurações

```typescript
// ❌ ERRADO: Sobrescreve configurações
const updatedSettings = {
  applied_updates: newVersions // PERDE outras configurações
};
```

### ❌ NÃO Deletar Dados

```typescript
// ❌ ERRADO: Deleta dados
await supabaseAdmin
  .from('funis')
  .delete() // NUNCA FAZER ISSO
  .eq('company_id', subconta.id);
```

## 🔍 Verificar Status de Atualizações

### Via SQL

```sql
SELECT 
  id,
  name,
  settings->>'applied_updates' as updates_aplicadas,
  settings->>'last_update_applied' as ultima_atualizacao,
  settings->>'system_version' as versao_sistema
FROM companies
WHERE parent_company_id = 'seu-id';
```

### Via Interface

O botão "Aplicar Atualizações" mostra:
- Quantas subcontas foram atualizadas
- Quantas já estavam atualizadas
- Quais atualizações foram aplicadas em cada subconta

## 📊 Fluxo de Execução

```
1. Usuário clica em "Aplicar Atualizações"
   ↓
2. Sistema busca subcontas ativas
   ↓
3. Para cada subconta:
   - Verifica versões já aplicadas
   - Filtra atualizações pendentes
   - Se não há pendentes → PULA
   - Se há pendentes → APLICA
   ↓
4. Para cada atualização pendente:
   - Verifica se dados já existem
   - Se existem → PULA
   - Se não existem → CRIA
   ↓
5. Atualiza settings (MERGE, não sobrescreve)
   ↓
6. Retorna relatório detalhado
```

## ✅ Checklist de Segurança

Antes de adicionar uma nova atualização, verifique:

- [ ] Verifica se dados já existem antes de criar?
- [ ] Não altera dados existentes?
- [ ] Não deleta dados?
- [ ] Não sobrescreve configurações?
- [ ] Apenas corrige dados inválidos (NULL)?
- [ ] Tem `safe: true` na configuração?
- [ ] Testado em ambiente de desenvolvimento?

## 🎉 Benefícios

✅ **Segurança Total**: Dados existentes nunca são alterados  
✅ **Idempotente**: Pode executar múltiplas vezes sem problemas  
✅ **Rastreável**: Sabe exatamente o que foi aplicado  
✅ **Eficiente**: Pula subcontas já atualizadas  
✅ **Flexível**: Fácil adicionar novas atualizações  

---

**Versão:** 1.0.1  
**Status:** ✅ Implementado e Seguro

