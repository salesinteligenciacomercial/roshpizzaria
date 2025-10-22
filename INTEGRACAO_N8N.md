# 🚀 Guia de Integração CEUSIA CRM com Evolution API + N8n

## 📋 O que foi implementado

✅ **Tabela `conversas` no Supabase** - Armazena todas as mensagens
✅ **Edge Function `webhook-conversas`** - Recebe mensagens do N8n
✅ **Interface Conversas com Realtime** - Atualiza automaticamente quando novas mensagens chegam
✅ **Sincronização bidirecional** - Enviar e receber mensagens

---

## 🔧 Configuração no N8n

### 1️⃣ Configurar Webhook de Recebimento (Evolution API → N8n → CEUSIA CRM)

**Node 1: Webhook Trigger (Evolution API)**
- Adicione um node "Webhook" no N8n
- Configure o webhook da Evolution API para enviar para este endpoint
- Dados esperados:
  ```json
  {
    "numero": "5511999999999",
    "mensagem": "Olá, gostaria de saber mais",
    "origem": "WhatsApp",
    "tipo_mensagem": "text",
    "nome_contato": "João Silva"
  }
  ```

**Node 2: HTTP Request (N8n → CEUSIA CRM)**
- **Método**: POST
- **URL**: `https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-conversas`
- **Headers**:
  ```
  Content-Type: application/json
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZXBwc2ZzZXVzcWl4dXBwZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzY0OTgsImV4cCI6MjA3NjQxMjQ5OH0.eEz5cyfwi5chae1U9S0Yt1FBwglyuVnm_Fzg9HVrV_Q
  ```
- **Body (JSON)**:
  ```json
  {
    "numero": "{{ $json.numero }}",
    "mensagem": "{{ $json.mensagem }}",
    "origem": "{{ $json.origem || 'WhatsApp' }}",
    "tipo_mensagem": "{{ $json.tipo_mensagem || 'text' }}",
    "nome_contato": "{{ $json.nome_contato }}"
  }
  ```

---

### 2️⃣ Configurar Fluxo com IA (Opcional)

**Node 3: OpenAI (Processar com IA)**
- Adicione entre o Webhook e o HTTP Request
- Configure a IA para processar a mensagem
- Responder automaticamente

**Exemplo de Fluxo Completo:**
```
Evolution API → Webhook Trigger → OpenAI → HTTP Request → CEUSIA CRM
```

---

## 🧪 Testando a Integração

### Teste 1: Enviar mensagem via N8n manualmente

Use o seguinte comando cURL para testar:

```bash
curl -X POST https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-conversas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZXBwc2ZzZXVzcWl4dXBwZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzY0OTgsImV4cCI6MjA3NjQxMjQ5OH0.eEz5cyfwi5chae1U9S0Yt1FBwglyuVnm_Fzg9HVrV_Q" \
  -d '{
    "numero": "5511999999999",
    "mensagem": "Olá! Teste de integração",
    "origem": "WhatsApp",
    "nome_contato": "Teste Cliente"
  }'
```

**Resultado esperado:**
- ✅ Status 200
- ✅ Mensagem aparece na aba "Conversas" do CRM imediatamente
- ✅ Toast de notificação "Nova mensagem recebida do WhatsApp!"

---

### Teste 2: Verificar Realtime

1. Abra a aba "Conversas" no CRM
2. Execute o comando cURL acima
3. A mensagem deve aparecer automaticamente **sem recarregar a página**

---

## 📊 Estrutura da Tabela `conversas`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único da mensagem |
| `numero` | TEXT | Número do contato (WhatsApp) |
| `mensagem` | TEXT | Conteúdo da mensagem |
| `origem` | TEXT | Canal (WhatsApp, Instagram, Facebook) |
| `status` | TEXT | Status (Recebida, Enviada, Lida) |
| `tipo_mensagem` | TEXT | Tipo (text, image, audio, pdf) |
| `midia_url` | TEXT | URL do arquivo de mídia (opcional) |
| `nome_contato` | TEXT | Nome do contato (opcional) |
| `created_at` | TIMESTAMP | Data/hora de criação |
| `updated_at` | TIMESTAMP | Data/hora de atualização |

---

## 🔐 Segurança

- ✅ RLS habilitado na tabela `conversas`
- ✅ CORS configurado na Edge Function
- ✅ Autenticação via Bearer Token

---

## 🎯 Próximos Passos

### Para integração completa com Evolution API:

1. **Gerar QR Code**
   - Criar tela de configuração em "Configurações → Integrações"
   - Botão "Conectar WhatsApp"
   - Exibir QR Code da Evolution API

2. **Webhook Evolution → N8n**
   - Configurar webhook na Evolution API
   - Endpoint: `https://seu-n8n.com/webhook/evolution`

3. **Enviar Mensagens via Evolution**
   - Criar Edge Function para enviar mensagens
   - Integrar botão "Enviar" com a Evolution API

4. **Suporte a Mídia**
   - Upload de imagens, áudios e PDFs
   - Armazenar no Supabase Storage
   - Enviar via Evolution API

---

## 📞 Suporte

Em caso de dúvidas:
- 📧 suporte@ceusia.com.br
- 💬 WhatsApp: (11) 99999-9999

---

## ✅ Checklist de Implementação

- [x] Tabela `conversas` criada
- [x] Edge Function `webhook-conversas` implementada
- [x] Interface com Realtime configurada
- [x] Salvamento de mensagens enviadas
- [ ] QR Code da Evolution API
- [ ] Envio de mensagens via Evolution
- [ ] Suporte a mídia (imagens, áudios, PDFs)
- [ ] IA Vendedora integrada
