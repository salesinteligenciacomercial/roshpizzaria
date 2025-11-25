# Correções para Suporte a Múltiplos Responsáveis no LeadCard

## Alterações Necessárias no arquivo `src/components/funil/LeadCard.tsx`:

### 1. Substituir a função `carregarResponsavel` (linhas 163-182) por:

```typescript
const carregarResponsaveis = useCallback(async () => {
  try {
    const { data: leadData } = await supabase
      .from("leads")
      .select("responsavel_id, responsaveis")
      .eq("id", lead.id)
      .maybeSingle();
    
    if (!leadData) {
      setResponsaveisNomes([]);
      setResponsaveisSelecionados([]);
      return;
    }
    
    const todosResponsaveis: string[] = [];
    if (leadData.responsavel_id) {
      todosResponsaveis.push(leadData.responsavel_id);
    }
    if (leadData.responsaveis && Array.isArray(leadData.responsaveis)) {
      leadData.responsaveis.forEach((id: string) => {
        if (!todosResponsaveis.includes(id)) {
          todosResponsaveis.push(id);
        }
      });
    }
    
    setResponsaveisSelecionados(todosResponsaveis);
    
    if (todosResponsaveis.length === 0) {
      setResponsaveisNomes([]);
      return;
    }
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", todosResponsaveis);
    
    if (profiles) {
      const nomes = profiles.map(p => p.full_name || p.email || "Sem nome");
      setResponsaveisNomes(nomes);
    }
  } catch (error) {
    console.error("Erro ao carregar responsáveis:", error);
  }
}, [lead.id]);
```

### 2. Substituir a função `atribuirResponsavel` (linhas 219-251) por:

```typescript
const atribuirResponsaveis = async () => {
  if (responsaveisSelecionados.length === 0) {
    toast.error("Selecione pelo menos um responsável");
    return;
  }

  try {
    const { data: leadData } = await supabase
      .from("leads")
      .select("company_id")
      .eq("id", lead.id)
      .single();

    const { error } = await supabase
      .from("leads")
      .update({ 
        responsaveis: responsaveisSelecionados,
        company_id: leadData?.company_id
      })
      .eq("id", lead.id);

    if (error) throw error;

    toast.success(`${responsaveisSelecionados.length} responsáveis atribuídos com sucesso`);
    setResponsavelDialogOpen(false);
    carregarResponsaveis();
    onLeadMoved?.();
  } catch (error) {
    console.error("Erro ao atribuir responsáveis:", error);
    toast.error("Erro ao atribuir responsáveis");
  }
};

const toggleResponsavel = (userId: string) => {
  setResponsaveisSelecionados(prev => {
    if (prev.includes(userId)) {
      return prev.filter(id => id !== userId);
    } else {
      return [...prev, userId];
    }
  });
};
```

### 3. Alterar a chamada no useEffect (linha 256):
```typescript
carregarResponsaveis(); // em vez de carregarResponsavel();
```

### 4. Substituir a exibição do responsável (linhas 378-386) por:

```typescript
{/* Responsáveis */}
{responsaveisNomes.length > 0 && (
  <div className="flex flex-wrap items-center gap-1 mb-1">
    {responsaveisNomes.map((nome, index) => (
      <Badge key={index} variant="outline" className="text-xs bg-primary/5 border-primary/20">
        <User className="h-2.5 w-2.5 mr-1" />
        {nome}
      </Badge>
    ))}
  </div>
)}
```

### 5. Substituir o conteúdo do Dialog (linhas 634-671) por:

```typescript
<div className="space-y-4">
  <div className="space-y-2 max-h-60 overflow-y-auto">
    {usuarios.map((usuario) => (
      <div 
        key={usuario.id} 
        className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
        onClick={() => toggleResponsavel(usuario.id)}
      >
        <input
          type="checkbox"
          checked={responsaveisSelecionados.includes(usuario.id)}
          onChange={() => toggleResponsavel(usuario.id)}
          className="h-4 w-4"
        />
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {(usuario.full_name || usuario.email).charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{usuario.full_name || usuario.email}</span>
      </div>
    ))}
  </div>

  <div className="flex gap-2">
    <Button 
      variant="outline" 
      onClick={() => setResponsavelDialogOpen(false)}
      className="flex-1"
    >
      Cancelar
    </Button>
    <Button 
      onClick={atribuirResponsaveis}
      disabled={responsaveisSelecionados.length === 0}
      className="flex-1"
    >
      Atribuir {responsaveisSelecionados.length > 0 && `(${responsaveisSelecionados.length})`}
    </Button>
  </div>
</div>
```

## Resumo:
Essas mudanças permitem:
1. Selecionar múltiplos responsáveis usando checkboxes
2. Exibir todos os responsáveis no card (não apenas um)
3. Salvar os responsáveis em um array no banco de dados
