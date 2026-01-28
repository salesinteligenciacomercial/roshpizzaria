

## Plano: Assinatura na Mensagem Enviada ao Cliente

### Entendimento do Pedido
Atualmente, o sistema já rastreia quem envia cada mensagem (campo `sent_by` no banco) e exibe essa informação como badge na interface. O pedido é adicionar uma **opção para incluir a assinatura no corpo da mensagem** que é enviada ao cliente, permitindo que o contato saiba exatamente quem está atendendo.

### Exemplo Prático
**Sem assinatura na mensagem:**
```
Olá! Tudo bem?
```

**Com assinatura na mensagem:**
```
Olá! Tudo bem?

- Maria Silva
```

---

### Solução Proposta

#### Componentes da Solução

1. **Toggle de Assinatura no Input** - Um botão ao lado do input que permite ativar/desativar a inclusão da assinatura
2. **Configuração Persistente** - Preferência salva no localStorage para manter entre sessões
3. **Formatação da Mensagem** - Ao enviar, se ativo, concatenar assinatura ao final

---

### Interface Proposta

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [📎] [Escreva sua mensagem...                          ] [🎤] [✓] [⚡] [➤]│
│       ↑ Textarea                                       ↑   ↑   ↑   ↑     │
│                                               Assinatura  Correção Rápidas Enviar│
└─────────────────────────────────────────────────────────────────────┘
```

Botão de assinatura:
- **Desativado**: Ícone cinza (PenLine ou Signature)
- **Ativado**: Ícone verde com fundo, indicando que assinatura será adicionada

Tooltip: "Incluir assinatura na mensagem" / "Assinatura incluída"

---

### Fluxo de Funcionamento

1. Usuário ativa o toggle de assinatura (fica verde)
2. Ao enviar mensagem, o sistema:
   - Busca o nome do usuário logado
   - Concatena ao final: `\n\n- ${nomeUsuario}`
3. Mensagem é enviada com assinatura para o cliente
4. No banco, `sent_by` continua sendo salvo normalmente
5. Preferência é salva no localStorage

---

### Detalhes Técnicos

#### Estado Novo em Conversas.tsx
```typescript
// Estado para controlar inclusão de assinatura na mensagem
const [includeSignature, setIncludeSignature] = useState<boolean>(() => {
  const saved = localStorage.getItem('waze_include_signature');
  return saved ? JSON.parse(saved) : false;
});
```

#### Modificação no handleSendMessage
```typescript
const handleSendMessage = async (content?: string, type: Message["type"] = "text") => {
  let messageContent = content || messageInput.trim();
  if (!messageContent || !selectedConv) return;
  
  // ✅ NOVO: Adicionar assinatura se habilitada (apenas para texto)
  if (includeSignature && type === "text" && userName) {
    messageContent = `${messageContent}\n\n- ${userName}`;
  }
  
  // ... resto do código existente
};
```

#### Botão na Área de Input
```tsx
{/* Botão de Assinatura */}
<Button 
  variant="outline" 
  size="icon" 
  className={`${includeSignature 
    ? 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-300 bg-blue-50/50' 
    : 'text-muted-foreground hover:text-foreground border-border'}`}
  title={includeSignature 
    ? `Assinatura ativada (${userName})` 
    : "Incluir assinatura na mensagem"}
  onClick={() => {
    const newValue = !includeSignature;
    setIncludeSignature(newValue);
    localStorage.setItem('waze_include_signature', JSON.stringify(newValue));
    toast.success(newValue 
      ? `Assinatura ativada: "- ${userName}"` 
      : "Assinatura desativada");
  }}
>
  <PenLine className="h-5 w-5" />
</Button>
```

---

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/Conversas.tsx` | Adicionar estado, botão e lógica no handleSendMessage |

---

### Comportamento Esperado

| Ação | Resultado |
|------|-----------|
| Toggle OFF + Enviar "Olá" | Cliente recebe: "Olá" |
| Toggle ON + Enviar "Olá" | Cliente recebe: "Olá\n\n- Maria Silva" |
| Toggle ON + Enviar mídia | Mídia enviada SEM assinatura (apenas texto) |
| Recarregar página | Preferência mantida (localStorage) |

---

### Considerações

- Assinatura só é adicionada em mensagens de **texto** (não faz sentido em áudio/imagem)
- A assinatura usa o `userName` já carregado no componente (nome do usuário logado)
- O campo `sent_by` continua sendo salvo normalmente no banco para rastreamento interno
- O formato `\n\n- Nome` é elegante e usado comumente em comunicações profissionais

