# Sincronização em Tempo Real - Conversas ↔ Leads ↔ Funil

## 📡 Visão Geral

Sistema de sincronização bidirecional entre os módulos **Conversas**, **Leads** e **Funil de Vendas** usando Supabase Realtime.

Todas as alterações feitas em qualquer módulo são propagadas instantaneamente para os outros módulos conectados.

---

## 🔧 Arquitetura

### Hook Global: `useLeadsSync`
**Arquivo:** `src/hooks/useLeadsSync.ts`

Gerencia a sincronização observando mudanças na tabela `leads` via Supabase Realtime:
- **INSERT**: Quando um novo lead é criado
- **UPDATE**: Quando dados do lead são modificados  
- **DELETE**: Quando um lead é removido

```typescript
useLeadsSync({
  onInsert: (newLead) => { /* handle */ },
  onUpdate: (updatedLead, oldLead) => { /* handle */ },
  onDelete: (deletedLead) => { /* handle */ },
  showNotifications: true // Mostrar toasts de sincronização
});
```

---

## 📋 Módulos Integrados

### 1️⃣ Conversas (`src/pages/Conversas.tsx`)

**Funcionalidades Sincronizadas:**
- ✅ Editar Tags do Lead (Info Panel)
- ✅ Atribuir Responsável
- ✅ Adicionar ao Funil / Mudar Estágio
- ✅ Editar Informações (Produto, Valor, Anotações)
- ✅ **Criar Lead Automaticamente** a partir da conversa
- ✅ **Indicador de Vinculação** mostra se conversa tem lead associado

**Como Funciona:**
1. Usuário edita informações no **Info Panel** (painel lateral)
2. Sistema busca/cria lead correspondente no Supabase via `findOrCreateLead()`
3. Atualiza dados na tabela `leads` com `.update()` ou `.insert()`
4. **Realtime propaga** mudanças para Leads e Funil

**Criação Automática de Leads:**
- Ao editar qualquer informação (tags, funil, etc.), se o lead não existir, ele é criado automaticamente
- Campos preenchidos automaticamente: `name`, `phone`, `company_id`, `owner_id`, `source`, `status`, `stage`
- Toast de confirmação: "Lead '[nome]' criado automaticamente!"
- Badge verde "✅ Lead vinculado no CRM" aparece no Info Panel

**Criação Manual de Leads:**
- Badge amarelo "⚠️ Lead não cadastrado" quando não há vinculação
- Botão "Criar Lead no CRM" permite criação explícita
- Útil para converter conversas em leads antes de editar informações

**Mapeamento:**
- `conversas.phoneNumber` → `leads.phone` ou `leads.telefone`
- `conversas.tags` → `leads.tags`
- `conversas.funnelStage` → `leads.stage`
- `conversas.produto` → `leads.servico`
- `conversas.valor` → `leads.value`
- `conversas.anotacoes` → `leads.notes`
- `conversas.channel` → `leads.source` (ex: "Conversa whatsapp")

---

### 2️⃣ Leads (`src/pages/Leads.tsx`)

**Funcionalidades Sincronizadas:**
- ✅ Recebe atualizações quando lead é editado em Conversas
- ✅ Recebe atualizações quando lead é movido no Funil
- ✅ Notifica quando novo lead é criado
- ✅ Remove lead da lista quando deletado
- ✅ **Sincronização Bidirecional Completa**

**Como Funciona:**
1. Hook `useLeadsSync` escuta mudanças na tabela `leads`
2. Quando evento ocorre, atualiza `state` local com `setLeads()`
3. Interface reflete mudanças instantaneamente
4. **Todas as edições em Leads propagam para Conversas e Funil**

**Callbacks:**
```typescript
onInsert: adiciona novo lead no topo da lista
onUpdate: substitui lead existente com dados atualizados
onDelete: remove lead da lista
```

**Sincronização Reversa:**
- Quando lead é editado em **Conversas** → atualiza lista em **Leads**
- Quando lead é movido no **Funil** → atualiza lista em **Leads**
- Quando lead é editado em **Leads** → propaga para **Conversas** e **Funil**

---

### 3️⃣ Funil de Vendas (`src/pages/Kanban.tsx`)

**Funcionalidades Sincronizadas:**
- ✅ Mover lead entre etapas (Drag & Drop)
- ✅ Recebe atualizações de tags/dados editados em Conversas
- ✅ Recebe atualizações de leads criados/editados
- ✅ Atualiza etapa quando alterada em Conversas

**Como Funciona:**
1. Usuário arrasta card de lead para nova coluna
2. Sistema atualiza `etapa_id`, `funil_id` e `stage` no Supabase
3. **Realtime propaga** para Conversas e Leads
4. Todos os módulos refletem a nova posição do lead

**Atualização no Drag:**
```typescript
.update({ 
  etapa_id: novaEtapaId,
  funil_id: etapaDestino.funil_id,
  stage: etapaDestino.nome.toLowerCase()
})
```

---

## 🔄 Fluxo de Sincronização (Bidirecional)

```mermaid
graph TB
    A[Conversas: Edita Tag] -->|Supabase .update| B[Tabela leads]
    B -->|Realtime Event| C[useLeadsSync Hook]
    C -->|onUpdate| D[Leads: Atualiza Lista]
    C -->|onUpdate| E[Funil: Atualiza Card]
    
    F[Funil: Move Etapa] -->|Supabase .update| B
    B -->|Realtime Event| C
    C -->|onUpdate| G[Conversas: Atualiza Info Panel]
    C -->|onUpdate| D
    
    H[Leads: Edita Dados] -->|Supabase .update| B
    B -->|Realtime Event| C
    C -->|onUpdate| E
    C -->|onUpdate| G
    
    I[Qualquer Módulo] -->|Supabase .update/.insert/.delete| B
    B -->|Realtime Event| C
    C -->|onInsert/onUpdate/onDelete| J[Todos os Módulos]
```

**Fluxo Bidirecional Completo:**
1. **Qualquer módulo** pode modificar leads (INSERT, UPDATE, DELETE)
2. **Supabase Realtime** emite evento para todos os subscribers
3. **useLeadsSync** captura o evento e chama callbacks apropriados
4. **Todos os módulos conectados** atualizam automaticamente suas interfaces

---

## 🎯 Benefícios

✅ **Consistência de Dados**: Todos os módulos sempre mostram informações atualizadas  
✅ **Experiência em Tempo Real**: Mudanças visíveis instantaneamente  
✅ **Sem Duplicação**: Hook centralizado evita código repetido  
✅ **Escalável**: Fácil adicionar novos módulos à sincronização  
✅ **Robusto**: Tratamento de erros e rollback em falhas  
✅ **Feedback Visual**: Indicadores mostram status da sincronização em tempo real

---

## 🎨 Feedback Visual de Sincronização

O sistema exibe badges de status no cabeçalho da conversa:

### Estados Visuais

**🔄 Sincronizando...**
- Badge azul pulsante
- Ícone de refresh girando
- Aparece durante operações de atualização
- Duração: até a conclusão da operação

**✅ Sincronizado**
- Badge verde
- Ícone de check
- Confirma sucesso da operação
- Desaparece após 2 segundos

**⚠️ Erro na sincronização**
- Badge vermelho
- Ícone de alerta
- Indica falha na operação
- Desaparece após 3 segundos
- Toast de erro complementa o feedback

**Estado Idle**
- Sem badge visível
- Estado padrão quando não há sincronização em andamento

### Implementação

**ConversationHeader.tsx:**
- Aceita prop `syncStatus` com 4 estados: 'idle' | 'syncing' | 'synced' | 'error'
- Renderiza badge apropriado ao lado do nome do contato
- Animações CSS para feedback visual rico

**Conversas.tsx:**
- Estado `syncStatus` controla o feedback
- Atualizado em cada operação (tags, funil, responsável, informações)
- Timers automáticos para limpar o estado após conclusão

---

## 🔐 Segurança

- **RLS (Row Level Security)** garante que cada usuário só vê leads da sua empresa
- **company_id** validado em todas as operações
- **Autenticação** obrigatória via Supabase Auth

---

## 🧪 Testando a Sincronização

### Teste 1: Conversas → Leads
1. Abra uma conversa no menu **Conversas**
2. Clique em "Adicionar Tag" no Info Panel
3. Digite uma tag e salve
4. Navegue para **Leads**
5. ✅ Verifique se a tag aparece no card do lead

### Teste 2: Funil → Conversas
1. Abra o **Funil de Vendas**
2. Arraste um lead para outra etapa
3. Navegue para **Conversas** e abra a conversa desse lead
4. ✅ Verifique se o "Estágio do Funil" está atualizado

### Teste 3: Conversas → Funil
1. Abra uma conversa no menu **Conversas**
2. Clique em "Editar Informações" no Info Panel
3. Altere o Valor da Negociação
4. **Observe o badge "Sincronizando..." aparecer no header**
5. Aguarde o badge mudar para "✅ Sincronizado"
6. Navegue para **Funil de Vendas**
7. ✅ Verifique se o valor no card foi atualizado

### Teste 7: Leads → Conversas (Bidirecional)
1. Abra a página **Leads**
2. Edite um lead (adicione uma tag ou altere informações)
3. Navegue para **Conversas**
4. Abra a conversa correspondente ao lead editado
5. ✅ Verifique se as informações foram atualizadas no Info Panel
6. **Observe** que a atualização ocorreu automaticamente, sem recarregar

### Teste 8: Leads → Funil (Bidirecional)
1. Abra a página **Leads**
2. Edite o valor de um lead
3. Navegue para **Funil de Vendas**
4. ✅ Verifique se o valor no card foi atualizado automaticamente

### Teste 9: Funil → Leads (Bidirecional)
1. Abra o **Funil de Vendas**
2. Arraste um lead para outra etapa
3. Navegue para **Leads**
4. ✅ Verifique se o status/estágio do lead foi atualizado automaticamente

### Teste 4: Criação Automática de Lead
1. Abra uma **Conversa** sem lead vinculado
2. **Observe** o badge "⚠️ Lead não cadastrado" no Info Panel
3. Adicione uma tag à conversa
4. **Observe** o badge mudar para "✅ Lead vinculado no CRM"
5. Toast de confirmação aparece
6. Navegue para **Leads**
7. ✅ Verifique se o novo lead apareceu automaticamente
8. Navegue para **Funil de Vendas**
9. ✅ Verifique se o lead está visível no funil

### Teste 5: Criação Manual de Lead
1. Abra uma **Conversa** sem lead vinculado
2. Clique no botão "Criar Lead no CRM" no Info Panel
3. **Observe** o badge de sincronização aparecer
4. Aguarde confirmação de sucesso
5. Navegue para **Leads** e **Funil**
6. ✅ Verifique se o lead apareceu em ambos os módulos

### Teste 6: Feedback Visual de Erro
1. Desconecte da internet
2. Tente adicionar uma tag em **Conversas**
3. **Observe o badge "⚠️ Erro na sincronização" aparecer**
4. Reconecte e tente novamente
5. ✅ Verifique se o badge muda para "✅ Sincronizado"

---

## 📚 Logs de Debug

Para acompanhar a sincronização, monitore o console:

```javascript
// Conversas
📡 [Conversas] Lead atualizado via sync: {...}
🔄 Sincronizando tags...
✅ Tag adicionada no Supabase
🎯 Status: synced

// Leads  
📡 [Leads] Novo lead adicionado via sync: {...}
📡 [Leads] Lead atualizado via sync: {...}

// Funil
📡 [Funil] Lead atualizado via sync: {...}
🔄 Sincronização automática vai propagar para Conversas e Leads
```

### Estados de Sincronização

```typescript
// Estados possíveis
'idle'    → Sem operações em andamento
'syncing' → Salvando no Supabase
'synced'  → Salvo com sucesso
'error'   → Erro na operação
```

---

## 🚀 Próximos Passos

- [x] Hook global de sincronização (`useLeadsSync`)
- [x] Sincronização Conversas ↔ Leads  
- [x] Sincronização Conversas ↔ Funil
- [x] Sincronização Leads ↔ Conversas (bidirecional)
- [x] Sincronização Leads ↔ Funil (bidirecional)
- [x] Sincronização Funil ↔ Leads (bidirecional)
- [x] Feedback visual de sincronização
- [x] Criação automática de leads a partir de conversas
- [ ] Sincronizar anotações internas entre módulos
- [ ] Implementar histórico de mudanças do lead
- [ ] Adicionar websocket para notificações push
- [ ] Criar dashboard de sincronização em tempo real
- [ ] Sincronizar status de atendimento (Aguardando, Respondido, Resolvido)

---

## 💡 Observações Importantes

⚠️ **Não interferir no envio/recebimento de mensagens via Evolution API**  
✅ **Todas as funções existentes permanecem intactas**  
✅ **Sincronização é adicional, não substitui funcionalidades**  
✅ **Performance otimizada com debounce e cache local**
