

## Plano: Painel de Produtividade por Usuário no Menu Conversas

### Resumo do Pedido
Criar um painel/relatório no menu Conversas que mostra a produtividade de cada usuário, exibindo:
- Compromissos criados
- Lembretes criados
- Tarefas criadas
- Fichas técnicas/prontuários adicionados
- Mensagens agendadas

**Acesso restrito** a Gestores e Administradores (roles: `super_admin`, `company_admin`, `gestor`)

---

### Arquitetura da Solução

#### Novo Componente: `ProductivityPanel.tsx`
Um painel/diálogo que será acessível via botão no menu Conversas, mostrando:
- Filtro por período (hoje, esta semana, este mês, personalizado)
- Filtro por usuário (dropdown com todos usuários da empresa)
- Cards com métricas por tipo de criação
- Tabela detalhada com histórico

---

### Alteração de Schema Necessária

A tabela `lembretes` não possui campo para rastrear o criador. Precisamos adicionar:

```sql
ALTER TABLE public.lembretes 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);
```

---

### Interface Proposta

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Relatório de Produtividade                              [X]     │
├─────────────────────────────────────────────────────────────────────┤
│ Período: [Hoje ▼] [Esta Semana] [Este Mês] [📅 Personalizado]      │
│ Usuário: [Todos ▼] ou [Selecionar usuário específico]              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐│
│  │📅 Compromissos│ │🔔 Lembretes  │ │✅ Tarefas    │ │📋 Prontuários││
│  │     12       │ │     8        │ │     15       │ │     5        ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘│
│  ┌──────────────┐                                                   │
│  │⏰ Msg Agendada│                                                   │
│  │     3        │                                                   │
│  └──────────────┘                                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Detalhamento por Usuário:                                           │
│ ┌───────────────────────────────────────────────────────────────────┐
│ │ 👤 Maria Silva                                                    │
│ │ Compromissos: 5 | Tarefas: 8 | Lembretes: 3 | Prontuários: 2     │
│ ├───────────────────────────────────────────────────────────────────┤
│ │ 👤 João Santos                                                    │
│ │ Compromissos: 7 | Tarefas: 7 | Lembretes: 5 | Prontuários: 3     │
│ └───────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

### Consultas SQL por Categoria

**Compromissos criados (por owner_id):**
```typescript
supabase.from("compromissos")
  .select("id, created_at, owner_id, titulo, tipo_servico")
  .eq("company_id", companyId)
  .gte("created_at", startDate)
  .lte("created_at", endDate)
```

**Tarefas criadas (por owner_id):**
```typescript
supabase.from("tasks")
  .select("id, created_at, owner_id, title, priority")
  .eq("company_id", companyId)
  .gte("created_at", startDate)
  .lte("created_at", endDate)
```

**Lembretes criados (por created_by - NOVO CAMPO):**
```typescript
supabase.from("lembretes")
  .select("id, created_at, created_by, canal, destinatario")
  .eq("company_id", companyId)
  .gte("created_at", startDate)
  .lte("created_at", endDate)
```

**Prontuários/Fichas (por uploaded_by):**
```typescript
supabase.from("lead_attachments")
  .select("id, created_at, uploaded_by, file_name, category")
  .eq("company_id", companyId)
  .gte("created_at", startDate)
  .lte("created_at", endDate)
```

**Mensagens Agendadas (por owner_id):**
```typescript
supabase.from("scheduled_whatsapp_messages")
  .select("id, created_at, owner_id, contact_name, status")
  .eq("company_id", companyId)
  .gte("created_at", startDate)
  .lte("created_at", endDate)
```

---

### Controle de Acesso

O botão para abrir o painel só será visível para usuários com roles permitidos:

```typescript
// No componente Conversas.tsx
const { isAdmin, userRoles } = usePermissions();

// Verificar se é gestor ou admin
const canViewProductivity = useMemo(() => {
  return isAdmin || userRoles.some(r => 
    ['super_admin', 'company_admin', 'gestor'].includes(r.role)
  );
}, [isAdmin, userRoles]);

// No JSX
{canViewProductivity && (
  <Button onClick={() => setProductivityPanelOpen(true)}>
    <BarChart className="h-4 w-4 mr-2" />
    Produtividade
  </Button>
)}
```

---

### Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/conversas/ProductivityPanel.tsx` | Criar | Componente do painel de produtividade |
| `src/pages/Conversas.tsx` | Modificar | Adicionar botão e controle de acesso |
| **Migração SQL** | Executar | Adicionar `created_by` na tabela `lembretes` |

---

### Detalhes do Componente ProductivityPanel

O componente incluirá:

1. **Filtros:**
   - Período: Hoje, Esta Semana, Este Mês, Personalizado
   - Usuário: Dropdown com todos usuários da empresa

2. **KPIs em Cards:**
   - Total de compromissos criados
   - Total de lembretes criados
   - Total de tarefas criadas
   - Total de fichas/prontuários adicionados
   - Total de mensagens agendadas

3. **Tabela de Ranking:**
   - Lista de usuários ordenados por produtividade
   - Métricas individuais por usuário
   - Possibilidade de expandir para ver detalhes

4. **Gráfico (opcional):**
   - Visualização de produtividade ao longo do tempo
   - Comparativo entre usuários

---

### Fluxo de Uso

1. Gestor/Admin clica no botão "Produtividade" no menu Conversas
2. Painel abre em modal/diálogo
3. Seleciona período desejado
4. Opcionalmente filtra por usuário específico
5. Visualiza métricas consolidadas e detalhadas
6. Pode exportar dados (futuro)

---

### Considerações de Segurança

- O botão só aparece para `super_admin`, `company_admin` e `gestor`
- Dados são filtrados por `company_id` automaticamente
- RLS garante que usuários só veem dados da própria empresa
- Vendedores e Suporte não têm acesso ao painel

---

### Métricas Adicionais (Futuro)

Com esta estrutura, será possível expandir para incluir:
- Tempo médio de resposta
- Taxa de conversão por usuário
- Leads atendidos por período
- Mensagens enviadas/recebidas por usuário

