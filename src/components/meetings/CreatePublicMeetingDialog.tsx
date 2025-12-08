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
import { Link2, Copy, Check, Video, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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

  const createPublicMeeting = async () => {
    setIsCreating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Get company_id
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole) {
        toast.error('Empresa não encontrada');
        return;
      }

      // Get user name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      // Create meeting
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          company_id: userRole.company_id,
          created_by: user.id,
          meeting_type: 'external',
          call_type: 'video',
          status: 'pending',
          participants: [user.id],
          participant_names: [profile?.full_name || 'Anfitrião'],
        })
        .select()
        .single();

      if (error) throw error;

      // Generate public link
      const publicLink = `${window.location.origin}/meeting/${meeting.id}`;
      
      // Update meeting with public link
      await supabase
        .from('meetings')
        .update({ public_link: publicLink })
        .eq('id', meeting.id);

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
    if (meetingId) {
      // Open in new tab for host
      window.open(meetingLink, '_blank');
    }
  };

  const handleClose = () => {
    setMeetingLink('');
    setMeetingId('');
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Criar Sala Pública
          </DialogTitle>
          <DialogDescription>
            Crie uma sala de reunião e compartilhe o link com participantes externos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {!meetingLink ? (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <p className="text-muted-foreground mb-6">
                Crie uma sala de reunião para convidar participantes externos.
                Eles poderão entrar apenas digitando o nome.
              </p>
              <Button onClick={createPublicMeeting} disabled={isCreating} className="w-full">
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando sala...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Criar Sala
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Sala criada com sucesso!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Compartilhe o link abaixo com os participantes
                </p>
              </div>

              <div className="space-y-2">
                <Label>Link da Reunião</Label>
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
                  <ExternalLink className="h-4 w-4 ml-2" />
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
