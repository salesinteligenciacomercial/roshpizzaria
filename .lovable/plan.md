

## Plano: Ajuste de Tempo de Atendimento e Fluxo Esperando/Em Atendimento

### Resumo do Pedido
Ajustar a lógica dos filtros "Esperando" e "Em Atendimento" no menu Conversas com as seguintes regras:

1. **Tempo de atendimento**: Aumentar de 10 minutos para **5 minutos**
2. **Quando usuário responde**: Conversa fica em "Em Atendimento" mostrando **qual usuário está atendendo**
3. **Se não houver interação por 5 minutos** (nem do usuário, nem do contato): Conversa fica "disponível" para outros atenderem
4. **Quando contato enviar nova mensagem** após expirar tempo: Conversa volta para "Esperando" para que **outro usuário possa atender**

---

### Lógica Atual (Problema)

O sistema atual usa uma constante `TEMPO_CONVERSA_AO_VIVO = 10 * 60 * 1000` (10 minutos) nos arquivos:
- `src/hooks/useConversationsCache.ts` (linha 363)
- `src/hooks/useConversationsLoader.ts` (linha 349)

A lógica atual verifica apenas se o usuário respondeu recentemente, mas:
- Não identifica **quem** está atendendo
- Não considera o tempo de inatividade **bidirecional** (usuário E contato)
- Não "libera" o atendimento após expirar o tempo

---

### Arquitetura da Solução

#### 1. Criar tabela para rastrear atendimentos ativos (Migration)

Precisamos de uma tabela para registrar quem está atendendo cada conversa e quando começou:

```sql
CREATE TABLE IF NOT EXISTS public.active_attendances (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  telefone_formatado text NOT NULL,
  attending_user_id uuid NOT NULL REFERENCES auth.users(id),
  started_at timestamp with time zone DEFAULT now(),
  last_activity_at timestamp with time zone DEFAULT now(),
  expires_at timestamp with time zone DEFAULT (now() + interval '5 minutes'),
  UNIQUE(company_id, telefone_formatado)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_active_attendances_company ON public.active_attendances(company_id);
CREATE INDEX IF NOT EXISTS idx_active_attendances_expires ON public.active_attendances(expires_at);

-- RLS
ALTER TABLE public.active_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active attendances from their company" 
  ON public.active_attendances FOR SELECT 
  USING (company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert/update active attendances for their company" 
  ON public.active_attendances FOR ALL 
  USING (company_id IN (
    SELECT company_id FROM user_roles WHERE user_id = auth.uid()
  ));

-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.active_attendances;
```

---

#### 2. Modificar Constantes de Tempo

Alterar `TEMPO_CONVERSA_AO_VIVO` de 10 minutos para 5 minutos:

**Arquivos afetados:**
- `src/hooks/useConversationsCache.ts`
- `src/hooks/useConversationsLoader.ts`

```typescript
// ANTES
const TEMPO_CONVERSA_AO_VIVO = 10 * 60 * 1000; // 10 minutos

// DEPOIS
const TEMPO_ATENDIMENTO_ATIVO = 5 * 60 * 1000; // 5 minutos
```

---

#### 3. Criar Hook para Gerenciar Atendimentos Ativos

Novo arquivo: `src/hooks/useActiveAttendance.ts`

```typescript
// Funcionalidades:
// - startAttendance(telefone): Registra que o usuário atual está atendendo
// - refreshAttendance(telefone): Atualiza last_activity_at e expires_at
// - getActiveAttendance(telefone): Retorna quem está atendendo (se houver)
// - isAttendanceExpired(telefone): Verifica se o atendimento expirou
// - releaseAttendance(telefone): Libera o atendimento manualmente
```

---

#### 4. Modificar Lógica de Filtros

**Arquivo:** `src/pages/Conversas.tsx`

Nova lógica para filtros "Esperando" e "Em Atendimento":

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE ATENDIMENTO                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CONTATO ENVIA MENSAGEM                                             │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────┐                       │
│  │ Existe atendimento ativo não expirado?  │                       │
│  └─────────────────────────────────────────┘                       │
│           │                                                         │
│     ┌─────┴─────┐                                                   │
│     │           │                                                   │
│   SIM          NÃO                                                  │
│     │           │                                                   │
│     ▼           ▼                                                   │
│ ┌─────────┐ ┌─────────────────────────────┐                        │
│ │ MANTER  │ │ Vai para "ESPERANDO"        │                        │
│ │EM ATEND.│ │ (disponível para qualquer   │                        │
│ │ com o   │ │  usuário atender)           │                        │
│ │ usuário │ └─────────────────────────────┘                        │
│ │ atual   │                                                        │
│ └─────────┘                                                        │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  USUÁRIO RESPONDE                                                   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────┐                       │
│  │ Registrar/Atualizar atendimento ativo   │                       │
│  │ - attending_user_id = usuário atual     │                       │
│  │ - last_activity_at = agora              │                       │
│  │ - expires_at = agora + 5 minutos        │                       │
│  └─────────────────────────────────────────┘                       │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────┐                       │
│  │ Conversa fica "EM ATENDIMENTO"          │                       │
│  │ mostrando nome do usuário               │                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TEMPO EXPIROU (5 min sem interação)                               │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────┐                       │
│  │ Atendimento considerado expirado        │                       │
│  │ Próxima mensagem do contato vai para    │                       │
│  │ "ESPERANDO" (outro usuário pode atender)│                       │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

#### 5. Modificar Contagem dos Badges

**Arquivos:** `src/pages/Conversas.tsx`

```typescript
// waitingCount: Conversas onde:
// - Última mensagem é do contato
// - NÃO existe atendimento ativo válido (ou expirou)

// answeredCount: Conversas onde:
// - Existe atendimento ativo NÃO expirado
// - OU última mensagem é do usuário E está dentro dos 5 minutos
```

---

#### 6. Mostrar Usuário Atendendo na Lista

**Arquivo:** `src/components/conversas/ConversationListItem.tsx`

Exibir badge com nome do usuário que está atendendo:

```typescript
// Se existe atendimento ativo para esta conversa
{attendingUser && (
  <Badge variant="secondary" className="text-xs">
    👤 {attendingUser.name}
  </Badge>
)}
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| **Migração SQL** | Criar | Tabela `active_attendances` com RLS e realtime |
| `src/hooks/useActiveAttendance.ts` | Criar | Hook para gerenciar atendimentos ativos |
| `src/hooks/useConversationsCache.ts` | Modificar | Alterar tempo de 10 para 5 minutos, integrar atendimentos |
| `src/hooks/useConversationsLoader.ts` | Modificar | Mesma alteração de tempo |
| `src/pages/Conversas.tsx` | Modificar | Integrar hook, ajustar filtros e contagens |
| `src/components/conversas/ConversationListItem.tsx` | Modificar | Mostrar usuário atendendo |

---

### Regras de Negócio Detalhadas

1. **Usuário responde ao contato:**
   - Cria/atualiza registro em `active_attendances`
   - `expires_at` = agora + 5 minutos
   - Conversa aparece em "Em Atendimento" com nome do usuário

2. **Contato responde durante atendimento ativo:**
   - Atualiza `last_activity_at` e `expires_at`
   - Conversa continua em "Em Atendimento" com mesmo usuário

3. **5 minutos sem interação (de nenhum lado):**
   - Atendimento considerado expirado
   - Próxima mensagem do contato vai para "Esperando"
   - Qualquer usuário pode "pegar" o atendimento

4. **Novo usuário responde após expiração:**
   - Substitui o registro em `active_attendances`
   - Novo usuário assume o atendimento

---

### Interface Visual

**Lista de Conversas - Badge de Atendimento:**
```text
┌─────────────────────────────────────────────────────┐
│ 👤 João Silva                          15:30       │
│ Olá, preciso de ajuda...               👤 Maria   │
│                                        [Em Atend.] │
└─────────────────────────────────────────────────────┘
```

**Filtro "Em Atendimento":**
- Mostra apenas conversas com atendimento ativo não expirado
- Cada item mostra qual usuário está atendendo

**Filtro "Esperando":**
- Mostra conversas onde contato enviou mensagem E:
  - Não existe atendimento ativo, OU
  - Atendimento expirou (mais de 5 min sem interação)

---

### Considerações de Performance

1. **Limpeza automática:** Registros expirados podem ser limpos via cron job ou ao carregar conversas
2. **Cache local:** Estados de atendimento podem ser cacheados para evitar queries frequentes
3. **Realtime:** Usar subscription para atualizar UI quando atendimento muda

---

### Benefícios da Implementação

1. **Controle de atendimento:** Saber exatamente quem está atendendo cada contato
2. **Distribuição justa:** Após 5 minutos de inatividade, outro usuário pode assumir
3. **Visibilidade:** Equipe vê claramente quais conversas estão sendo atendidas e por quem
4. **Evita conflitos:** Previne que dois usuários respondam ao mesmo contato simultaneamente

