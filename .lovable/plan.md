

## Diagnostico Completo - Problemas Identificados

Analisei os logs em tempo real e fiz testes diretos. Encontrei **3 problemas concretos** que explicam por que o envio e recebimento pararam:

---

### Problema 1: Evolution API retornando ERRO ao enviar

Os logs mostram dois tipos de erro alternando:

```text
Erro A: "Cannot read properties of undefined (reading 'onWhatsApp')"
  → A instancia "EU" no servidor evo-evolution-api NAO tem sessao WhatsApp ativa internamente

Erro B: "Unexpected token '<', '<!DOCTYPE'... is not valid JSON"
  → O servidor Evolution esta retornando uma pagina HTML em vez de JSON (API instavel)
```

Mesmo que o painel mostre "Connected", a sessao interna do WhatsApp NAO esta funcional. O erro `onWhatsApp is undefined` significa que o modulo WhatsApp dentro da instancia nao foi inicializado.

### Problema 2: Webhook NAO configurado na instancia "EU"

Os logs de `webhook-conversas` estao **completamente vazios** - nenhuma chamada recebida. Isso significa que a instancia "EU" no servidor `evo-evolution-api.0ntuaf.easypanel.host` **NAO tem o webhook configurado** para enviar eventos ao CRM.

### Problema 3: Meta API fallback falhando

Quando a Evolution falha, o sistema tenta a Meta API como fallback, mas recebe:
```text
"(#133010) Account not registered"
```
O `meta_phone_number_id` (1043086395547826) ou o `meta_access_token` configurados estao invalidos ou expirados.

---

## Plano de Correcao

### Parte 1: Acoes manuais no painel Evolution API (VOCE precisa fazer)

1. Acessar `https://evo-evolution-api.0ntuaf.easypanel.host`
2. Na instancia **EU**:
   - Clicar em **Restart** (reiniciar a instancia)
   - Se nao resolver, **desconectar** e **reconectar** escaneando o QR Code novamente
3. Configurar o **Webhook** da instancia EU:
   - **URL**: `https://dteppsfseusqixuppglh.supabase.co/functions/v1/webhook-conversas?instance=EU`
   - **Eventos**: `MESSAGES_UPSERT`, `CONNECTION_UPDATE`, `MESSAGES_UPDATE`
   - **Webhook by Events**: Ativado

### Parte 2: Melhorias no codigo (eu implemento)

1. **Atualizar CORS headers** do `enviar-whatsapp` - os headers atuais estao incompletos, o que pode causar falhas silenciosas em algumas chamadas do frontend

2. **Melhorar tratamento de erro da Evolution** - quando a API retorna HTML em vez de JSON (servidor instavel), o codigo crasha com `SyntaxError`. Vou adicionar tratamento seguro para esse caso

3. **Mensagem de erro mais clara** - quando a Evolution retorna `onWhatsApp undefined`, informar o usuario que a sessao precisa ser reiniciada no painel, em vez de mostrar erro generico

4. **Verificacao de saude do webhook** - adicionar um endpoint de teste para validar se o webhook esta configurado e funcionando

### Detalhes tecnicos das mudancas no codigo

**`supabase/functions/enviar-whatsapp/index.ts`:**
- Linha 7: Atualizar `corsHeaders` para incluir headers completos do cliente
- Funcao `sendEvolutionMessage`: Adicionar `try/catch` ao parsear JSON da resposta, tratando respostas HTML como erro de servidor instavel
- Adicionar deteccao especifica do erro `onWhatsApp` para retornar mensagem clara: "Sessao WhatsApp expirada. Reinicie a instancia no painel Evolution API"

**Nenhuma mudanca de banco de dados necessaria.**

---

## Resumo

O problema principal **NAO e de codigo** - e que:
1. A instancia "EU" precisa ser **reiniciada** no painel Evolution
2. O **webhook** precisa ser configurado na instancia EU para o CRM receber mensagens
3. As melhorias de codigo vao tornar os erros mais claros e o sistema mais resiliente

