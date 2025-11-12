# 🚀 PLANO DE AÇÃO - CORREÇÃO MENU CONVERSAS

**Objetivo:** Elevar a nota de **6.5/10** para **8.5/10**  
**Prazo Estimado:** 3-4 semanas  
**Prioridade:** 🔴 CRÍTICA

---

## 📊 STATUS ATUAL vs OBJETIVO

| Métrica | Atual | Objetivo | Gap |
|---------|-------|----------|-----|
| **Funcionalidade** | 8/10 | 9/10 | +1 |
| **Estabilidade** | 5/10 | 8/10 | +3 |
| **Performance** | 6/10 | 8/10 | +2 |
| **UX** | 7/10 | 8/10 | +1 |
| **Tratamento de Erros** | 6/10 | 8/10 | +2 |
| **NOTA GERAL** | **6.5/10** | **8.5/10** | **+2.0** |

---

## 🎯 FASES DE IMPLEMENTAÇÃO

### 🔴 FASE 1: CORREÇÕES CRÍTICAS (Semana 1-2)
**Prioridade:** MÁXIMA  
**Impacto:** Alto  
**Esforço:** Alto

#### 1.1 Sincronização Realtime Instável
**Estimativa:** 3-4 dias

**Tarefas:**
- [ ] Implementar polling de fallback quando realtime falhar
- [ ] Melhorar detecção de mensagens duplicadas (timestamp + hash)
- [ ] Aumentar limite de tentativas de reconexão (5 → 10)
- [ ] Adicionar health check periódico do canal (a cada 30s)
- [ ] Implementar fila de mensagens perdidas durante desconexão
- [ ] Melhorar validação de dados (menos restritiva, mais logs)
- [ ] Adicionar métricas de conexão (uptime, reconexões)

**Arquivos a Modificar:**
- `src/pages/Conversas.tsx` (linhas 1685-2740)

**Critérios de Sucesso:**
- ✅ Mensagens aparecem em tempo real (< 2s) em 95% dos casos
- ✅ Reconexão automática funciona em 100% das quedas
- ✅ Zero mensagens duplicadas
- ✅ Status de conexão preciso em 100% do tempo

---

#### 1.2 Vinculação Automática de Leads
**Estimativa:** 2-3 dias

**Tarefas:**
- [ ] Melhorar normalização de telefone (suportar formatos internacionais)
- [ ] Implementar busca usando LIKE para números parciais
- [ ] Adicionar deduplicação antes de criar novo lead
- [ ] Persistir vinculação na tabela conversas (campo lead_id)
- [ ] Adicionar verificação periódica de vinculação (a cada 5min)
- [ ] Melhorar logs para debug de vinculação
- [ ] Adicionar teste de vinculação em diferentes formatos

**Arquivos a Modificar:**
- `src/pages/Conversas.tsx` (linhas 5178-5470)
- `supabase/migrations/` (adicionar campo lead_id se não existir)

**Critérios de Sucesso:**
- ✅ 100% das conversas vinculam automaticamente com leads existentes
- ✅ Zero leads duplicados criados
- ✅ Vinculação persiste após refresh
- ✅ Busca encontra leads com 95%+ de diferentes formatações

---

#### 1.3 Edge Functions sem Tratamento Robusto
**Estimativa:** 2 dias

**Tarefas:**
- [ ] Aumentar timeout para uploads (10s → 30s)
- [ ] Implementar progress tracking para uploads
- [ ] Melhorar mapeamento de erros específicos
- [ ] Adicionar retry exponencial mais agressivo
- [ ] Implementar cache de avatares mais robusto (localStorage)
- [ ] Adicionar métricas de sucesso/falha de edge functions
- [ ] Melhorar mensagens de erro para usuário

**Arquivos a Modificar:**
- `src/pages/Conversas.tsx` (linhas 302-510)
- Criar `src/utils/edgeFunctionHelper.ts` (utilitário reutilizável)

**Critérios de Sucesso:**
- ✅ 95%+ de sucesso em envio de mensagens
- ✅ 90%+ de sucesso em transcrição de áudio
- ✅ 100% de fallback de avatar funcionando
- ✅ Erros claros e acionáveis para usuário

---

### 🟡 FASE 2: MELHORIAS IMPORTANTES (Semana 3)
**Prioridade:** ALTA  
**Impacto:** Médio-Alto  
**Esforço:** Médio

#### 2.1 Performance com Muitas Conversas
**Estimativa:** 2-3 dias

**Tarefas:**
- [ ] Instalar e configurar react-window ou react-virtuoso
- [ ] Implementar virtualização de lista de conversas
- [ ] Implementar lazy loading de mensagens (últimas 50)
- [ ] Otimizar busca com debounce mais agressivo (500ms)
- [ ] Memoizar componentes (React.memo em ConversationListItem)
- [ ] Implementar paginação server-side de mensagens
- [ ] Otimizar filtros com useMemo

**Arquivos a Modificar:**
- `src/pages/Conversas.tsx` (linhas 550-650, renderização)
- `src/components/conversas/ConversationListItem.tsx`
- Instalar: `npm install react-window react-window-infinite-loader`

**Critérios de Sucesso:**
- ✅ Interface não trava com 200+ conversas
- ✅ Busca < 500ms com 1000+ conversas
- ✅ Filtros responsivos (< 200ms)
- ✅ Scroll suave (60fps)

---

#### 2.2 Upload de Mídia
**Estimativa:** 2 dias

**Tarefas:**
- [ ] Adicionar validação de tamanho (limite 10MB configurável)
- [ ] Implementar progress bar durante upload
- [ ] Adicionar compressão de imagens (se > 2MB)
- [ ] Implementar upload em chunks para arquivos grandes
- [ ] Adicionar preview antes de enviar
- [ ] Melhorar tratamento de erro com mensagens claras
- [ ] Validar tipo MIME antes de enviar

**Arquivos a Modificar:**
- `src/components/conversas/MediaUpload.tsx` (reescrever)
- Criar `src/utils/imageCompression.ts`
- Instalar: `npm install browser-image-compression`

**Critérios de Sucesso:**
- ✅ Upload funciona para arquivos até 10MB
- ✅ Progress bar visível durante upload
- ✅ Imagens > 2MB são comprimidas automaticamente
- ✅ Preview antes de enviar
- ✅ Erros claros e acionáveis

---

#### 2.3 Transcrição de Áudio
**Estimativa:** 1-2 dias

**Tarefas:**
- [ ] Aumentar timeout para 60s
- [ ] Melhorar indicador visual ("Transcrevendo..." com spinner)
- [ ] Permitir reenviar transcrição se falhar
- [ ] Persistir status de transcrição no banco
- [ ] Mostrar transcrição quando disponível de forma assíncrona
- [ ] Adicionar botão "Tentar novamente" em caso de erro

**Arquivos a Modificar:**
- `src/pages/Conversas.tsx` (linhas 3594-3700)
- `src/components/conversas/MessageItem.tsx` (indicador visual)

**Critérios de Sucesso:**
- ✅ 90%+ de transcrições completadas em < 30s
- ✅ Indicador visual claro durante transcrição
- ✅ Reenvio funciona se falhar
- ✅ Status persiste após refresh

---

### 🟢 FASE 3: POLIMENTO E MELHORIAS (Semana 4)
**Prioridade:** MÉDIA  
**Impacto:** Baixo-Médio  
**Esforço:** Baixo-Médio

#### 3.1 Interface e UX
**Estimativa:** 1-2 dias

**Tarefas:**
- [ ] Adicionar skeleton loading durante carregamento
- [ ] Melhorar feedback visual de ações
- [ ] Adicionar atalhos de teclado (Ctrl+K para busca, etc)
- [ ] Melhorar responsividade mobile

**Critérios de Sucesso:**
- ✅ Loading states claros
- ✅ Feedback imediato em todas as ações
- ✅ Atalhos funcionando
- ✅ Mobile responsivo

---

#### 3.2 Testes e Validação
**Estimativa:** 1-2 dias

**Tarefas:**
- [ ] Criar testes unitários para funções críticas
- [ ] Criar testes de integração para sincronização
- [ ] Testar com diferentes volumes de dados
- [ ] Validar checklist completo

**Critérios de Sucesso:**
- ✅ 80%+ de cobertura de código crítico
- ✅ Todos os testes passando
- ✅ Validação completa do checklist

---

## 📋 CHECKLIST DE VALIDAÇÃO POR FASE

### ✅ Fase 1 - Correções Críticas
- [ ] Sincronização realtime estável
- [ ] Vinculação automática funcionando
- [ ] Edge functions robustas
- [ ] Zero erros críticos no console
- [ ] Testes manuais passando

### ✅ Fase 2 - Melhorias Importantes
- [ ] Performance otimizada
- [ ] Upload de mídia completo
- [ ] Transcrição funcionando
- [ ] Testes de carga passando

### ✅ Fase 3 - Polimento
- [ ] UX melhorada
- [ ] Testes automatizados passando
- [ ] Documentação atualizada
- [ ] Deploy em produção

---

## 🎯 MÉTRICAS DE SUCESSO

### Métricas Técnicas
- **Uptime de Sincronização:** > 99%
- **Taxa de Sucesso de Envio:** > 95%
- **Tempo de Resposta:** < 500ms (busca)
- **Taxa de Erro:** < 1%

### Métricas de Negócio
- **Satisfação do Usuário:** > 4.5/5
- **Taxa de Uso:** > 80% dos usuários ativos
- **Tempo Médio de Resposta:** < 2min

---

## 🚨 RISCOS E MITIGAÇÕES

### Risco 1: Refatoração quebra funcionalidades existentes
**Mitigação:** 
- Testes antes e depois de cada mudança
- Deploy incremental
- Feature flags para novas funcionalidades

### Risco 2: Performance piora após mudanças
**Mitigação:**
- Benchmark antes e depois
- Profiling de performance
- Rollback plan pronto

### Risco 3: Edge functions continuam falhando
**Mitigação:**
- Monitoramento proativo
- Alertas configurados
- Fallbacks robustos

---

## 📅 CRONOGRAMA SUGERIDO

```
Semana 1:
├── Dia 1-2: Sincronização Realtime (Parte 1)
├── Dia 3-4: Sincronização Realtime (Parte 2)
└── Dia 5: Vinculação de Leads (Parte 1)

Semana 2:
├── Dia 1: Vinculação de Leads (Parte 2)
├── Dia 2-3: Edge Functions
└── Dia 4-5: Testes e Correções Fase 1

Semana 3:
├── Dia 1-2: Performance
├── Dia 3-4: Upload de Mídia
└── Dia 5: Transcrição de Áudio

Semana 4:
├── Dia 1-2: UX e Polimento
├── Dia 3: Testes
└── Dia 4-5: Deploy e Validação
```

---

## 📝 NOTAS IMPORTANTES

1. **Priorizar correções críticas** - Sem elas, o sistema não é confiável
2. **Testar incrementalmente** - Não esperar o final para testar
3. **Documentar mudanças** - Atualizar documentação conforme avança
4. **Comunicar progresso** - Atualizar stakeholders regularmente
5. **Ter plano de rollback** - Sempre poder voltar atrás se necessário

---

## ✅ PRÓXIMOS PASSOS IMEDIATOS

1. ✅ Revisar este plano com a equipe
2. ✅ Priorizar tarefas baseado em impacto
3. ✅ Criar tickets no sistema de gestão
4. ✅ Começar pela Fase 1 - Correções Críticas
5. ✅ Configurar monitoramento e alertas

---

**Última Atualização:** Janeiro 2025  
**Status:** 📋 Pronto para Implementação

