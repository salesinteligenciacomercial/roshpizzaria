

# Conectar WhatsApp via QR Code Automaticamente (Sem Configuracao Manual)

## Problema Atual
Quando o usuario clica em "Gerar QR Code", o sistema gera um QR code falso (mock) e salva a conexao no banco, mas **nao cria a instancia na Evolution API** nem busca o QR code real. O usuario precisa criar manualmente a instancia na Evolution API e depois configurar API Key/URL no CRM.

## Solucao
Criar uma Edge Function que faz todo o processo automaticamente:
1. Cria a instancia na Evolution API
2. Retorna o QR Code real para escanear
3. Configura o webhook automaticamente
4. Monitora o status da conexao em tempo real

## Fluxo do Usuario (Apos Implementacao)

```text
[Usuario clica "Conectar WhatsApp"]
        |
[Digita nome da instancia]
        |
[Clica "Gerar QR Code"]
        |
[Edge Function cria instancia na Evolution API]
        |
[QR Code real aparece na tela]
        |
[Usuario escaneia com WhatsApp]
        |
[Webhook notifica CRM -> status atualiza para "connected"]
```

## Implementacao Tecnica

### 1. Nova Edge Function: `evolution-create-instance`

Responsabilidades:
- Receber `instanceName` e `companyId`
- Chamar `POST /instance/create` na Evolution API para criar a instancia com `qrcode: true`
- Configurar webhook automaticamente via `POST /webhook/set/{instance}`
- Retornar o QR Code (base64 ou pairingCode)
- Tambem suportar `GET /instance/connect/{instance}` para reconexao/refresh do QR

Endpoints Evolution API usados:
- `POST /instance/create` - Cria instancia e retorna QR
- `POST /webhook/set/{instanceName}` - Configura webhook
- `GET /instance/connectionState/{instanceName}` - Verifica status
- `GET /instance/connect/{instanceName}` - Gera novo QR para instancia existente

A Edge Function usara os secrets `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` ja configurados.

### 2. Atualizar Componente `WhatsAppQRCode.tsx`

Mudancas principais:
- Remover QR Code mock - usar QR real da Edge Function
- No modo "QR Code", chamar a edge function `evolution-create-instance` ao clicar "Gerar QR Code"
- Exibir o QR code base64 retornado pela API
- Adicionar botao "Atualizar QR Code" para gerar novo QR quando expirar
- Auto-refresh: polling a cada 15s para verificar se o WhatsApp ja foi escaneado (via `/instance/connectionState`)
- Quando status mudar para `open`/`connected`, atualizar o banco e mostrar badge verde
- Simplificar interface: no modo QR Code, o usuario so precisa digitar o nome da instancia (API URL e Key vem dos secrets)

### 3. Atualizar Webhook `webhook-conversas`

Adicionar tratamento do evento `connection.update` da Evolution API para:
- Detectar quando o WhatsApp e conectado apos escanear QR
- Atualizar automaticamente `whatsapp_connections.status` para `connected`
- Salvar o numero do WhatsApp conectado

### Resumo dos Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/evolution-create-instance/index.ts` | **Criar** - Edge Function para criar instancia e retornar QR |
| `src/components/configuracoes/WhatsAppQRCode.tsx` | **Modificar** - Usar QR real, polling de status, simplificar UX |
| `supabase/functions/webhook-conversas/index.ts` | **Modificar** - Tratar evento `connection.update` |

