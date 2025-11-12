# 📝 Exemplo Prático: Adicionar Botão de Assinatura

## 🎯 Cenário

Você quer adicionar um botão de assinatura nas conversas que marca o nome do usuário. Quando você implementar isso e clicar em "Aplicar Atualizações", **apenas essa nova funcionalidade** aparecerá nas subcontas, **sem modificar nada** que já existe.

## ✅ Passo a Passo

### 1. Implementar na Conta Matriz (Frontend)

Adicione o botão no componente de conversas:

```typescript
// src/pages/Conversas.tsx ou componente similar
<Button onClick={handleAssinar}>
  Assinar como {userName}
</Button>
```

**Nota:** O código frontend já funciona automaticamente para todas as contas (matriz e subcontas), pois é o mesmo código React servido para todos.

### 2. Se Precisar de Configuração no Banco

Se o botão precisar de configuração no banco de dados (ex: habilitar/desabilitar por empresa), adicione na Edge Function:

#### Passo 2.1: Adicionar na Configuração

Edite: `supabase/functions/aplicar-atualizacoes-subcontas/index.ts`

Adicione em `AVAILABLE_UPDATES`:

```typescript
{
  id: 'create-signature-button',
  version: '1.1.0', // Nova versão
  description: 'Adiciona botão de assinatura nas conversas',
  appliesTo: 'all',
  safe: true // true = não altera dados existentes
}
```

Atualize a versão:

```typescript
const CURRENT_SYSTEM_VERSION = '1.1.0';
```

#### Passo 2.2: Implementar a Lógica

Adicione no loop de atualizações (após a última atualização):

```typescript
// ============================================
// ATUALIZAÇÃO: create-signature-button
// ============================================
// ⚠️ SEGURANÇA: Apenas cria configuração se não existir
// NUNCA altera configurações existentes
// Cada subconta recebe sua própria configuração isolada
else if (update.id === 'create-signature-button') {
  // Verificar se já existe configuração de assinatura para ESTA subconta específica
  const { data: configExistente } = await supabaseAdmin
    .from('conversation_settings') // ou a tabela que você usar
    .select('id')
    .eq('company_id', subconta.id) // ← FILTRO OBRIGATÓRIO: apenas esta subconta
    .eq('feature', 'signature_button')
    .limit(1);

  // SÓ CRIA SE NÃO EXISTIR para ESTA subconta
  // NUNCA altera configurações existentes
  if (!configExistente || configExistente.length === 0) {
    await supabaseAdmin
      .from('conversation_settings')
      .insert({
        company_id: subconta.id, // ← SEMPRE associa à subconta específica
        feature: 'signature_button',
        enabled: true,
        created_at: new Date().toISOString()
      });
    
    appliedUpdateIds.push(update.id);
    console.log(`✅ [APLICAR-ATUALIZACOES] Botão de assinatura criado para ${subconta.name}`);
  } else {
    console.log(`⏭️ [APLICAR-ATUALIZACOES] ${subconta.name} já tem botão de assinatura, pulando...`);
  }
}
```

### 3. Executar Atualização

1. Acesse: **Configurações > Subcontas**
2. Clique: **"Aplicar Atualizações"**
3. Confirme: No dialog
4. Acompanhe: Progresso em tempo real

### 4. Resultado

✅ **Apenas a nova funcionalidade** (botão de assinatura) será adicionada  
✅ **Nenhum dado existente** será modificado  
✅ **Cada subconta** receberá sua própria configuração isolada  
✅ **Nenhuma mesclagem** de dados entre contas  

## 🔒 Garantias de Segurança

### ✅ Isolamento Total

```typescript
// ✅ CORRETO: Sempre filtra pela subconta específica
.eq('company_id', subconta.id) // ← FILTRO OBRIGATÓRIO
```

### ✅ Apenas Cria, Nunca Altera

```typescript
// ✅ CORRETO: Verifica se existe ANTES de criar
if (!configExistente || configExistente.length === 0) {
  // Criar novo...
}
// Se já existe, PULA (não altera)
```

### ✅ Processamento Individual

```typescript
// ✅ CORRETO: Cada subconta processada separadamente
for (const subconta of subcontas) {
  // Dados criados aqui são APENAS para esta subconta
  // NUNCA afeta outras subcontas
}
```

## 📊 O Que Acontece em Cada Subconta

### Subconta A

```
Antes:
- Tem funis, tarefas, conversas (seus próprios dados)
- NÃO tem botão de assinatura

Depois:
- Tem funis, tarefas, conversas (inalterados)
- ✅ Agora tem botão de assinatura (novo dado criado)
```

### Subconta B

```
Antes:
- Tem funis, tarefas, conversas (seus próprios dados)
- NÃO tem botão de assinatura

Depois:
- Tem funis, tarefas, conversas (inalterados)
- ✅ Agora tem botão de assinatura (novo dado criado)
```

### Subconta C (já tinha botão)

```
Antes:
- Tem funis, tarefas, conversas (seus próprios dados)
- JÁ tem botão de assinatura

Depois:
- Tem funis, tarefas, conversas (inalterados)
- Botão de assinatura (inalterado - não foi modificado)
```

## ❌ O Que NUNCA Acontece

### ❌ Mesclagem de Dados

```typescript
// ❌ ERRADO: Isso NUNCA acontece
// Não há código que faça isso:
await supabaseAdmin
  .from('conversas')
  .update({ company_id: contaCentral.id }) // ← NUNCA
  .eq('company_id', subconta.id);
```

### ❌ Alteração de Dados Existentes

```typescript
// ❌ ERRADO: Isso NUNCA acontece
// Não há código que faça isso:
await supabaseAdmin
  .from('conversation_settings')
  .update({ enabled: false }) // ← NUNCA
  .eq('company_id', subconta.id);
```

## 🎯 Resposta à Sua Pergunta

> "Quando eu for adicionar essa funcionalidade, quando clicar atualizar também nas subcontas. somente essa nova funcionalidade vai aparecer nas subcontas ne isso? sem modificação de nada nas subcontas"

### ✅ SIM! Exatamente isso!

1. **Apenas o botão de assinatura** será adicionado
2. **Nenhum dado existente** será modificado
3. **Cada subconta** receberá sua própria configuração isolada
4. **Nenhuma mesclagem** de dados acontecerá

## 🔍 Como Verificar

### Via SQL

```sql
-- Verificar que cada subconta tem sua própria configuração isolada
SELECT 
  company_id,
  feature,
  enabled,
  created_at
FROM conversation_settings
WHERE feature = 'signature_button'
ORDER BY company_id;

-- Cada company_id deve ter sua própria entrada isolada
-- Nenhuma entrada deve ser compartilhada entre contas
```

### Via Interface

Após aplicar atualizações:
1. Acesse cada subconta
2. Verifique que o botão de assinatura aparece
3. Verifique que todos os outros dados estão intactos
4. Confirme que não há mesclagem de dados

---

**Status:** ✅ **100% Seguro - Apenas Adiciona, Nunca Altera**

