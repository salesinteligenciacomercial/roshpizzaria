
# Plano de Melhorias para o Menu Agenda

## Resumo das Funcionalidades

Este plano implementa duas melhorias principais para o menu Agenda:

1. **Seletor de Profissional**: Permitir escolher manualmente o profissional responsavel pelo compromisso
2. **Agendar Retorno**: Botao para agendar consulta de retorno com dados pre-preenchidos do paciente

---

## Fase 1: Migracao de Banco de Dados

Adicionar campo para rastrear historico de retornos:

```sql
ALTER TABLE public.compromissos 
ADD COLUMN IF NOT EXISTS compromisso_origem_id UUID REFERENCES public.compromissos(id);

CREATE INDEX IF NOT EXISTS idx_compromissos_origem 
ON public.compromissos(compromisso_origem_id);

COMMENT ON COLUMN public.compromissos.compromisso_origem_id IS 
'ID do compromisso original para rastreamento de retornos';
```

---

## Fase 2: Novo Componente - ProfissionalSelector

Criar componente reutilizavel para selecao de profissional:

**Arquivo**: `src/components/agenda/ProfissionalSelector.tsx`

**Funcionalidades**:
- Dropdown com lista de profissionais ativos da empresa
- Exibicao de nome e especialidade
- Opcao "Nenhum profissional" para deixar vazio
- Sincronizacao com agenda selecionada (sugestao automatica)

**Interface Visual**:
```text
+-------------------------------------------+
| Profissional Responsavel                  |
| [v] Dr. Joao Silva - Cardiologista        |
+-------------------------------------------+
|  > Nenhum profissional                    |
|  > Dr. Maria Santos - Clinico Geral       |
|  > Dr. Carlos Oliveira - Dermatologista   |
+-------------------------------------------+
```

---

## Fase 3: Novo Componente - AgendarRetornoDialog

Criar modal para agendar retornos:

**Arquivo**: `src/components/agenda/AgendarRetornoDialog.tsx`

**Funcionalidades**:
- Pre-preencher dados do paciente/lead do compromisso original
- Botoes de selecao rapida: 7, 15, 30, 60, 90 dias
- Manter mesma agenda e profissional (configuravel)
- Opcao de alterar horario (sugere mesmo horario original)
- Checkbox para notificar paciente via WhatsApp
- Vincular ao compromisso original via `compromisso_origem_id`

**Interface Visual**:
```text
+-----------------------------------------------------------+
| AGENDAR RETORNO - Joao da Silva                           |
+-----------------------------------------------------------+
| Paciente: Joao da Silva (preenchido automaticamente)      |
| Telefone: (11) 99999-0000                                  |
|                                                            |
| Retorno em:                                                |
| [7 dias] [15 dias] [30 dias] [60 dias] [90 dias]          |
| [ Personalizar data ]                                      |
|                                                            |
| Data sugerida: 26/02/2026                                  |
| Horario: [v] 14:00 (mesmo horario)                         |
|                                                            |
| Tipo de servico: [v] Retorno                               |
| Agenda: [v] Consultorio Dr. Silva                          |
| Profissional: [v] Dr. Joao Silva                           |
|                                                            |
| [ ] Notificar paciente sobre agendamento                   |
|                                                            |
| [Cancelar]                      [Agendar Retorno]          |
+-----------------------------------------------------------+
```

---

## Fase 4: Integracao nos Componentes Existentes

### 4.1 EditarCompromissoDialog.tsx

Modificacoes:
- Adicionar `ProfissionalSelector` apos o campo de Agenda
- Carregar lista de profissionais ao abrir dialog
- Sincronizar com agenda selecionada (quando trocar agenda, sugerir profissional)
- Adicionar botao "Agendar Retorno" no rodape do dialog

**Codigo a adicionar**:
```typescript
// Novo estado para profissional
const [profissionalId, setProfissionalId] = useState(compromisso.profissional_id || "");
const [profissionais, setProfissionais] = useState<Profissional[]>([]);

// Carregar profissionais
const loadProfissionais = async () => {
  const { data } = await supabase
    .from('profissionais')
    .select('id, nome, especialidade')
    .order('nome');
  setProfissionais(data || []);
};
```

### 4.2 Agenda.tsx

Modificacoes:
- Adicionar `ProfissionalSelector` no formulario de novo compromisso
- Adicionar estado `profissional_id` no `formData`
- Atualizar funcao `criarCompromisso` para incluir `profissional_id`
- Adicionar botao "Agendar Retorno" nos cards de compromisso
- Adicionar tipo "Retorno" na lista de tipos de servico

**Botao de retorno nos cards**:
```typescript
// Adicionar apos botao de duplicar
<AgendarRetornoDialog 
  compromissoOriginal={compromisso}
  onRetornoAgendado={carregarCompromissos}
/>
```

---

## Fase 5: Logica de Sincronizacao

### Prioridade de Profissional:

1. Se usuario selecionar profissional manualmente -> usar esse
2. Se nao, e agenda tiver `responsavel_id` -> usar responsavel da agenda
3. Se nao -> deixar `profissional_id` como null

### Fluxo de Retorno:

1. Usuario clica em "Agendar Retorno" no compromisso
2. Modal abre com dados pre-preenchidos
3. Usuario seleciona intervalo de dias ou data customizada
4. Sistema sugere horarios disponiveis
5. Usuario confirma e retorno e criado com `compromisso_origem_id` vinculado
6. Opcionalmente, paciente recebe notificacao WhatsApp

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/components/agenda/ProfissionalSelector.tsx` | Componente dropdown para selecao de profissional |
| `src/components/agenda/AgendarRetornoDialog.tsx` | Modal para agendar retorno de consulta |

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/components/agenda/EditarCompromissoDialog.tsx` | Adicionar seletor de profissional e botao de retorno |
| `src/pages/Agenda.tsx` | Adicionar seletor de profissional no formulario e botao de retorno nos cards |

---

## Beneficios para o Segmento Medico

- **Produtividade**: Agendar retorno em segundos, sem recriar dados do paciente
- **Rastreabilidade**: Historico completo de consultas vinculadas
- **Organizacao**: Profissional responsavel claramente definido
- **Flexibilidade**: Escolher profissional independente da agenda
- **Comunicacao**: Notificacao automatica ao paciente sobre retorno

---

## Secao Tecnica

### Estrutura da Interface Compromisso (atualizada)

```typescript
interface Compromisso {
  id: string;
  agenda_id?: string;
  lead_id?: string;
  profissional_id?: string;
  usuario_responsavel_id: string;
  compromisso_origem_id?: string; // NOVO - vinculo com retorno
  data_hora_inicio: string;
  data_hora_fim: string;
  tipo_servico: string;
  status: string;
  // ... outros campos existentes
}
```

### Interface do ProfissionalSelector

```typescript
interface ProfissionalSelectorProps {
  value: string;
  onChange: (profissionalId: string) => void;
  agendaId?: string; // Para sugerir profissional da agenda
  disabled?: boolean;
}
```

### Interface do AgendarRetornoDialog

```typescript
interface AgendarRetornoDialogProps {
  compromissoOriginal: Compromisso;
  onRetornoAgendado: () => void;
  trigger?: React.ReactNode; // Botao customizado (opcional)
}
```

### Tipo de Servico "Retorno"

Adicionar "retorno" na lista de tipos de servico:
- reuniao, consultoria, atendimento, visita, apresentacao, **retorno**, outro

---

## Ordem de Implementacao

1. Migracao de banco de dados (`compromisso_origem_id`)
2. Criar `ProfissionalSelector.tsx`
3. Criar `AgendarRetornoDialog.tsx`
4. Integrar em `EditarCompromissoDialog.tsx`
5. Integrar em `Agenda.tsx`
6. Testar fluxo completo
