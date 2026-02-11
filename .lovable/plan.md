
# Plano: Corrigir exibição de fotos de perfil para todos os contatos

## Problema Identificado

Atualmente, ~550 dos 901 leads (61%) nao possuem `profile_picture_url` salva no banco de dados. O sistema tenta buscar via Evolution API, mas muitos contatos tem foto de perfil privada no WhatsApp ou a busca falha por timeout/rate limiting.

Alem disso, o frontend faz cache permanente do placeholder (iniciais), nunca retentando buscar a foto real posteriormente.

## Solucao em 3 Partes

### 1. Criar Edge Function de Batch para buscar fotos em massa

Nova Edge Function `batch-profile-pictures` que:
- Busca todos os leads sem `profile_picture_url` da empresa
- Tenta buscar foto de cada um via Evolution API com throttling (evitar rate limit)
- Salva as fotos encontradas no banco de dados
- Pode ser chamada manualmente ou via botao na interface

### 2. Melhorar a Edge Function `get-profile-picture`

- Adicionar suporte a **Meta Cloud API** para buscar fotos (a empresa do usuario usa `api_provider: meta` com token valido)
- A Meta Cloud API permite buscar foto via endpoint `GET /{phone_number_id}/contacts` ou similar
- Se Evolution falhar, tentar Meta API como fallback adicional
- Aumentar o cache de resultados nulos para 30 minutos (evitar chamadas repetidas para contatos sem foto publica)

### 3. Corrigir o carregamento no frontend (`Conversas.tsx`)

- Remover o cache permanente de fallbacks `ui-avatars.com` no `avatarCacheRef` - permitir retentativas
- Melhorar o throttling do lazy loading: usar batches de 5 com intervalo de 500ms entre batches
- Priorizar contatos visiveis na tela (primeiros da lista)
- Quando um lead ja tem `profile_picture_url` no banco, usar direto sem chamar Edge Function

## Detalhes Tecnicos

### Edge Function `batch-profile-pictures/index.ts` (NOVA)

```text
POST /batch-profile-pictures
Body: { company_id: string }

1. Buscar leads SEM profile_picture_url (limit 100)
2. Buscar credenciais Evolution/Meta da empresa
3. Para cada lead (com delay de 500ms entre cada):
   a. Tentar Evolution API
   b. Se falhar, tentar Meta API (se disponivel)
   c. Se encontrou foto, UPDATE no lead
4. Retornar { updated: N, failed: N, total: N }
```

### Alteracoes em `get-profile-picture/index.ts`

- Adicionar busca via Meta Cloud API (`GET https://graph.facebook.com/v21.0/{phone_number_id}` com contact lookup)
- Aumentar cache de null para 30 minutos
- Melhor logging para debug

### Alteracoes em `src/pages/Conversas.tsx`

- Na funcao `getProfilePictureWithFallback`: nao cachear URLs de `ui-avatars.com` no `avatarCacheRef`
- No carregamento inicial: usar `profilePictureUrl` do lead diretamente (ja implementado), e so chamar Edge Function para quem nao tem
- Melhorar batching: 5 simultaneos, 500ms entre batches
- Adicionar botao "Atualizar Fotos" no menu de conversas para disparar o batch manualmente

### Sequencia de execucao

1. Atualizar `get-profile-picture` com suporte Meta API
2. Criar `batch-profile-pictures` Edge Function
3. Corrigir frontend para nao cachear placeholders e melhorar batching
4. Adicionar botao para atualizar fotos em massa
