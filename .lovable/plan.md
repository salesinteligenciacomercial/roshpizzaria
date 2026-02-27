

## Plano: Página de Captura de Leads com IA Conversacional

### Visão Geral
Criar uma página pública de captura de leads com agente IA conversacional, customizável por empresa (logo, cores, serviços), que insere automaticamente contatos no CRM com tags de rastreamento.

### Arquitetura

```text
┌──────────────────────────────────────────────┐
│  /captura/:companyId   (Rota Pública)        │
│  ┌──────────────────────────────────────────┐ │
│  │  Header: Logo + Nome da Empresa         │ │
│  │  Hero: Título + Descrição customizáveis │ │
│  │  Seção: Serviços/Produtos (portfólio)   │ │
│  │  Chat IA: Formulário conversacional     │ │
│  │  Footer: Contato da empresa             │ │
│  └──────────────────────────────────────────┘ │
│         ↓ API: api-public-ia + api-public-leads│
│         ↓ Tag: "pagina-captura"                │
│         → Lead criado no CRM (menu Leads)      │
└──────────────────────────────────────────────┘
```

### Implementação

**1. Migração: Adicionar campos de personalização na tabela `companies`**
- `capture_page_config JSONB` — armazena: título, descrição, cor primária, URL do logo, serviços/produtos, campos do formulário IA, mensagem de boas-vindas, redes sociais, telefone/WhatsApp de contato

**2. Nova Página Pública: `src/pages/CapturaPublica.tsx`**
- Rota: `/captura/:companyId`
- Carrega config da empresa via query pública (sem auth)
- Renderiza landing page customizada com:
  - Header com logo e nome
  - Seção hero com título e CTA
  - Grid de serviços/produtos (portfólio visual)
  - Chat IA conversacional que faz perguntas definidas pela empresa
  - Ao coletar dados, chama `api-public-leads` com tag `pagina-captura`
- Totalmente responsiva e sem necessidade de login

**3. Configurador no módulo IA/Automação: `src/components/ia/CapturePageConfig.tsx`**
- Nova aba "Página de Captura" no módulo IA
- Formulário para configurar:
  - Logo e cores da marca
  - Título e descrição da página
  - Serviços/produtos para exibir
  - Perguntas que o agente IA deve fazer (ex: nome, telefone, interesse)
  - Tag automática para leads captados
  - Preview do link público + botão copiar
- Salva no campo `capture_page_config` da tabela `companies`

**4. Atualizar Edge Function `api-public-leads`**
- Adicionar suporte à origem `pagina-captura` com tag automática
- Incluir campo `capture_page_id` ou `source=pagina-captura-{companyId}` para rastreamento

**5. Atualizar `api-public-ia` para modo formulário**
- Novo parâmetro `mode=capture` que instrui a IA a seguir o roteiro de perguntas definido na config
- A IA pergunta sequencialmente as informações configuradas
- Ao coletar todos os dados, cria o lead automaticamente

**6. Rastreamento**
- Todos os leads da página de captura recebem:
  - `source: 'pagina-captura'`
  - `tags: ['pagina-captura', nome-da-empresa]`
  - `utm_source: 'capture-page'`
- No menu Leads e Analytics, filtrável por essa tag/source

**7. Registrar rota em `App.tsx`**
- Adicionar `/captura/:companyId` como rota pública (fora do MainLayout)

### Resultado
- Cada empresa terá sua página de captura personalizada com URL compartilhável
- O agente IA conversa com o visitante coletando dados definidos pela empresa
- Leads são criados automaticamente no CRM com rastreamento completo
- Gestores configuram tudo pelo módulo IA/Automação

