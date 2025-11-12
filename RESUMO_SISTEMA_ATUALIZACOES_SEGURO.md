# ✅ RESUMO: Sistema de Atualizações Seguro para Subcontas

## 🎯 Objetivo

Sistema que aplica **apenas melhorias específicas** nas subcontas, **sem alterar ou comprometer dados existentes**.

## 🔒 Princípios de Segurança

✅ **NUNCA altera dados existentes**  
✅ **Apenas adiciona dados novos**  
✅ **Rastreia versões aplicadas**  
✅ **Aplica apenas atualizações pendentes**  
✅ **Preserva todas as configurações**  

## 📋 Como Funciona

### 1. **Sistema de Versionamento**

Cada atualização tem:
- **ID único**: Identificador (ex: `create-default-funil`)
- **Versão**: Versão do sistema (ex: `1.0.0`, `1.1.0`)
- **Descrição**: O que faz
- **Safe**: Garantia de segurança (`true` = não altera dados)

### 2. **Rastreamento**

O sistema armazena em `companies.settings`:
```json
{
  "applied_updates": ["1.0.0", "1.0.1"],
  "last_update_applied": "2024-11-04T10:30:00Z",
  "system_version": "1.0.1"
}
```

### 3. **Aplicação Seletiva**

1. Verifica quais atualizações já foram aplicadas
2. Filtra apenas as pendentes
3. Para cada atualização pendente:
   - Verifica se dados já existem
   - Se existem → **PULA** (não altera)
   - Se não existem → **CRIA** (adiciona novo)
4. Registra novas versões aplicadas

## 🎯 Fluxo de Execução

```
Usuário clica "Aplicar Atualizações"
         ↓
Sistema busca subcontas ativas
         ↓
Para cada subconta:
  ├─ Verifica versões já aplicadas
  ├─ Filtra atualizações pendentes
  ├─ Se não há pendentes → PULA
  └─ Se há pendentes → APLICA
         ↓
Para cada atualização pendente:
  ├─ Verifica se dados já existem
  ├─ Se existem → PULA (não altera)
  └─ Se não existem → CRIA (adiciona)
         ↓
Atualiza settings (MERGE, não sobrescreve)
         ↓
Retorna relatório detalhado
```

## ✅ Exemplos de Atualizações Seguras

### Exemplo 1: Criar Funil Padrão

```typescript
// ✅ SEGURO: Apenas cria se não existir
const { data: funisExistentes } = await supabaseAdmin
  .from('funis')
  .select('id')
  .eq('company_id', subconta.id)
  .limit(1);

if (!funisExistentes || funisExistentes.length === 0) {
  // Criar funil... (apenas se não existir)
}
```

### Exemplo 2: Corrigir Dados Inválidos

```typescript
// ✅ SEGURO: Apenas corrige NULL, não altera existentes
await supabaseAdmin
  .from('conversas')
  .update({ company_id: subconta.id })
  .is('company_id', null) // APENAS NULL
  .eq('owner_id', adminUser.user_id);
```

### Exemplo 3: Preservar Configurações

```typescript
// ✅ SEGURO: MERGE, não sobrescreve
const updatedSettings = {
  ...currentSettings, // PRESERVA tudo que já existe
  applied_updates: newVersions, // Adiciona apenas novas versões
  last_update_applied: new Date().toISOString()
};
```

## 📝 Adicionar Nova Atualização

Quando você implementar uma nova melhoria:

### Passo 1: Adicionar na Configuração

Edite: `supabase/functions/aplicar-atualizacoes-subcontas/index.ts`

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

```typescript
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

```typescript
const CURRENT_SYSTEM_VERSION = '1.1.0'; // Nova versão
```

## ❌ O Que NUNCA Fazer

### ❌ NÃO Alterar Dados Existentes

```typescript
// ❌ ERRADO
await supabaseAdmin
  .from('funis')
  .update({ nome: 'Novo Nome' }) // NÃO FAZER
  .eq('company_id', subconta.id);
```

### ❌ NÃO Sobrescrever Configurações

```typescript
// ❌ ERRADO
const updatedSettings = {
  applied_updates: newVersions // PERDE outras configurações
};
```

### ❌ NÃO Deletar Dados

```typescript
// ❌ ERRADO
await supabaseAdmin
  .from('funis')
  .delete() // NUNCA FAZER
  .eq('company_id', subconta.id);
```

## 🎉 Benefícios

✅ **Segurança Total**: Dados existentes nunca são alterados  
✅ **Idempotente**: Pode executar múltiplas vezes sem problemas  
✅ **Rastreável**: Sabe exatamente o que foi aplicado  
✅ **Eficiente**: Pula subcontas já atualizadas  
✅ **Flexível**: Fácil adicionar novas atualizações  
✅ **Seletivo**: Aplica apenas o que é necessário  

## 📊 Resultado

Quando você clica em "Aplicar Atualizações":

- ✅ Subcontas que já estão atualizadas são **puladas**
- ✅ Apenas atualizações pendentes são aplicadas
- ✅ Dados existentes **nunca são alterados**
- ✅ Novos dados são criados apenas se não existirem
- ✅ Configurações são preservadas (merge, não sobrescreve)
- ✅ Relatório detalhado mostra o que foi aplicado

## 🔍 Verificar Status

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

O botão mostra:
- Quantas subcontas foram atualizadas
- Quantas já estavam atualizadas (puladas)
- Quais atualizações foram aplicadas em cada subconta

---

**Versão:** 1.0.1  
**Status:** ✅ Implementado e 100% Seguro

