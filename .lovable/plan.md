

# Corrigir exibição do Protocolo de Atendimento

## Problema identificado

O protocolo **é criado** quando o atendente envia uma mensagem (`handleSendMessage`), mas **nunca é carregado** quando uma conversa é selecionada. A função `loadActiveProtocol` existe no hook mas não é chamada em nenhum lugar do código. Por isso o badge do protocolo nunca aparece.

Além disso, o protocolo só é criado quando o atendente humano responde manualmente. Não há geração automática ao receber uma mensagem nova do cliente.

## Como vai funcionar após a correção

1. **Ao selecionar uma conversa**: O sistema carrega automaticamente o protocolo ativo (se existir) e exibe no cabeçalho
2. **Ao receber uma nova mensagem de um contato**: Um protocolo é criado automaticamente (sem precisar de URA, bot ou IA ativados)
3. **Ao responder manualmente**: Continua criando protocolo se não existir um aberto (comportamento atual)
4. **O badge aparece no cabeçalho** com o número do protocolo em tempo real

## Alterações

### 1. `src/pages/Conversas.tsx`
- Adicionar chamada a `loadActiveProtocol` quando `selectedConv` muda (no useEffect de seleção de conversa)
- Adicionar chamada a `createProtocol` quando uma nova mensagem é recebida do contato (no handler de realtime/webhook), gerando protocolo automaticamente sem depender de URA/bot/IA
- Recarregar o protocolo ativo após criar um novo protocolo no `handleSendMessage`

### 2. `src/hooks/useAttendanceProtocol.ts`
- Ajustar `createProtocol` para retornar os dados completos e atualizar `activeProtocol` no state imediatamente após criação, sem precisar de chamada extra a `loadActiveProtocol`

## Resultado esperado

O protocolo será gerado e exibido automaticamente em qualquer cenário:
- Cliente envia mensagem -> protocolo criado e visível
- Atendente abre conversa -> protocolo existente carregado e visível
- Atendente responde -> protocolo criado (se não existir) e visível

Não é necessário ativar URA, bot ou IA para gerar protocolos.

