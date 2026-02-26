

## Análise: Funcionalidade de URA no CRM

### O que já existe

O sistema **já possui todos os componentes necessários** para implementar uma URA funcional dentro do módulo de **Fluxos de Automação**. Não é necessário criar uma nova aba.

**Componentes existentes que formam a URA:**

1. **Menu Interativo** (`interactive_menu`) - Envia opções com botões/lista ao cliente e aguarda resposta
2. **Rotear Departamento** (`route_department`) - Direciona a conversa para um departamento ou atendente específico
3. **Atribuir Responsável** (`atribuir_responsavel`) - Atribui a conversa a um usuário
4. **Condições** (`condition`) - Permite criar regras (horário, palavra-chave, tag, etc.)
5. **Gatilho "Nova Mensagem"** - Inicia o fluxo quando uma mensagem chega
6. **IA Conversacional** - Entende texto livre e roteia para a opção correta

**Backend funcional:**
- `executar-fluxo/index.ts` já processa todos esses nós incluindo `executeInteractiveMenu()` com IA para entender texto livre e `executeRouteDepartment()` que atribui conversas e limpa o estado do fluxo
- `webhook-conversas/index.ts` já detecta fluxos ativos e dispara a execução

### Problema identificado

A funcionalidade existe mas tem duas limitações que impedem uso como URA real:

1. **O campo "Departamento" é texto livre** - deveria listar departamentos/usuários reais do banco
2. **Falta vinculação Menu → Departamento por botão** - quando o menu interativo tem 3 botões, cada botão deveria poder conectar a um departamento diferente via edges do grafo, mas o sistema atualmente segue **todas** as edges de saída do menu após match

### Plano de Melhorias

#### 1. Melhorar o NodePropertiesPanel para `route_department`
- Substituir o campo texto "Departamento" por um dropdown que busca departamentos/usuários reais via `user_roles` e `profiles`
- Carregar lista de usuários da empresa para o campo "Responsável" em vez de pedir UUID manual

#### 2. Melhorar o InteractiveMenuNode com saídas por botão
- Adicionar handles de saída individuais por botão (um handle por opção do menu)
- Assim cada botão pode conectar a um nó `route_department` diferente

#### 3. Corrigir `executar-fluxo` para seguir edge do botão selecionado
- Quando o usuário seleciona um botão no menu interativo, seguir apenas a edge correspondente ao botão selecionado (usando `sourceHandle`)
- Atualmente segue **todas** as edges de saída após o match

#### 4. Adicionar template "URA de Atendimento" pré-configurado
- Um botão no FluxoAutomacaoBuilder que cria um fluxo pronto com:
  - Gatilho: Nova Mensagem
  - Menu: "Escolha o setor: 1-Vendas 2-Suporte 3-Financeiro"
  - 3x Rotear Departamento (um para cada opção)

### Arquivos a editar

- `src/components/fluxos/NodePropertiesPanel.tsx` - Dropdown de usuários reais no route_department
- `src/components/fluxos/nodes/InteractiveMenuNode.tsx` - Handles de saída por botão
- `supabase/functions/executar-fluxo/index.ts` - Seguir edge correta após seleção de botão
- `src/components/fluxos/FluxoAutomacaoBuilder.tsx` - Template URA pronto

