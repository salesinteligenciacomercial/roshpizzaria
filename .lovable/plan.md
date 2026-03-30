

# Plano: Resolver bloqueio de envio/recebimento de mensagens

## Diagnóstico Confirmado

O banco de dados mostra que **mensagens estão diminuindo drasticamente**: 296 nas últimas 6 horas, mas apenas 3 na última hora. A causa raiz é:

**A função `get-profile-picture` está consumindo toda a capacidade de processamento das edge functions.**

Evidências:
- Console do navegador: **TODAS** as chamadas `get-profile-picture` falham com "Timeout após 8000ms" e "Failed to fetch"
- Logs do servidor: dezenas de boots/shutdowns por segundo para `get-profile-picture`, cada uma tentando **8 variações de número** contra a Evolution API
- **Zero logs** para `webhook-conversas` e `enviar-whatsapp` — não conseguem iniciar porque a capacidade está esgotada
- Duas partes do código disparam carregamento de avatares em massa ao abrir Conversas (linhas ~1400 e ~4042)

Resultado: as funções críticas de envio e recebimento não conseguem processar, afetando WhatsApp (Evolution + Oficial) e Instagram simultaneamente.

## Plano de Correção

### Passo 1: Desativar carregamento automático de fotos de perfil na listagem
**Arquivo:** `src/pages/Conversas.tsx`

Remover os dois blocos que fazem carregamento em massa de avatares ao abrir a tela de Conversas (linhas ~1399-1432 e ~4042-4064). Substituir por carregamento **sob demanda** — buscar a foto apenas quando o usuário **clicar** em uma conversa específica.

Isso elimina imediatamente dezenas de chamadas paralelas à edge function.

### Passo 2: Otimizar a edge function `get-profile-picture`
**Arquivo:** `supabase/functions/get-profile-picture/index.ts`

- Reduzir variações de número de **8** para **3** (número original, com 55, sem 55)
- Adicionar timeout interno de **5 segundos** para a chamada à Evolution API
- Aumentar cache de resultados negativos de 30 min para **2 horas**
- Retornar `null` imediatamente se a Evolution API não responder

### Passo 3: Remover chamadas de foto de perfil de outros componentes que carregam listas
**Arquivos:** `src/pages/Leads.tsx`, `src/pages/Agenda.tsx`, `src/components/funil/LeadCard.tsx`, `src/components/tarefas/TaskCard.tsx`

Adicionar throttling global — máximo **1 chamada por vez** em toda a aplicação, com fila que descarta chamadas quando há mais de 3 pendentes.

### Passo 4: Forçar redeploy das funções críticas
Fazer uma alteração mínima (adicionar comentário) nas funções `webhook-conversas`, `enviar-whatsapp`, `webhook-meta` e `enviar-instagram` para forçar um redeploy limpo e limpar qualquer estado de BOOT_ERROR.

## Resultado Esperado
- Redução de ~95% das chamadas à edge function `get-profile-picture`
- Funções críticas (`webhook-conversas`, `enviar-whatsapp`, `webhook-meta`, `enviar-instagram`) voltam a ter capacidade para processar
- Envio e recebimento de mensagens restaurados em todos os canais
- Fotos de perfil carregam sob demanda ao clicar na conversa

## Detalhes Técnicos

**Arquivos modificados:**
1. `src/pages/Conversas.tsx` — remover lazy loading em massa de avatares, carregar sob demanda
2. `supabase/functions/get-profile-picture/index.ts` — reduzir variações, timeout interno, cache mais longo
3. `src/pages/Leads.tsx`, `src/pages/Agenda.tsx` — throttling global
4. `src/components/funil/LeadCard.tsx`, `src/components/tarefas/TaskCard.tsx` — throttling global
5. Redeploy de `webhook-conversas`, `enviar-whatsapp`, `webhook-meta`, `enviar-instagram`

