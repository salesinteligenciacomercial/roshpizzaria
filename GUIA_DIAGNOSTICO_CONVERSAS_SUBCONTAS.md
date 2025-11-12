# 🔍 GUIA DE DIAGNÓSTICO: Problemas no Menu Conversas (Subcontas)

## 🎯 CONTEXTO

**Modelo:** SaaS Multi-tenant  
**Problema:** Menu Conversas não funciona corretamente nas subcontas  
**Status Conta Matriz:** ✅ Funcional  
**Status Subcontas:** ❌ Com problemas

---

## 🔍 DIAGNÓSTICO PASSO A PASSO

### 1. Verificar se `company_id` está sendo carregado

**Como verificar:**
1. Abra o menu Conversas em uma subconta
2. Abra o Console do navegador (F12)
3. Procure por logs: `🏢 Company ID carregado:`

**Se NÃO aparecer:**
- ❌ Problema: `company_id` não está sendo carregado
- ✅ Solução: Verificar se usuário tem `user_roles` com `company_id`

**Query de verificação:**
```sql
-- Verificar se usuário tem company_id
SELECT 
  u.email,
  ur.company_id,
  c.name as company_name,
  c.is_master_account,
  c.parent_company_id
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN companies c ON c.id = ur.company_id
WHERE u.email = 'email_da_subconta@exemplo.com';
```

---

### 2. Verificar se há conversas na subconta

**Query de verificação:**
```sql
-- Verificar conversas por empresa
SELECT 
  c.name as company_name,
  COUNT(conv.id) as total_conversas,
  COUNT(CASE WHEN conv.company_id IS NULL THEN 1 END) as conversas_sem_company_id
FROM companies c
LEFT JOIN conversas conv ON conv.company_id = c.id
WHERE c.status = 'active'
GROUP BY c.id, c.name
ORDER BY c.is_master_account DESC, c.name;
```

**Se `total_conversas = 0`:**
- ✅ Normal se subconta é nova
- ⚠️ Problema se subconta já recebeu mensagens

**Se `conversas_sem_company_id > 0`:**
- ❌ Problema: Conversas sem `company_id`
- ✅ Solução: Executar script de correção

---

### 3. Verificar Conexão WhatsApp

**Query de verificação:**
```sql
-- Verificar conexões WhatsApp por empresa
SELECT 
  c.name as company_name,
  c.is_master_account,
  wc.id as connection_id,
  wc.status,
  wc.instance_name,
  wc.whatsapp_number
FROM companies c
LEFT JOIN whatsapp_connections wc ON wc.company_id = c.id
WHERE c.status = 'active'
ORDER BY c.is_master_account DESC, c.name;
```

**Se `connection_id IS NULL`:**
- ❌ Problema: Subconta não tem conexão WhatsApp configurada
- ✅ Solução: Executar script de correção (cria conexão vazia)

**Se `status = 'disconnected'`:**
- ⚠️ Normal: Usuário precisa conectar manualmente
- ✅ Verificar se Evolution API está configurada

---

### 4. Verificar Filtros por Company

**No código `Conversas.tsx`, verificar se todas as queries filtram por `company_id`:**

```typescript
// ✅ DEVE EXISTIR em todas as queries
.eq('company_id', userCompanyId)
```

**Queries que DEVEM ter filtro:**
- ✅ `conversas` → `.eq('company_id', userCompanyId)`
- ✅ `leads` → `.eq('company_id', userCompanyId)`
- ✅ `whatsapp_connections` → `.eq('company_id', userCompanyId)`
- ✅ `funis` → `.eq('company_id', userCompanyId)`

---

### 5. Verificar Realtime

**No Console do navegador, procurar por:**
- `📡 [REALTIME] userCompanyId disponível`
- `✅ [REALTIME] Canal conectado`

**Se NÃO aparecer:**
- ❌ Problema: Realtime não está funcionando
- ✅ Verificar se `userCompanyId` está disponível

---

## 🔧 CORREÇÕES AUTOMÁTICAS

### Script Criado: `20241104_corrigir_conversas_subcontas.sql`

Este script corrige automaticamente:
1. ✅ Conversas sem `company_id`
2. ✅ Empresas sem conexão WhatsApp
3. ✅ Dados de conversas inválidos
4. ✅ Permissões incorretas
5. ✅ Estruturas de dados faltando
6. ✅ Isolamento de dados

### Como Executar:

1. **Via Supabase Dashboard:**
   - Acesse **SQL Editor**
   - Cole o conteúdo do arquivo
   - Execute

2. **Via CLI:**
   ```bash
   cd ceusia-ai-hub
   supabase db push
   ```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

### Antes de Executar Script:

- [ ] Identifiquei qual é o problema específico no menu Conversas
- [ ] Verifiquei logs do console do navegador
- [ ] Verifiquei se `company_id` está sendo carregado
- [ ] Verifiquei se há conversas na subconta
- [ ] Verifiquei se conexão WhatsApp está configurada

### Após Executar Script:

- [ ] Script executado com sucesso
- [ ] Menu Conversas carrega sem erros
- [ ] Conversas aparecem corretamente
- [ ] Realtime funciona
- [ ] Envio de mensagens funciona

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### Problema 1: "Erro: Usuário sem empresa associada"

**Causa:** Usuário não tem `user_roles` com `company_id`

**Solução:**
```sql
-- Verificar usuário
SELECT * FROM user_roles WHERE user_id = 'ID_DO_USUARIO';

-- Se não existe, criar
INSERT INTO user_roles (user_id, company_id, role)
VALUES ('ID_DO_USUARIO', 'ID_DA_EMPRESA', 'company_admin');
```

---

### Problema 2: Conversas não aparecem

**Causa:** Conversas sem `company_id` ou filtro incorreto

**Solução:**
```sql
-- Verificar conversas
SELECT * FROM conversas WHERE company_id = 'ID_DA_EMPRESA';

-- Se não há conversas, verificar se há sem company_id
SELECT * FROM conversas WHERE company_id IS NULL;
```

---

### Problema 3: Realtime não funciona

**Causa:** `userCompanyId` não está disponível quando realtime é configurado

**Solução:**
Verificar no código se `useEffect` de realtime espera `userCompanyId`:

```typescript
// ✅ CORRETO
useEffect(() => {
  if (!userCompanyId) {
    console.log('⏳ Aguardando userCompanyId...');
    return;
  }
  // Configurar realtime...
}, [userCompanyId]);
```

---

## 📞 PRÓXIMOS PASSOS

1. ✅ **Executar** script de correção
2. ✅ **Verificar** se problemas foram resolvidos
3. ✅ **Testar** em pelo menos 2 subcontas diferentes
4. ✅ **Documentar** problemas encontrados
5. ✅ **Aplicar** melhorias futuras para todas as empresas

---

**Última Atualização:** 2024-11-04  
**Status:** 🔧 Aguardando execução e verificação

