
# Plano: Exibir Tags Permanentemente na Lista de Conversas

## Problema Identificado
Quando uma tag e adicionada a um contato, ela aparece apenas momentaneamente ou quando a conversa e aberta. Ao trocar de conversa, as tags somem da lista.

## Causa Raiz
O sistema carrega as conversas do banco de dados, mas a consulta que busca os leads vinculados **nao inclui o campo `tags`**. Por isso, mesmo que o lead tenha tags, elas nunca sao carregadas para a lista de conversas.

### Detalhes Tecnicos

1. **Consulta de Leads (linha 2975)**: Seleciona apenas `id, phone, name, telefone` - falta `tags`
2. **Mapa de Leads (linhas 3109-3124)**: Armazena apenas `{name, leadId}` - nao tem tags  
3. **Criacao da Conversa (linha 3350)**: Define `tags: []` - sempre vazio

## Solucao

Modificar a funcao `loadSupabaseConversations` em `src/pages/Conversas.tsx` para:

### Alteracao 1: Incluir `tags` na consulta de leads
```text
Linha ~2975:
DE: .select('id, phone, name, telefone')
PARA: .select('id, phone, name, telefone, tags')
```

### Alteracao 2: Atualizar o tipo do leadsMap para incluir tags
```text
Linhas ~3110-3113:
DE: Map<string, { name: string; leadId: string; }>
PARA: Map<string, { name: string; leadId: string; tags: string[]; }>
```

### Alteracao 3: Armazenar tags no leadsMap
```text
Linhas ~3119-3122:
DE: leadsMap.set(phoneKey, { name: lead.name || phoneKey, leadId: lead.id });
PARA: leadsMap.set(phoneKey, { name: lead.name || phoneKey, leadId: lead.id, tags: lead.tags || [] });
```

### Alteracao 4: Usar tags do lead ao criar a conversa
```text
Linha ~3350:
DE: tags: [],
PARA: tags: leadInfo?.tags || [],
```

## Resultado Esperado
- As tags do lead serao carregadas junto com as conversas
- As tags aparecerão permanentemente na lista de conversas
- Nao sera mais necessario abrir a conversa para ver as tags
- As tags permanecerao visiveis mesmo ao trocar de conversa

## Arquivo a Modificar
- `src/pages/Conversas.tsx`
