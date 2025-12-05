import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { Loader2, UserPlus, UserMinus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { InternalConversation } from '@/hooks/useInternalChat';

interface EditGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: InternalConversation;
  currentUserId: string | null;
  onUpdateName: (conversationId: string, name: string) => Promise<boolean>;
  onAddParticipants: (conversationId: string, userIds: string[]) => Promise<boolean>;
  onRemoveParticipant: (conversationId: string, userId: string) => Promise<boolean>;
  onRefresh: () => void;
}

export const EditGroupDialog = ({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onUpdateName,
  onAddParticipants,
  onRemoveParticipant,
  onRefresh
}: EditGroupDialogProps) => {
  const [groupName, setGroupName] = useState(conversation.name || '');
  const [saving, setSaving] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedNewMembers, setSelectedNewMembers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const { getOtherMembers, loading: loadingMembers } = useTeamMembers();

  // Reset state when conversation changes
  useEffect(() => {
    setGroupName(conversation.name || '');
    setSelectedNewMembers([]);
    setShowAddMembers(false);
  }, [conversation.id, conversation.name]);

  const currentParticipantIds = conversation.participants.map(p => p.user_id);
  const availableMembers = getOtherMembers().filter(
    m => !currentParticipantIds.includes(m.id)
  );

  const handleSaveName = async () => {
    if (!groupName.trim()) {
      toast.error('Digite um nome para o grupo');
      return;
    }

    setSaving(true);
    try {
      const success = await onUpdateName(conversation.id, groupName.trim());
      if (success) {
        toast.success('Nome do grupo atualizado!');
        onRefresh();
      } else {
        toast.error('Erro ao atualizar nome');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (userId === currentUserId) {
      toast.error('Você não pode se remover do grupo');
      return;
    }

    if (conversation.participants.length <= 2) {
      toast.error('O grupo precisa ter pelo menos 2 participantes');
      return;
    }

    setRemovingUserId(userId);
    try {
      const success = await onRemoveParticipant(conversation.id, userId);
      if (success) {
        toast.success('Participante removido!');
        onRefresh();
      } else {
        toast.error('Erro ao remover participante');
      }
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleAddMembers = async () => {
    if (selectedNewMembers.length === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }

    setAddingMembers(true);
    try {
      const success = await onAddParticipants(conversation.id, selectedNewMembers);
      if (success) {
        toast.success('Participantes adicionados!');
        setSelectedNewMembers([]);
        setShowAddMembers(false);
        onRefresh();
      } else {
        toast.error('Erro ao adicionar participantes');
      }
    } finally {
      setAddingMembers(false);
    }
  };

  const toggleNewMember = (userId: string) => {
    setSelectedNewMembers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Grupo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group name */}
          <div className="space-y-2">
            <Label>Nome do grupo</Label>
            <div className="flex gap-2">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nome do grupo"
              />
              <Button
                size="icon"
                onClick={handleSaveName}
                disabled={saving || !groupName.trim() || groupName === conversation.name}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Current participants */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Participantes ({conversation.participants.length})</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddMembers(!showAddMembers)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            </div>

            <ScrollArea className="h-[180px] border rounded-lg">
              <div className="divide-y">
                {conversation.participants.map(participant => (
                  <div
                    key={participant.user_id}
                    className="flex items-center gap-3 p-3"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={participant.profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {(participant.profile?.full_name || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {participant.profile?.full_name || 'Usuário'}
                        {participant.user_id === currentUserId && (
                          <span className="text-xs text-muted-foreground ml-2">(você)</span>
                        )}
                        {participant.user_id === conversation.created_by && (
                          <span className="text-xs text-primary ml-2">(admin)</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {participant.profile?.email}
                      </p>
                    </div>
                    {participant.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveParticipant(participant.user_id)}
                        disabled={removingUserId === participant.user_id}
                      >
                        {removingUserId === participant.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Add new members section */}
          {showAddMembers && (
            <div className="space-y-2 border-t pt-4">
              <Label>Adicionar novos membros</Label>
              
              {loadingMembers ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">
                  Todos os usuários já estão no grupo
                </p>
              ) : (
                <>
                  <ScrollArea className="h-[160px] border rounded-lg">
                    <div className="divide-y">
                      {availableMembers.map(member => (
                        <button
                          key={member.id}
                          onClick={() => toggleNewMember(member.id)}
                          className={`w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left ${
                            selectedNewMembers.includes(member.id) ? 'bg-accent' : ''
                          }`}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.avatar_url || ''} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {member.full_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{member.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.email}
                            </p>
                          </div>
                          {selectedNewMembers.includes(member.id) && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddMembers(false);
                        setSelectedNewMembers([]);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddMembers}
                      disabled={addingMembers || selectedNewMembers.length === 0}
                    >
                      {addingMembers ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
                      )}
                      Adicionar ({selectedNewMembers.length})
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Close button */}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
