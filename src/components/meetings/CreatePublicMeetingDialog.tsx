import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link2, Copy, Check, Video, Loader2, Users, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { toast } from 'sonner';

interface CreatePublicMeetingDialogProps {
  open: boolean;
  onClose: () => void;
  onMeetingCreated: (meetingId: string) => void;
  onJoinMeeting?: (meetingId: string) => void;
}

export const CreatePublicMeetingDialog = ({
  open,
  onClose,
  onMeetingCreated,
  onJoinMeeting,
}: CreatePublicMeetingDialogProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');

  const { members, currentUserId } = useTeamMembers();

  const otherMembers = members.filter(m => m.id !== currentUserId);
  const filteredMembers = otherMembers.filter(m =>
    !memberSearch ||
    m.full_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectAll = () => {
    if (selectedMembers.length === otherMembers.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(otherMembers.map(m => m.id));
    }
  };

  const createPublicMeeting = async () => {
    setIsCreating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole) {
        toast.error('Empresa não encontrada');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const hostName = profile?.full_name || 'Anfitrião';

      // Create meeting
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          company_id: userRole.company_id,
          created_by: user.id,
          meeting_type: 'external',
          call_type: 'video',
          status: 'pending',
          participants: [user.id, ...selectedMembers],
          participant_names: [hostName],
        })
        .select()
        .single();

      if (error) throw error;

      const publicLink = `${window.location.origin}/meeting/${meeting.id}`;
      
      await supabase
        .from('meetings')
        .update({ public_link: publicLink })
        .eq('id', meeting.id);

      // Send invite signals to selected team members
      if (selectedMembers.length > 0) {
        const inviteSignals = selectedMembers.map(memberId => ({
          meeting_id: meeting.id,
          from_user: user.id,
          to_user: memberId,
          signal_type: 'group-room-invite',
          signal_data: {
            hostName,
            meetingId: meeting.id,
            roomType: 'group',
          },
        }));

        await supabase.from('meeting_signals').insert(inviteSignals);
        toast.success(`Convite enviado para ${selectedMembers.length} membro(s)!`);
      }

      setMeetingLink(publicLink);
      setMeetingId(meeting.id);
      onMeetingCreated(meeting.id);
      toast.success('Sala criada com sucesso!');
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error('Erro ao criar sala');
    } finally {
      setIsCreating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinMeeting = () => {
    if (meetingId && onJoinMeeting) {
      onJoinMeeting(meetingId);
      handleClose();
    }
  };

  const handleClose = () => {
    setMeetingLink('');
    setMeetingId('');
    setCopied(false);
    setSelectedMembers([]);
    setMemberSearch('');
    onClose();
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Criar Sala de Grupo
          </DialogTitle>
          <DialogDescription>
            Selecione membros da equipe para convidar e crie uma sala de vídeo em grupo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!meetingLink ? (
            <>
              {/* Member Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Convidar Membros</Label>
                  <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
                    {selectedMembers.length === otherMembers.length ? 'Desmarcar todos' : 'Selecionar todos'}
                  </Button>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar membros..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                <ScrollArea className="h-48 border rounded-md">
                  {filteredMembers.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      {memberSearch ? 'Nenhum membro encontrado' : 'Nenhum membro disponível'}
                    </div>
                  ) : (
                    <div className="p-1">
                      {filteredMembers.map((member) => (
                        <label
                          key={member.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                        >
                          <Checkbox
                            checked={selectedMembers.includes(member.id)}
                            onCheckedChange={() => toggleMember(member.id)}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{member.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                {selectedMembers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedMembers.length} membro(s) selecionado(s)
                  </p>
                )}
              </div>

              <Button onClick={createPublicMeeting} disabled={isCreating} className="w-full">
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando sala...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Criar Sala {selectedMembers.length > 0 ? `(${selectedMembers.length + 1} participantes)` : ''}
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Sala criada com sucesso!</span>
                </div>
                {selectedMembers.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Convites enviados para {selectedMembers.length} membro(s)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Link da Reunião (para convidados externos)</Label>
                <div className="flex gap-2">
                  <Input value={meetingLink} readOnly className="font-mono text-sm" />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" onClick={handleJoinMeeting}>
                  <Video className="h-4 w-4 mr-2" />
                  Entrar na Sala Agora
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleClose}>
                    Fechar
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={copyLink}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Link
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
