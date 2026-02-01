
# Plano: Integrar Templates na Funcao de Disparo em Massa

## Contexto e Problema

A API oficial do WhatsApp (Meta) exige que mensagens enviadas fora da **janela de 24 horas** (quando o contato nao interagiu recentemente) utilizem **templates pre-aprovados**. O sistema atual ja tem:

- Templates sincronizados e aprovados (ex: `boas_vindas`, `teste_modelo`, `boas_vindas_abertura`)
- Edge function `enviar-whatsapp` que ja suporta envio de templates
- Interface de gerenciamento de templates funcionando

**O que falta**: Integrar a selecao de templates no modulo de "Disparo em Massa" para permitir envio de mensagens usando templates aprovados.

---

## Solucao Proposta

Modificar o componente `DisparoEmMassa.tsx` para:

1. **Adicionar modo de envio por Template**
2. **Carregar templates aprovados (status = APPROVED)**
3. **Permitir selecao de template com preview**
4. **Suporte a variaveis dinamicas** (nome do lead, etc)
5. **Enviar usando a funcao existente com parametros de template**

---

## Detalhes da Implementacao

### Alteracao 1: Novos estados e tipos

Adicionar ao componente:

```text
// Novos estados
const [useTemplate, setUseTemplate] = useState(false);
const [templates, setTemplates] = useState<Template[]>([]);
const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

// Interface Template (semelhante ao WhatsAppTemplatesManager)
interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any[];
}
```

### Alteracao 2: Funcao para carregar templates aprovados

```text
const loadApprovedTemplates = async (companyId: string) => {
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("company_id", companyId)
    .eq("status", "APPROVED")
    .order("name");
  
  setTemplates(data || []);
};
```

### Alteracao 3: Novo toggle na UI para escolher tipo de envio

Adicionar botao "Template" ao lado de "Texto", "Imagem", "Video":

```text
<Button
  variant={useTemplate ? "default" : "outline"}
  onClick={() => setUseTemplate(true)}
>
  <FileText className="h-4 w-4 mr-1" />
  Template
</Button>
```

### Alteracao 4: Seletor de template com preview

Quando `useTemplate = true`, mostrar:

1. Dropdown com templates aprovados
2. Preview do template selecionado
3. Campos para preencher variaveis (se o template tiver `{{1}}`, `{{2}}`, etc)

### Alteracao 5: Modificar funcao handleDisparo

Quando usando template:

```text
const payload = {
  numero: formattedPhone,
  company_id: companyId,
  template_name: selectedTemplate.name,
  template_language: selectedTemplate.language,
  template_components: buildTemplateComponents(selectedTemplate, lead)
};
```

### Alteracao 6: Funcao para construir componentes com variaveis

```text
const buildTemplateComponents = (template: Template, lead: Lead) => {
  // Extrair variaveis do template e substituir com dados do lead
  const components = [];
  
  // Se template tem variaveis no BODY
  const bodyComponent = template.components.find(c => c.type === "BODY");
  if (bodyComponent?.text?.includes("{{")) {
    // Mapear variaveis com dados do lead
    components.push({
      type: "body",
      parameters: [
        { type: "text", text: lead.name || "Cliente" },
        // Adicionar mais variaveis conforme necessario
      ]
    });
  }
  
  return components;
};
```

---

## Fluxo do Usuario

1. Usuario acessa "Disparo em Massa"
2. Seleciona leads usando filtros existentes
3. Clica em "Template" (novo botao)
4. Escolhe um template aprovado no dropdown
5. Ve preview do template
6. Preenche variaveis dinamicas (se houver)
7. Clica em "Enviar Disparo"
8. Sistema envia usando a edge function com parametros de template

---

## Templates Aprovados Disponiveis

Seus templates ja sincronizados e aprovados:

| Nome | Categoria | Descricao |
|------|-----------|-----------|
| `boas_vindas` | MARKETING | Template com botoes Sim/Nao |
| `boas_vindas_abertura` | MARKETING | Template com header e botoes |
| `teste_modelo` | MARKETING | Template com fluxo de navegacao |
| `hello_world` | UTILITY | Template padrao em ingles |
| `abertura_foco_em_organizao__gesto` | MARKETING | Template sobre organizacao |

---

## Arquivos a Modificar

1. **src/components/campanhas/DisparoEmMassa.tsx**
   - Adicionar novos estados para template
   - Funcao para carregar templates aprovados
   - Novo botao "Template" na UI
   - Seletor de template com preview
   - Campos para variaveis dinamicas
   - Modificar `handleDisparo` para suportar envio de templates

---

## Resultado Esperado

- Usuarios poderao fazer disparo em massa usando templates aprovados
- Contatos fora da janela de 24h receberao a mensagem normalmente
- Templates com variaveis serao preenchidos automaticamente com dados do lead
- O sistema reutiliza a edge function `enviar-whatsapp` existente
