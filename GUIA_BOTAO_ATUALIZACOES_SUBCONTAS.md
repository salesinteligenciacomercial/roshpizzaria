# 🔄 Guia: Botão de Atualizações para Subcontas

## 📋 Visão Geral

Foi implementado um sistema completo para aplicar melhorias e atualizações da conta matriz para todas as subcontas de forma centralizada e automatizada.

## ✨ Funcionalidades Implementadas

### 1. **Botão "Aplicar Atualizações"**
- Localização: Menu **Configurações > Gerenciar Subcontas**
- Visível apenas para Super Admin da conta matriz
- Aplica automaticamente todas as melhorias para subcontas ativas

### 2. **Edge Function: `aplicar-atualizacoes-subcontas`**
- Função serverless que processa as atualizações
- Valida permissões (apenas Super Admin)
- Processa todas as subcontas em lote
- Retorna relatório detalhado de sucessos e erros

### 3. **Interface Visual com Progresso**
- Dialog de confirmação antes de aplicar
- Barra de progresso em tempo real
- Lista detalhada de cada subconta atualizada
- Exibição de erros específicos

## 🎯 O Que É Aplicado Automaticamente

Quando você clica em "Aplicar Atualizações", o sistema aplica:

### ✅ 1. Funis de Vendas Padrão
- Cria funil "Funil de Vendas" se não existir
- Adiciona 5 etapas padrão:
  - Prospecção
  - Qualificação
  - Proposta
  - Negociação
  - Fechamento

### ✅ 2. Quadros de Tarefas Padrão
- Cria quadro "Quadro Principal" se não existir
- Adiciona 3 colunas padrão:
  - A Fazer
  - Em Progresso
  - Concluído

### ✅ 3. Conexões WhatsApp
- Cria registro de conexão WhatsApp se não existir
- Permite que subcontas configurem WhatsApp posteriormente

### ✅ 4. Correções de Dados
- Corrige conversas sem `company_id`
- Garante integridade dos dados

### ✅ 5. Configurações Padrão
- Atualiza `settings` da empresa com:
  - `last_update_applied`: Data/hora da última atualização
  - `version`: Versão das atualizações aplicadas

## 🚀 Como Usar

### Passo 1: Acessar o Menu
1. Faça login como **Super Admin** da conta matriz
2. Vá em **Configurações**
3. Clique na aba **Subcontas**

### Passo 2: Aplicar Atualizações
1. Clique no botão **"Aplicar Atualizações"** (ícone de refresh)
2. Revise o dialog de confirmação
3. Clique em **"Aplicar Atualizações"** para confirmar

### Passo 3: Acompanhar Progresso
- O sistema mostra:
  - Total de subcontas a atualizar
  - Progresso em tempo real
  - Status de cada subconta (sucesso/erro)
  - Lista de erros, se houver

### Passo 4: Verificar Resultados
- Após concluir, você verá:
  - Quantas subcontas foram atualizadas com sucesso
  - Quais tiveram erros (se houver)
  - Detalhes de cada atualização

## 🔧 Personalização: Adicionar Novas Atualizações

Para adicionar novas melhorias que serão aplicadas automaticamente, edite:

**Arquivo:** `supabase/functions/aplicar-atualizacoes-subcontas/index.ts`

### Exemplo: Adicionar Nova Feature

```typescript
// Dentro do loop for (const subconta of subcontas)
// Adicione sua nova atualização:

// ============================================
// 6. SUA NOVA ATUALIZAÇÃO
// ============================================
const { data: featureExistente } = await supabaseAdmin
  .from('sua_tabela')
  .select('id')
  .eq('company_id', subconta.id)
  .limit(1);

if (!featureExistente || featureExistente.length === 0) {
  await supabaseAdmin
    .from('sua_tabela')
    .insert({
      company_id: subconta.id,
      campo1: 'valor1',
      campo2: 'valor2',
      // ... outros campos
    });
  
  console.log(`✅ [APLICAR-ATUALIZACOES] Nova feature criada para ${subconta.name}`);
}
```

### Exemplo: Atualizar Dados Existentes

```typescript
// Atualizar dados existentes em todas as subcontas
await supabaseAdmin
  .from('sua_tabela')
  .update({ 
    novo_campo: 'novo_valor',
    atualizado_em: new Date().toISOString()
  })
  .eq('company_id', subconta.id);
```

## 📊 Estrutura de Resposta

A Edge Function retorna:

```json
{
  "success": true,
  "message": "Atualizações aplicadas em 5 de 5 subcontas",
  "total": 5,
  "updated": 5,
  "errors": [],
  "details": [
    {
      "companyId": "uuid",
      "companyName": "Nome da Subconta",
      "status": "success",
      "message": "Atualizações aplicadas com sucesso"
    }
  ]
}
```

## 🔒 Segurança

- ✅ Apenas **Super Admin** da conta matriz pode executar
- ✅ Validação de permissões antes de processar
- ✅ Isolamento de dados por `company_id`
- ✅ Logs detalhados para auditoria

## ⚠️ Observações Importantes

1. **Não Destrutivo**: O sistema apenas **adiciona** dados que não existem, não remove ou sobrescreve dados existentes
2. **Idempotente**: Pode ser executado múltiplas vezes sem causar duplicações
3. **Seguro**: Erros em uma subconta não afetam as outras
4. **Rastreável**: Cada atualização é registrada em `settings.last_update_applied`

## 🐛 Troubleshooting

### Erro: "Apenas Super Admin pode aplicar atualizações"
- Verifique se você está logado como Super Admin
- Confirme que sua empresa é `is_master_account = true`

### Erro: "Nenhuma subconta encontrada"
- Verifique se existem subcontas ativas
- Confirme que `parent_company_id` está correto

### Algumas subcontas não foram atualizadas
- Verifique os logs no console do navegador
- Veja os detalhes de erro no dialog de progresso
- Verifique se há problemas de permissão RLS

## 📝 Logs e Monitoramento

Todos os logs são salvos no console da Edge Function:
- `🔄 [APLICAR-ATUALIZACOES]` - Início do processamento
- `✅ [APLICAR-ATUALIZACOES]` - Sucesso
- `❌ [APLICAR-ATUALIZACOES]` - Erro
- `⚠️ [APLICAR-ATUALIZACOES]` - Aviso

## 🎉 Benefícios

1. **Automação**: Não precisa mais atualizar manualmente cada subconta
2. **Consistência**: Todas as subcontas recebem as mesmas melhorias
3. **Rastreabilidade**: Sabe exatamente quando cada atualização foi aplicada
4. **Escalabilidade**: Funciona com 1 ou 1000 subcontas
5. **Segurança**: Validações e permissões garantem segurança

## 🔄 Próximos Passos

Para adicionar novas atualizações no futuro:

1. Implemente a feature na conta matriz
2. Adicione o código de aplicação na Edge Function
3. Teste em uma subconta de desenvolvimento
4. Execute o botão "Aplicar Atualizações"
5. Verifique os resultados

---

**Criado em:** 2024-11-04  
**Versão:** 1.0.0  
**Status:** ✅ Implementado e Funcional

