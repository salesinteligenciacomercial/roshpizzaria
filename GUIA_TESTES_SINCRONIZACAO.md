# 🧪 Guia de Testes - Sincronização em Tempo Real

## 📋 Pré-requisitos

Antes de iniciar os testes, certifique-se de:

1. ✅ Estar logado no sistema
2. ✅ Ter acesso aos módulos: Conversas, Leads e Funil de Vendas
3. ✅ Abrir o **DevTools** do navegador (F12)
4. ✅ Manter a aba **Console** visível para acompanhar os logs de sincronização

---

## 🎯 Cenário 1: Criar Lead em Conversas → Aparecer em Leads e Funil

### Objetivo
Verificar se um lead criado a partir de uma conversa aparece automaticamente nos outros módulos.

### Passos

1. **Abra o módulo Conversas**
   - Navegue para `/conversas`
   - Selecione uma conversa existente (ex: João Silva)

2. **Verifique o Status do Lead**
   - Observe o badge no Info Panel (lado direito)
   - Se mostrar "⚠️ Lead não cadastrado", o lead ainda não existe
   - Se mostrar "✅ Lead vinculado no CRM", o lead já existe

3. **Crie o Lead Automaticamente**
   - Adicione uma TAG à conversa:
     - Clique em "Adicionar Tag"
     - Digite uma tag (ex: "teste-sync")
     - Clique em "Adicionar"
   
   **🔍 Observe:**
   - Badge muda para "🔄 Sincronizando..."
   - Console mostra: `🔄 Sincronizando tags...`
   - Console mostra: `✅ Tag adicionada no Supabase`
   - Badge muda para "✅ Sincronizado" (desaparece após 2s)
   - Toast verde: "Lead 'João Silva' criado automaticamente!"
   - Badge final: "✅ Lead vinculado no CRM"

4. **Verifique no Módulo Leads**
   - **SEM RECARREGAR A PÁGINA**, abra uma nova aba ou navegue para `/leads`
   
   **✅ Esperado:**
   - Lead "João Silva" aparece no topo da lista
   - Tag "teste-sync" está visível
   - Console mostra: `📡 [Leads] Novo lead adicionado via sync: {...}`
   - Toast verde: "Novo lead adicionado: João Silva"

5. **Verifique no Funil de Vendas**
   - **SEM RECARREGAR A PÁGINA**, navegue para `/kanban`
   
   **✅ Esperado:**
   - Lead "João Silva" aparece na primeira coluna (Novo)
   - Tag "teste-sync" está visível no card
   - Console mostra: `📡 [Funil] Lead adicionado via sync: {...}`

### ✅ Critérios de Sucesso

- [ ] Lead criado em Conversas
- [ ] Lead aparece em Leads **sem recarregar**
- [ ] Lead aparece no Funil **sem recarregar**
- [ ] Feedback visual funcionando (badges de sincronização)
- [ ] Console mostra logs de sincronização
- [ ] **Tempo total: < 2 segundos**

---

## 🎯 Cenário 2: Atualizar Etapa no Funil → Refletir em Conversas

### Objetivo
Verificar se mover um lead no Funil atualiza automaticamente a conversa correspondente.

### Passos

1. **Abra o Funil de Vendas**
   - Navegue para `/kanban`
   - Localize o lead "João Silva" (criado no teste anterior)

2. **Mova o Lead de Etapa**
   - Arraste o card do lead de "Novo" para "Qualificado"
   
   **🔍 Observe:**
   - Card move visualmente
   - Console mostra: `🔄 Movendo lead entre etapas...`
   - Console mostra: `✅ [Funil] Lead atualizado no Supabase`
   - Console mostra: `🔄 Sincronização automática vai propagar para Conversas e Leads`
   - Toast verde: "Lead movido com sucesso!"

3. **Verifique no Módulo Conversas**
   - **SEM RECARREGAR**, navegue para `/conversas`
   - Selecione a conversa de "João Silva"
   - Abra o Info Panel (lado direito)
   
   **✅ Esperado:**
   - Campo "Estágio do Funil" mostra "qualificado"
   - Console mostra: `📡 [Conversas] Lead atualizado via sync: {...}`
   - **NENHUMA notificação toast** (showNotifications: false em Conversas)

4. **Verifique no Módulo Leads**
   - **SEM RECARREGAR**, navegue para `/leads`
   - Localize o lead "João Silva"
   
   **✅ Esperado:**
   - Status do lead foi atualizado
   - Console mostra: `📡 [Leads] Lead atualizado via sync: {...}`
   - Toast azul: "Lead atualizado: João Silva"

### ✅ Critérios de Sucesso

- [ ] Drag & Drop funciona no Funil
- [ ] Conversas atualiza estágio **sem recarregar**
- [ ] Leads atualiza status **sem recarregar**
- [ ] Logs de sincronização no console
- [ ] **Tempo total: < 1 segundo**

---

## 🎯 Cenário 3: Atualizar Tag ou Responsável → Sincronizar em Todos os Módulos

### Objetivo
Verificar sincronização de tags e responsável entre todos os módulos.

### Passos - Parte A: Atualizar Tag em Conversas

1. **Abra Conversas**
   - Navegue para `/conversas`
   - Selecione a conversa de "João Silva"

2. **Adicione Nova Tag**
   - Clique em "Adicionar Tag"
   - Digite "vip-cliente"
   - Clique em "Adicionar"
   
   **🔍 Observe:**
   - Badge "🔄 Sincronizando..." aparece
   - Console: `🔄 Sincronizando tags...`
   - Badge "✅ Sincronizado" aparece brevemente
   - Tag "vip-cliente" aparece na lista

3. **Verifique em Leads e Funil**
   - Navegue para `/leads` **sem recarregar**
   - Localize "João Silva"
   - ✅ Tag "vip-cliente" está visível
   
   - Navegue para `/kanban` **sem recarregar**
   - Localize card de "João Silva"
   - ✅ Tag "vip-cliente" está visível no card

### Passos - Parte B: Atualizar Responsável em Conversas

1. **Abra Conversas**
   - Navegue para `/conversas`
   - Selecione "João Silva"

2. **Alterar Responsável**
   - No Info Panel, clique no campo "Responsável"
   - Selecione "Ana Costa"
   
   **🔍 Observe:**
   - Badge "🔄 Sincronizando..."
   - Console: `🔄 Sincronizando responsável...`
   - Badge "✅ Sincronizado"
   - Toast verde: "Responsável atualizado com sucesso!"

3. **Verifique nos Outros Módulos**
   - Navegue para `/leads`
   - ✅ Responsável de "João Silva" é "Ana Costa"
   
   - Navegue para `/kanban`
   - ✅ Card mostra "Ana Costa" como responsável

### ✅ Critérios de Sucesso

- [ ] Tags sincronizam em todos os módulos
- [ ] Responsável sincroniza em todos os módulos
- [ ] Feedback visual funcionando
- [ ] **Tempo por operação: < 1 segundo**

---

## 🎯 Cenário 4: Editar Informações no Pop-up → Sincronizar Imediatamente

### Objetivo
Verificar sincronização de edições completas de informações do lead.

### Passos

1. **Abra Conversas**
   - Navegue para `/conversas`
   - Selecione "João Silva"

2. **Editar Informações Completas**
   - No Info Panel, clique em "Editar Informações"
   - Altere os seguintes campos:
     - **Produto/Serviço**: "Sistema CRM Enterprise"
     - **Valor**: "15000"
     - **Anotações**: "Cliente prioritário - fechar até fim do mês"
   - Clique em "Salvar"
   
   **🔍 Observe:**
   - Badge "🔄 Sincronizando..."
   - Console: `🔄 Sincronizando informações do lead...`
   - Console: `✅ Informações atualizadas no Supabase`
   - Badge "✅ Sincronizado"
   - Toast verde: "Informações atualizadas com sucesso!"

3. **Verifique em Leads (Imediato)**
   - **SEM RECARREGAR**, navegue para `/leads`
   - Localize "João Silva"
   
   **✅ Esperado:**
   - Valor mostra "R$ 15.000,00"
   - Console: `📡 [Leads] Lead atualizado via sync: {...}`
   - **Mudança visível INSTANTANEAMENTE**

4. **Verifique no Funil (Imediato)**
   - **SEM RECARREGAR**, navegue para `/kanban`
   - Localize card de "João Silva"
   
   **✅ Esperado:**
   - Valor do card: "R$ 15.000,00"
   - Console: `📡 [Funil] Lead atualizado via sync: {...}`
   - **Mudança visível INSTANTANEAMENTE**

5. **Volte para Conversas**
   - Navegue de volta para `/conversas`
   - Selecione "João Silva"
   
   **✅ Esperado:**
   - Todas as informações estão salvas
   - Info Panel mostra dados atualizados
   - **Dados persistidos corretamente**

### ✅ Critérios de Sucesso

- [ ] Edições salvas em Conversas
- [ ] Leads mostra dados atualizados **instantaneamente**
- [ ] Funil mostra dados atualizados **instantaneamente**
- [ ] Dados persistem ao navegar entre páginas
- [ ] **Tempo total: < 1 segundo**

---

## 🎯 Cenário 5: Teste de Sincronização Reversa (Leads → Conversas)

### Objetivo
Verificar que edições em Leads propagam para Conversas.

### Passos

1. **Abra o Módulo Leads**
   - Navegue para `/leads`
   - Localize "João Silva"

2. **Adicione Tag em Leads**
   - Clique no botão "Tags"
   - Adicione tag "urgente"
   - Salve
   
   **🔍 Observe:**
   - Console: `📡 [useLeadsSync] Mudança detectada: {...}`
   - Console: `📡 [Conversas] Lead atualizado via sync: {...}`
   - Toast em Leads: "Lead atualizado: João Silva"

3. **Verifique em Conversas (Sem Recarregar)**
   - Navegue para `/conversas`
   - Selecione "João Silva"
   
   **✅ Esperado:**
   - Tag "urgente" aparece na lista de tags
   - **INSTANTANEAMENTE atualizado**

4. **Verifique no Funil (Sem Recarregar)**
   - Navegue para `/kanban`
   - Localize card de "João Silva"
   
   **✅ Esperado:**
   - Tag "urgente" aparece no card
   - **INSTANTANEAMENTE atualizado**

### ✅ Critérios de Sucesso

- [ ] Edição em Leads propaga para Conversas
- [ ] Edição em Leads propaga para Funil
- [ ] Sincronização bidirecional funcional
- [ ] **Zero atraso perceptível**

---

## 🎯 Cenário 6: Teste de Múltiplas Abas (Realtime Puro)

### Objetivo
Validar sincronização em tempo real com múltiplas abas abertas simultaneamente.

### Passos

1. **Abra 3 Abas do Sistema**
   - Aba 1: `/conversas`
   - Aba 2: `/leads`
   - Aba 3: `/kanban`
   - **Posicione as abas lado a lado na tela**

2. **Faça Mudança na Aba 1 (Conversas)**
   - Adicione uma tag "multi-tab-test"
   
   **🔍 Observe simultaneamente:**
   - Aba 2 (Leads): Tag aparece INSTANTANEAMENTE
   - Aba 3 (Funil): Tag aparece INSTANTANEAMENTE
   - Console em todas as abas mostra logs de sync

3. **Faça Mudança na Aba 3 (Funil)**
   - Mova o lead para outra etapa
   
   **🔍 Observe simultaneamente:**
   - Aba 1 (Conversas): Estágio atualiza INSTANTANEAMENTE
   - Aba 2 (Leads): Status atualiza INSTANTANEAMENTE

### ✅ Critérios de Sucesso

- [ ] Todas as abas recebem atualizações
- [ ] Sincronização é instantânea
- [ ] Nenhuma aba precisa recarregar
- [ ] **Latência: < 500ms**

---

## 📊 Checklist Final de Validação

### Funcionalidades Core
- [ ] ✅ Hook `useLeadsSync` funciona corretamente
- [ ] ✅ Conversas sincroniza com Leads
- [ ] ✅ Conversas sincroniza com Funil
- [ ] ✅ Leads sincroniza com Conversas
- [ ] ✅ Leads sincroniza com Funil
- [ ] ✅ Funil sincroniza com Conversas
- [ ] ✅ Funil sincroniza com Leads

### Performance
- [ ] ✅ Atualizações são instantâneas (< 1s)
- [ ] ✅ Zero atraso perceptível
- [ ] ✅ Múltiplas abas sincronizam simultaneamente

### UX
- [ ] ✅ Feedback visual funcionando (badges)
- [ ] ✅ Toasts informativos aparecem
- [ ] ✅ Dados persistem entre navegações
- [ ] ✅ Criação automática de leads funciona

### Robustez
- [ ] ✅ Console logs informativos
- [ ] ✅ Tratamento de erros implementado
- [ ] ✅ Sincronização bidirecional completa
- [ ] ✅ RLS policies funcionando

---

## 🐛 Troubleshooting

### Problema: Sincronização não funciona

**Sintomas:**
- Mudanças não aparecem em outros módulos
- Console não mostra logs de sync

**Soluções:**
1. Verifique se está logado no sistema
2. Abra DevTools e procure por erros no Console
3. Verifique se Supabase Realtime está conectado:
   - Console deve mostrar: `✅ [useLeadsSync] Sincronização ativa`
4. Verifique se o `company_id` está configurado corretamente

### Problema: Atraso na sincronização

**Sintomas:**
- Mudanças demoram mais de 2 segundos para aparecer

**Soluções:**
1. Verifique sua conexão com a internet
2. Verifique se há muitos logs no Console (performance)
3. Recarregue a página e teste novamente

### Problema: Lead não criado automaticamente

**Sintomas:**
- Badge continua "⚠️ Lead não cadastrado"
- Console mostra erro

**Soluções:**
1. Verifique se o telefone está formatado corretamente
2. Verifique se tem permissão para criar leads
3. Verifique logs de erro no Console

---

## 📝 Observações Importantes

1. **Console Logs**: Sempre mantenha o Console aberto durante os testes para acompanhar o fluxo de sincronização

2. **Timing**: A sincronização via Supabase Realtime geralmente leva entre 100ms e 500ms

3. **Badges de Status**:
   - 🔄 Sincronizando: Operação em andamento
   - ✅ Sincronizado: Operação concluída (desaparece após 2s)
   - ⚠️ Erro: Algo deu errado (desaparece após 3s)

4. **Notificações**: 
   - Conversas: Notificações toast DESLIGADAS (para não poluir UI)
   - Leads: Notificações toast LIGADAS
   - Funil: Notificações toast LIGADAS

---

## ✅ Resultado Esperado Final

Após completar todos os testes, o sistema deve apresentar:

1. ✅ **Sincronização Instantânea**: Mudanças aparecem em < 1 segundo
2. ✅ **Bidirecionalidade Completa**: Qualquer módulo pode modificar qualquer campo
3. ✅ **Feedback Visual Rico**: Usuário sempre sabe o que está acontecendo
4. ✅ **Persistência de Dados**: Tudo salvo corretamente no Supabase
5. ✅ **Zero Recarregamentos**: Navegação fluida entre módulos
6. ✅ **Múltiplas Abas**: Sincronização funciona com N abas abertas

---

**📅 Data do Teste**: ___________  
**👤 Testador**: ___________  
**✅ Status Geral**: [ ] Aprovado  [ ] Reprovado  [ ] Parcialmente Aprovado
