
# Módulo de Treinamento - Central de Vídeos do YouTube

## Visão Geral

Criar um novo módulo chamado **"Treinamento"** no menu lateral, onde os administradores podem organizar e disponibilizar vídeos de treinamento do YouTube para os usuários do sistema. O módulo será estruturado por **módulos/categorias** (ex: "Leads", "Conversas", "Funil de Vendas") e cada módulo terá **aulas** com links do YouTube.

## Como Funcionará

1. **Super Admin/Admin** cria módulos de treinamento (categorias)
2. **Adiciona aulas** com título, descrição e link do YouTube
3. **Usuários** acessam a área de treinamento e assistem os vídeos diretamente no sistema
4. **Progresso** pode ser rastreado (opcional)

## Estrutura de Dados

```text
Módulo de Treinamento
├── Módulo: Leads
│   ├── Aula 1: Como cadastrar leads
│   ├── Aula 2: Importação em massa
│   └── Aula 3: Segmentação por tags
├── Módulo: Conversas
│   ├── Aula 1: Enviando mensagens
│   └── Aula 2: Usando assinaturas
└── Módulo: Funil de Vendas
    ├── Aula 1: Criando etapas
    └── Aula 2: Movendo leads
```

## Componentes da Solução

### 1. Tabelas no Banco de Dados

```sql
-- Módulos de treinamento (categorias)
CREATE TABLE training_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'book',
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aulas/vídeos de cada módulo
CREATE TABLE training_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT, -- Extraído do URL para embed
  duration_minutes INTEGER,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Progresso do usuário (opcional, para rastrear quem assistiu)
CREATE TABLE training_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES training_lessons(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES companies(id) NOT NULL,
  watched_at TIMESTAMPTZ DEFAULT NOW(),
  completed BOOLEAN DEFAULT false,
  UNIQUE(user_id, lesson_id)
);
```

### 2. Interface do Sistema

#### Página Principal de Treinamento

- Lista de módulos em cards com ícones
- Cada módulo mostra quantidade de aulas
- Indicador de progresso do usuário
- Player de vídeo embarcado do YouTube

#### Área de Administração (Super Admin)

- Criar/editar/excluir módulos
- Adicionar/editar/excluir aulas
- Reordenar módulos e aulas
- Ver estatísticas de visualização

### 3. Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Treinamento.tsx` | Página principal do módulo |
| `src/components/treinamento/TrainingModuleCard.tsx` | Card de cada módulo |
| `src/components/treinamento/TrainingLessonList.tsx` | Lista de aulas de um módulo |
| `src/components/treinamento/TrainingVideoPlayer.tsx` | Player do YouTube embarcado |
| `src/components/treinamento/TrainingAdminPanel.tsx` | Painel de administração |
| `src/components/treinamento/CreateModuleDialog.tsx` | Dialog para criar módulo |
| `src/components/treinamento/CreateLessonDialog.tsx` | Dialog para criar aula |
| `src/hooks/useTraining.ts` | Hook para gerenciar dados de treinamento |

### 4. Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rota `/treinamento` |
| `src/components/layout/Sidebar.tsx` | Adicionar item "Treinamento" no menu |

## Design da Interface

### Visão do Usuário

```text
┌─────────────────────────────────────────────────────────────┐
│  📚 Central de Treinamento                                  │
│  Aprenda a usar todas as funcionalidades do sistema         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ 👥 Leads    │  │ 💬 Conversas│  │ 📊 Funil    │        │
│  │ 5 aulas    │  │ 3 aulas    │  │ 4 aulas    │        │
│  │ ████░░ 60% │  │ ██████ 100%│  │ ░░░░░░ 0%  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  Ao clicar em um módulo:                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  ▶ Player do YouTube (embed)                           ││
│  │                                                         ││
│  │  ┌────────────────────────────────────────────────────┐││
│  │  │                                                    │││
│  │  │              VÍDEO DO YOUTUBE                      │││
│  │  │                                                    │││
│  │  └────────────────────────────────────────────────────┘││
│  │                                                         ││
│  │  Lista de Aulas:                                        ││
│  │  ✅ Aula 1: Como cadastrar leads                       ││
│  │  ✅ Aula 2: Importação em massa                        ││
│  │  ⬚ Aula 3: Segmentação por tags  ← Atual              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Visão do Admin

```text
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ Gerenciar Treinamentos         [+ Novo Módulo]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 📁 Módulo: Leads                        [✏️] [🗑️]    │ │
│  │   ├─ Aula 1: Como cadastrar       [✏️] [🗑️] [↕️]    │ │
│  │   ├─ Aula 2: Importação           [✏️] [🗑️] [↕️]    │ │
│  │   └─ [+ Adicionar Aula]                              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 📁 Módulo: Conversas                    [✏️] [🗑️]    │ │
│  │   └─ [+ Adicionar Aula]                              │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Funcionalidades

### Para Usuários
- Navegar pelos módulos de treinamento
- Assistir vídeos do YouTube diretamente no sistema
- Ver progresso de conclusão
- Marcar aulas como assistidas

### Para Administradores
- Criar, editar e excluir módulos
- Adicionar aulas com links do YouTube
- Reordenar módulos e aulas (drag and drop)
- Ver relatórios de quem assistiu cada aula

## Extração do ID do YouTube

O sistema irá extrair automaticamente o ID do vídeo de URLs como:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

Função de extração:
```typescript
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
```

## RLS Policies

```sql
-- Módulos: todos da empresa podem ver, admin pode gerenciar
CREATE POLICY "Users can view training modules" ON training_modules
  FOR SELECT USING (company_id IN (SELECT company_id FROM user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Admin can manage training modules" ON training_modules
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'company_admin', 'admin')
    )
  );

-- Aulas: seguem as mesmas regras do módulo pai
-- Progresso: usuário pode ver/atualizar apenas seu próprio progresso
```

## Menu Lateral

O item será adicionado ao Sidebar com:
- **Nome:** Treinamento
- **Ícone:** GraduationCap (do lucide-react)
- **Rota:** `/treinamento`
- **menuKey:** `treinamento` (módulo básico, disponível para todos)

## Benefícios

- Centralização de todos os materiais de treinamento
- Não consome espaço no banco (apenas links do YouTube)
- Fácil de atualizar e adicionar novos conteúdos
- Rastreamento de quem assistiu as aulas
- Interface profissional e integrada ao sistema
