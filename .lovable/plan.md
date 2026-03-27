
Objetivo: corrigir o fluxo de gerar QR Code no módulo Configurações > Canais para que a instância seja criada no servidor correto e o QR exibido seja sempre válido para leitura no WhatsApp.

O que encontrei
- O frontend usa `src/components/configuracoes/WhatsAppQRCode.tsx` para chamar a função `evolution-create-instance`.
- A função `supabase/functions/evolution-create-instance/index.ts` cria a instância usando apenas os secrets globais `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`.
- Nos logs, a tentativa mais recente de criar a instância `TESTE` chegou a iniciar, mas houve timeout em um host diferente do que o sistema usa nas conexões já salvas.
- No banco, conexões existentes usam principalmente `https://waze-evolution-api.0ntuaf.easypanel.host`, enquanto o fluxo de criação está tentando usar outro host de secret. Isso explica “não gera”.
- Além disso, o frontend assume que qualquer retorno `data.qrcode` é sempre imagem PNG em base64 e força `data:image/png;base64,...`. Se a Evolution devolver QR em outro formato (ex.: string, data URI diferente, SVG/base64, ou payload textual), a UI pode mostrar um QR inválido. Isso explica “quando gera não é um QR válido”.

Plano de correção
1. Fortalecer a função `evolution-create-instance`
- Resolver URL/API key por ordem de prioridade:
  - dados já existentes da empresa/instância no banco, quando houver
  - fallback para secrets globais
- Normalizar a URL da Evolution antes de chamar a API, reaproveitando a mesma ideia de sanitização já usada em `enviar-whatsapp`.
- Adicionar timeout controlado e mensagens de erro mais claras para diferenciar:
  - servidor offline
  - host incorreto
  - resposta sem QR
  - instância já existente sem QR renovado

2. Corrigir a extração do QR na função
- Ler múltiplos formatos possíveis de retorno da Evolution:
  - `qrcode.base64`
  - `base64`
  - `qrcode`
  - `code`
  - `pairingCode`
- Se a API retornar um QR textual/em formato alternativo, transformar isso em um formato que a UI consiga renderizar corretamente, em vez de presumir PNG.
- Salvar `qr_code` e `qr_code_expires_at` na tabela `whatsapp_connections` para manter consistência e permitir reaproveitamento do QR válido.

3. Corrigir a renderização no frontend
- Criar uma pequena camada de normalização em `WhatsAppQRCode.tsx` para identificar:
  - data URI pronta
  - base64 de imagem
  - conteúdo textual de QR/pairing code
- Renderizar imagem quando vier imagem válida.
- Renderizar código alternativo/pairing code quando não vier imagem, com instrução clara para o usuário.
- Usar o `qr_code` salvo no banco ao recarregar a tela, evitando perder o QR enquanto a instância ainda está em `connecting`.

4. Ajustar o fluxo de refresh
- Fazer `refresh_qr` usar sempre a URL/API key da própria instância salva no banco.
- Se a instância já existir mas não houver QR no retorno, tentar novamente via endpoint de conexão e persistir o novo QR.
- Se a API responder sem QR e sem pairing code, retornar erro explícito em vez de “sucesso vazio”.

5. Melhorar observabilidade e UX
- Exibir mensagens mais específicas no toast:
  - “Servidor de conexão indisponível”
  - “Instância criada, mas a API não retornou QR”
  - “QR expirado, gere um novo”
- Registrar nos logs da função qual host foi usado e qual formato de QR foi recebido, sem expor segredo.
- Manter o polling de status, mas sem depender dele para exibir o QR inicial.

Arquivos a ajustar
- `supabase/functions/evolution-create-instance/index.ts`
- `src/components/configuracoes/WhatsAppQRCode.tsx`

Impacto esperado
- O botão “Gerar QR Code” vai criar a instância no servidor correto.
- O QR exibido deixará de ser inválido por erro de interpretação do formato.
- O usuário conseguirá escanear o código sem precisar configurar manualmente.
- Quando a API não devolver um QR utilizável, a tela mostrará erro real em vez de um QR quebrado.

Detalhes técnicos
```text
Problema principal
Frontend -> evolution-create-instance
              -> usa secret global com host A
Banco/conexões existentes -> usam host B
Resultado -> timeout ou QR inconsistente

Problema secundário
API retorna QR em formato variável
Frontend força "data:image/png;base64,..."
Resultado -> imagem inválida / QR ilegível
```

Validação após implementar
- Testar geração com uma nova instância no modo “Escanear QR Code”.
- Confirmar que o QR abre/renderiza corretamente e pode ser escaneado.
- Confirmar que, ao atualizar o QR, o novo código também continua válido.
- Confirmar que a conexão muda para `connected` sem precisar recarregar a página.
