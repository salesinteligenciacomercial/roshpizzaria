

## Plano: Sala Pública Multi-Usuário no Chat Equipe

### Problema Atual
- A "Sala Pública" cria uma reunião e abre em nova aba (`window.open`)
- Não permite selecionar/convidar membros da equipe diretamente
- O `VideoCallModalV2` usado no Chat Equipe só suporta chamadas 1:1
- O `PublicMeeting` já tem suporte completo a multi-usuário (mesh WebRTC, admissão, múltiplos participantes)

### Solução

**1. Reformular o `CreatePublicMeetingDialog` para incluir seleção de membros**
- Adicionar lista de membros da equipe com checkboxes para convidar
- Campo de busca para filtrar membros
- Ao criar a sala, enviar notificação (via `meeting_signals`) para os membros selecionados
- Manter a opção de copiar link público para convidados externos

**2. Criar componente `GroupCallModal` baseado no `PublicMeeting`**
- Extrair a lógica multi-usuário do `PublicMeeting.tsx` (mesh WebRTC, admissão, grid de vídeos) em um modal reutilizável
- Este modal será aberto inline no Chat Equipe (sem abrir nova aba)
- Suporta todos os recursos: filtros de câmera, gravação, compartilhamento de tela, chat, transcrição

**3. Integrar no `ChatInterno.tsx`**
- O botão "Entrar na Sala Agora" abre o `GroupCallModal` diretamente no Chat Equipe
- Substituir o `activeCall` state para suportar chamadas em grupo (não apenas `remoteUserId` singular)
- Membros convidados recebem notificação e podem entrar clicando nela

**4. Sistema de notificação de convite**
- Usar a tabela `meeting_signals` existente para enviar convites aos membros selecionados
- O `GlobalCallListenerV2` já escuta sinais — estender para tratar convites de sala em grupo
- Membros recebem toast com botão "Entrar na Sala"

### Arquivos a Modificar/Criar

| Arquivo | Ação |
|---------|------|
| `src/components/meetings/CreatePublicMeetingDialog.tsx` | Adicionar seleção de membros e opção de entrar inline |
| `src/components/meetings/GroupCallModal.tsx` | **Novo** — modal multi-usuário baseado no PublicMeeting |
| `src/pages/ChatInterno.tsx` | Integrar GroupCallModal, atualizar estado de chamada ativa |
| `src/components/layout/GlobalCallListenerV2.tsx` | Estender para convites de sala em grupo |

### Detalhes Técnicos
- Reutiliza a arquitetura mesh WebRTC do `PublicMeeting` (já funcional para N participantes)
- Para usuários autenticados do CRM, usa `auth.uid()` como identificador (sem gerar guest ID)
- O sistema de admissão do host permanece ativo para controle de acesso
- A grid de vídeo se adapta automaticamente ao número de participantes (já implementado no PublicMeeting)

