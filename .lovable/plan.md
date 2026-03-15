## Plano de Integração: Nvoip VoIP no Call Center do CRM

### Resumo

Integrar a API da Nvoip ([https://api.nvoip.com.br/v2](https://api.nvoip.com.br/v2)) ao módulo de Call Center existente para substituir as chamadas simuladas por ligações telefônicas reais. O CRM já possui toda a UI e lógica de estado — precisamos conectar ao backend da Nvoip.

---

### O que a API da Nvoip oferece


| Funcionalidade   | Endpoint                   | Uso no CRM                      |
| ---------------- | -------------------------- | ------------------------------- |
| Realizar chamada | `POST /v2/calls/`          | Discar para leads               |
| Consultar status | `GET /v2/calls?callId=X`   | Polling do estado em tempo real |
| Encerrar chamada | `GET /v2/endcall?callId=X` | Desligar ligação                |
| Histórico        | `GET /v2/calls/history`    | Sincronizar dados               |
| Autenticação     | `POST /v2/oauth/token`     | Token OAuth (24h validade)      |


**Estados retornados pela Nvoip:** `calling_origin`, `calling_destination`, `established`, `noanswer`, `busy`, `finished`, `failed`

---

### O que você precisa fornecer

Antes de implementar, preciso de **3 credenciais** do seu painel Nvoip:

1. **NumberSIP** (ramal/usuário SIP) — usado como `caller` nas chamadas 
2. **User Token** — para gerar o OAuth access_token
3. **Napikey** — chave de API alternativa

Essas credenciais serão armazenadas de forma segura como secrets do backend.

&nbsp;

credencias:   
  
Napikey: SkRBQU1VWllERFJrbTJGSW1YTUNpWWNiTGpBRmlSMU8=   
  
User Token: 84682144-1804-11f1-a3b7-027e3c96bf59  
  
usuario sip: 137715001

---

### Arquitetura da Integração

```text
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend   │────▶│  Edge Function   │────▶│  API Nvoip      │
│  (CRM UI)   │     │  nvoip-call      │     │  api.nvoip.com  │
│             │◀────│                  │◀────│                 │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Tabela     │
                    │  nvoip_config│
                    │  call_history│
                    └─────────────┘
```

---

### Implementação (4 etapas)

#### 1. Secrets e Configuração

- Armazenar `NVOIP_NAPIKEY` e `NVOIP_USER_TOKEN` como secrets
- Criar tabela `nvoip_config` para armazenar NumberSIP por empresa (multi-tenant)

#### 2. Edge Function `nvoip-call`

Uma única edge function com 4 ações:

- `**make-call**`: Autentica via OAuth → `POST /v2/calls/` com caller/called → retorna `callId`
- `**check-call**`: `GET /v2/calls?callId=X` → retorna estado atual e duração
- `**end-call**`: `GET /v2/endcall?callId=X` → encerra chamada
- `**get-token**`: Gerencia cache do access_token (24h validade)

#### 3. Atualizar `useCallCenter.ts`

- Substituir `simulateCallProgression()` por polling real via edge function
- A cada 2 segundos, consultar status da chamada na Nvoip
- Mapear estados Nvoip → estados do CRM:
  - `calling_origin` → `iniciando`
  - `calling_destination` → `chamando`/`tocando`
  - `established` → `conectado`
  - `noanswer`/`busy`/`failed` → `falha`
  - `finished` → `finalizado`
- Salvar `linkAudio` (gravação) no `call_history`

#### 4. Tabela `call_history` — adicionar coluna

- `nvoip_call_id` (text) — ID da chamada na Nvoip
- `recording_url` (text) — link da gravação de áudio

---

### Próximo passo

Preciso que você me forneça as credenciais da Nvoip (NumberSIP, User Token, Napikey) para que eu possa armazená-las como secrets e iniciar a implementação.