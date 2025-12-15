import { useState, useEffect } from "react";
import { UserPlus, X, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
}

interface PageAssigneesProps {
  pageId: string;
  assignees: string[];
  onUpdate: (assignees: string[]) => void;
}

export function PageAssignees({ pageId, assignees, onUpdate }: PageAssigneesProps) {
  const [open, setOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Profile[]>([]);
  const [assignedProfiles, setAssignedProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  useEffect(() => {
    if (teamMembers.length > 0 && assignees.length > 0) {
      const profiles = teamMembers.filter(m => assignees.includes(m.id));
      setAssignedProfiles(profiles);
    } else {
      setAssignedProfiles([]);
    }
  }, [assignees, teamMembers]);

  const loadTeamMembers = async () => {
    try {
      const { data: companyData } = await supabase.rpc('get_my_company_id');
      if (!companyData) return;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('company_id', companyData);

      if (roles) {
        const userIds = roles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);
        
        setTeamMembers(profiles || []);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const toggleAssignee = async (userId: string) => {
    const newAssignees = assignees.includes(userId)
      ? assignees.filter(id => id !== userId)
      : [...assignees, userId];

    try {
      await supabase
        .from('process_pages')
        .update({ 
          properties: { 
            assignees: newAssignees 
          } 
        })
        .eq('id', pageId);

      onUpdate(newAssignees);
      toast.success(
        assignees.includes(userId) 
          ? 'Responsável removido' 
          : 'Responsável adicionado'
      );
    } catch (error) {
      toast.error('Erro ao atualizar responsáveis');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {assignedProfiles.slice(0, 3).map((profile) => (
          <Avatar key={profile.id} className="h-7 w-7 border-2 border-background">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/20 text-primary">
              {getInitials(profile.full_name)}
            </AvatarFallback>
          </Avatar>
        ))}
        {assignedProfiles.length > 3 && (
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
            +{assignedProfiles.length - 3}
          </div>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1">
            <UserPlus className="h-4 w-4" />
            {assignees.length === 0 && <span className="text-xs">Responsáveis</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar membro..." />
            <CommandList>
              <CommandEmpty>Nenhum membro encontrado</CommandEmpty>
              <CommandGroup heading="Equipe">
                {teamMembers.map((member) => (
                  <CommandItem
                    key={member.id}
                    value={member.full_name}
                    onSelect={() => toggleAssignee(member.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(member.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">{member.full_name}</span>
                    {assignees.includes(member.id) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
