# 🔧 Guia Completo: Como Configurar o Node "Set" no N8n

## ❌ O Problema
Você está recebendo este erro:
```
"Variáveis não substituídas detectadas. Configure o node 'Set' no N8n antes de enviar."
```

**Causa**: O node "Extrair Dados" (Function) está retornando valores vazios ou variáveis não substituídas.

**Solução**: Substituir ou adicionar um node **"Set"** para mapear os dados corretamente.

---

## ✅ Solução: Configurar o Node "Set"

### Passo 1: Adicionar o Node "Set"
1. No N8n, clique no **"+"** entre o Webhook e o HTTP Request
2. Procure por **"Set"** na lista de nodes
3. Adicione o node "Set"

### Passo 2: Configurar os Campos no Node "Set"

No node "Set", adicione os seguintes campos **manualmente**:

#### Opção A: Se sua Evolution API envia dados neste formato:
```json
{
  "data": {
    "message": {
      "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
      "conversation": "Olá, gostaria de saber mais"
    },
    "pushName": "João Silva"
  }
}
```

**Configure os campos assim:**

| Nome do Campo | Tipo | Valor |
|---------------|------|-------|
| `numero` | Expression | `{{$json.data.message.key.remoteJid}}` |
| `mensagem` | Expression | `{{$json.data.message.conversation}}` |
| `nome_contato` | Expression | `{{$json.data.pushName}}` |
| `origem` | Fixed | `whatsapp` |
| `tipo_mensagem` | Fixed | `texto` |

---

#### Opção B: Se sua Evolution API envia dados neste formato:
```json
{
  "from": "5511999999999@s.whatsapp.net",
  "body": "Olá, gostaria de saber mais",
  "pushName": "João Silva"
}
```

**Configure os campos assim:**

| Nome do Campo | Tipo | Valor |
|---------------|------|-------|
| `numero` | Expression | `{{$json.from}}` |
| `mensagem` | Expression | `{{$json.body}}` |
| `nome_contato` | Expression | `{{$json.pushName}}` |
| `origem` | Fixed | `whatsapp` |
| `tipo_mensagem` | Fixed | `texto` |

---

### Passo 3: Como Descobrir o Formato Correto da Evolution API

1. **Execute o Webhook manualmente** no N8n (botão "Listen for Test Event")
2. **Envie uma mensagem** do seu WhatsApp para o número conectado
3. **Veja o payload recebido** no node Webhook Trigger
4. **Identifique os campos** onde estão:
   - Número do remetente
   - Texto da mensagem
   - Nome do contato

**Exemplo de como inspecionar:**
```json
// Se você vê isso no Webhook:
{
  "event": "messages.upsert",
  "instance": "minhainstancia",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net"
    },
    "message": {
      "conversation": "Olá"
    },
    "pushName": "Cliente"
  }
}

// Então use:
numero = {{$json.data.key.remoteJid}}
mensagem = {{$json.data.message.conversation}}
nome_contato = {{$json.data.pushName}}
```

---

### Passo 4: Remover ou Substituir o Node "Extrair Dados"

**Você tem 2 opções:**

#### Opção 1: Substituir o node "Extrair Dados" (Function) pelo "Set"
1. Delete o node "Extrair Dados" (Function)
2. Adicione o node "Set" conforme configurado acima
3. Conecte: Webhook → Set → HTTP Request

#### Opção 2: Adicionar o "Set" antes do "Extrair Dados"
1. Adicione o node "Set" **antes** do node "Extrair Dados"
2. Conecte: Webhook → Set → Extrair Dados → HTTP Request
3. (Mas a opção 1 é mais simples)

---

### Passo 5: Configurar o HTTP Request (Node Final)

No node "Enviar para CRM (Supabase)", certifique-se de usar as variáveis do node "Set":

**Body (JSON):**
```json
{
  "numero": "{{ $json.numero }}",
  "mensagem": "{{ $json.mensagem }}",
  "origem": "{{ $json.origem }}",
  "tipo_mensagem": "{{ $json.tipo_mensagem }}",
  "nome_contato": "{{ $json.nome_contato }}"
}
```

⚠️ **IMPORTANTE**: Use espaços dentro das chaves: `{{ $json.numero }}` (não `{{$json.numero}}`)

---

## 🧪 Testar a Configuração

### Teste 1: Executar Manualmente no N8n
1. Clique em "Execute Workflow"
2. No node Webhook, use este JSON de teste:
   ```json
   {
     "data": {
       "message": {
         "key": { "remoteJid": "5511999999999@s.whatsapp.net" },
         "conversation": "Teste manual"
       },
       "pushName": "Teste"
     }
   }
   ```
3. Verifique se o node "Set" está mapeando corretamente
4. Verifique se o HTTP Request retorna status 200

### Teste 2: Enviar Mensagem Real
1. Envie uma mensagem do seu WhatsApp
2. Verifique se o workflow é executado automaticamente
3. Confirme que a mensagem aparece no CRM com dados corretos

---

## ❌ Erros Comuns

### Erro: "Variáveis não substituídas detectadas"
**Causa**: O node "Set" não foi adicionado ou está configurado incorretamente.
**Solução**: Siga os passos acima e verifique os caminhos JSON.

### Erro: Campos vazios no CRM
**Causa**: Os caminhos JSON no node "Set" estão incorretos.
**Solução**: Inspecione o payload do Webhook e ajuste os caminhos.

### Erro: "Cannot read property"
**Causa**: O payload da Evolution API tem estrutura diferente.
**Solução**: Use o teste manual para ver a estrutura real e ajuste os caminhos.

---

## 📸 Exemplo Visual (Fluxo Completo)

```
┌──────────────────┐
│ Webhook Trigger  │ ← Evolution API envia dados
│  (POST /receber) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│    Set (Node)    │ ← MAPEIA os dados aqui
│                  │   numero = {{$json.data.message.key.remoteJid}}
│ - numero         │   mensagem = {{$json.data.message.conversation}}
│ - mensagem       │   nome_contato = {{$json.data.pushName}}
│ - nome_contato   │   origem = whatsapp
│ - origem         │   tipo_mensagem = texto
│ - tipo_mensagem  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  HTTP Request    │ ← Envia para Supabase
│  (POST /webhook) │   Body: {{ $json.numero }}, etc.
└──────────────────┘
```

---

## 🎉 Resultado Esperado

Após configurar corretamente:
- ✅ Status 200 no HTTP Request
- ✅ Mensagem aparece no CRM com dados reais
- ✅ Número do contato correto (não "{{$json.numero}}")
- ✅ Nome do contato correto (não "{{$json.nome_contato}}")
- ✅ Texto da mensagem correto (não "{{$json.mensagem}}")

---

## 💡 Dica Extra: Limpar Mensagens de Teste Antigas

Se você quiser remover as mensagens antigas com variáveis não substituídas do banco:

```sql
DELETE FROM conversas 
WHERE numero LIKE '%{{%' 
   OR numero LIKE '%$json%'
   OR mensagem LIKE '%{{%'
   OR mensagem LIKE '%$json%';
```

Execute no console SQL do Supabase.
