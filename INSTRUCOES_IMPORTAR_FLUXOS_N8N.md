# 📦 Como Importar os Fluxos N8N no CEUSIA CRM

## 🎯 Arquivos Disponíveis

1. **FLUXO_1_RECEBER_WHATSAPP_CRM.json** - Recebe mensagens do WhatsApp e salva no CRM
2. **FLUXO_2_ENVIAR_CRM_WHATSAPP.json** - Envia mensagens do CRM para o WhatsApp

---

## 📥 PASSO 1: Importar Fluxo 1 (RECEBER)

### 1.1. Importar no N8N

1. Abra o N8N
2. Clique em **"Workflows"** no menu lateral
3. Clique em **"Import from File"** (ou "Importar")
4. Selecione o arquivo **`FLUXO_1_RECEBER_WHATSAPP_CRM.json`**
5. Clique em **"Import"**

### 1.2. Configurar Webhook Evolution API

1. No N8N, clique no node **"Webhook Evolution API"**
2. Copie a **URL do Webhook** que aparece (exemplo: `https://seu-n8n.com/webhook/receber`)
3. Vá até a **Evolution API**
4. Configure o webhook para enviar mensagens para essa URL
5. Selecione os eventos: `MESSAGE_RECEIVED`, `MESSAGE_UPDATE`

### 1.3. Testar o Fluxo

1. No N8N, clique em **"Execute Workflow"** (ou "Executar")
2. O workflow ficará aguardando mensagens
3. Envie uma mensagem de teste no WhatsApp
4. Verifique se a mensagem apareceu na aba **"Conversas"** do CRM

✅ **Resultado Esperado:** Mensagem aparece no CRM com nome do contato, número e texto.

---

## 📤 PASSO 2: Importar Fluxo 2 (ENVIAR)

### 2.1. Importar no N8N

1. Abra o N8N
2. Clique em **"Workflows"** no menu lateral
3. Clique em **"Import from File"**
4. Selecione o arquivo **`FLUXO_2_ENVIAR_CRM_WHATSAPP.json`**
5. Clique em **"Import"**

### 2.2. Configurar Credenciais do Supabase

⚠️ **IMPORTANTE:** Você precisa da **SUPABASE_SERVICE_ROLE_KEY** para este fluxo.

#### Como obter a Service Role Key:

1. Entre em contato com o suporte da Lovable Cloud
2. Solicite a **Service Role Key** do seu projeto
3. Ou utilize a chave que já foi fornecida anteriormente

#### Configurar no N8N:

1. No N8N, clique no node **"Monitorar Conversas CRM"**
2. Clique em **"Select Credential"** (ou "Selecionar Credencial")
3. Clique em **"Create New"** (ou "Criar Nova")
4. Preencha:
   - **Host:** `dteppsfseusqixuppglh.supabase.co`
   - **Service Role Key:** `SUA_SERVICE_ROLE_KEY_AQUI`
5. Clique em **"Save"** (ou "Salvar")

### 2.3. Configurar Evolution API

1. No N8N, clique no node **"Enviar via Evolution API"**
2. No campo **URL**, substitua:
   - `https://SUA_EVOLUTION_API.com` → URL da sua Evolution API
   - `SUA_INSTANCIA` → Nome da sua instância
3. No campo **apikey** (dentro de Headers), substitua:
   - `SUA_API_KEY_EVOLUTION` → Sua chave API da Evolution

**Exemplo de URL correta:**
```
https://evolution.meuservidor.com/message/sendText/minha-instancia
```

### 2.4. Ativar o Fluxo

1. No N8N, clique em **"Active"** (botão de toggle no canto superior direito)
2. O workflow ficará monitorando a tabela `conversas` automaticamente

### 2.5. Testar o Envio

1. Vá até o CRM na aba **"Conversas"**
2. Digite uma mensagem para um contato
3. A mensagem deve ser enviada automaticamente via WhatsApp
4. Verifique no N8N se o workflow foi executado com sucesso

✅ **Resultado Esperado:** Mensagem é enviada do CRM para o WhatsApp do destinatário.

---

## 🔍 Como Verificar se Está Funcionando

### Fluxo 1 (RECEBER):
- ✅ Webhook do N8N recebe a mensagem da Evolution API
- ✅ Função normaliza os dados corretamente
- ✅ Mensagem aparece na aba "Conversas" do CRM

### Fluxo 2 (ENVIAR):
- ✅ N8N detecta INSERT na tabela `conversas` com `status='Enviada'`
- ✅ Função formata número para Evolution API
- ✅ HTTP Request envia mensagem via Evolution API
- ✅ Destinatário recebe a mensagem no WhatsApp

---

## 🆘 Troubleshooting

### ❌ Fluxo 1 não recebe mensagens:
1. Verifique se o webhook está configurado na Evolution API
2. Teste manualmente enviando uma requisição POST para o webhook do N8N
3. Verifique os logs do node "Normalizar Payload Evolution"

### ❌ Fluxo 2 não envia mensagens:
1. Verifique se a **Service Role Key** está correta
2. Teste o node "Monitorar Conversas CRM" manualmente
3. Verifique se a URL da Evolution API está correta
4. Verifique se a `apikey` da Evolution está correta
5. Confira os logs do node "Enviar via Evolution API"

### ❌ Mensagens aparecem vazias no CRM:
1. Verifique o formato do payload da Evolution API
2. Ajuste o código JavaScript no node "Normalizar Payload Evolution"
3. Adicione mais `console.log()` para debugar

---

## 📞 Suporte

Se precisar de ajuda:
1. Verifique os logs de cada node no N8N
2. Confira os logs da Edge Function `webhook-conversas` no Supabase
3. Entre em contato com o suporte técnico

---

## ✅ Checklist Final

### Fluxo 1 (RECEBER):
- [ ] Arquivo `FLUXO_1_RECEBER_WHATSAPP_CRM.json` importado
- [ ] Webhook configurado na Evolution API
- [ ] Testado com mensagem real do WhatsApp
- [ ] Mensagem apareceu no CRM

### Fluxo 2 (ENVIAR):
- [ ] Arquivo `FLUXO_2_ENVIAR_CRM_WHATSAPP.json` importado
- [ ] Credenciais do Supabase configuradas (Service Role Key)
- [ ] URL da Evolution API configurada
- [ ] API Key da Evolution configurada
- [ ] Workflow ativado (toggle "Active")
- [ ] Testado envio de mensagem do CRM
- [ ] Mensagem foi entregue no WhatsApp

---

🎉 **Pronto! Seu CRM agora envia e recebe mensagens do WhatsApp via N8N!**
