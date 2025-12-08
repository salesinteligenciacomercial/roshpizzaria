import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Phone, Video, Search, Loader2 } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface StartCallDialogProps {
  open: boolean;
  onClose: () => void;
  onStartCall: (userId: string, userName: string, callType: 'audio' | 'video') => void;
}

export const StartCallDialog = ({
  open,
  onClose,
  onStartCall,
}: StartCallDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadTeamMembers();
    }
  }, [open]);

  const loadTeamMembers = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get user's company
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRole) return;

      // Get all users from same company
      const { data: companyRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', userRole.company_id);

      if (!companyRoles) return;

      const userIds = companyRoles
        .map(r => r.user_id)
        .filter(id => id !== user.id);

      if (userIds.length === 0) {
        setTeamMembers([]);
        return;
      }

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      setTeamMembers(profiles || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = teamMembers.filter(member =>
    member.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar Chamada</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-72">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum membro da equipe'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-primary">
                          {member.full_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{member.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onStartCall(member.id, member.full_name, 'audio')}
                      title="Chamada de áudio"
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="icon"
                      onClick={() => onStartCall(member.id, member.full_name, 'video')}
                      title="Chamada de vídeo"
                    >
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
