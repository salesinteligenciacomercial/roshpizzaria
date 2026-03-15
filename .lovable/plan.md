

## Problema

Quando a URA (fluxo de automação) transfere para um departamento/responsável via nó "Rotear Departamento", o `executeRouteDepartment` **deleta** o `conversation_flow_state`. Quando o lead envia uma nova mensagem, o webhook não encontra estado ativo, então verifica fluxos com gatilho `nova_mensagem` e **reinicia o fluxo do zero** -- repetindo o menu.

## Solução

Duas mudanças coordenadas:

### 1. Backend: `webhook-conversas/index.ts` -- Bloquear fluxo quando há atribuição ativa

Antes de iniciar um novo fluxo (bloco "else" na linha ~1825), verificar se existe um registro em `conversation_assignments` para esse número/empresa. Se existir, significa que a conversa foi transferida e está sob responsabilidade de um atendente -- o fluxo **não** deve ser reiniciado.

```
-- Pseudocódigo da verificação:
SELECT id FROM conversation_assignments
WHERE telefone_formatado = numeroLimpo
  AND company_id = companyId
  AND assigned_user_id IS NOT NULL
```

Se encontrar, pular a inicialização de fluxo e seguir para a lógica de IA (que já respeita `active_attendances`).

### 2. Frontend: `Conversas.tsx` -- Limpar atribuição ao finalizar

Nas funções `finalizarAtendimento` e `finalizarAtendimentoSilent`, após marcar as mensagens como "Resolvida", **deletar** o registro de `conversation_assignments` para aquele telefone/empresa. Isso "desbloqueia" o fluxo para ser acionado novamente na próxima mensagem do contato.

```
-- Ao finalizar:
DELETE FROM conversation_assignments
WHERE telefone_formatado = telefoneFormatado
  AND company_id = companyId
```

### Resumo do fluxo corrigido

```text
Lead envia msg → webhook
  ├─ Tem flow_state ativo? → Continua fluxo (menu interativo)
  ├─ Não tem flow_state, mas tem conversation_assignment? → BLOQUEIA fluxo (transferido)
  └─ Sem state nem assignment → Inicia novo fluxo/IA normalmente

Atendente finaliza → Remove conversation_assignment
  └─ Próxima msg do lead → Fluxo pode iniciar novamente
```

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/webhook-conversas/index.ts` | Adicionar check de `conversation_assignments` antes de iniciar novo fluxo |
| `src/pages/Conversas.tsx` | Deletar `conversation_assignments` em `finalizarAtendimento` e `finalizarAtendimentoSilent` |

