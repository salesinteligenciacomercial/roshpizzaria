import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Meeting } from '@/hooks/useMeetings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Video, Phone, Clock, Users, MoreVertical, 
  Trash2, FileText, Search, Loader2
} from 'lucide-react';

interface MeetingHistoryProps {
  meetings: Meeting[];
  loading: boolean;
  onAddNotes: (meetingId: string, notes: string) => void;
  onDelete: (meetingId: string) => void;
}

export const MeetingHistory = ({
  meetings,
  loading,
  onAddNotes,
  onDelete,
}: MeetingHistoryProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState('');

  const filteredMeetings = meetings.filter(meeting => 
    meeting.participant_names?.some(name => 
      name.toLowerCase().includes(searchTerm.toLowerCase())
    ) ||
    meeting.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ended':
        return <Badge variant="secondary">Encerrada</Badge>;
      case 'active':
        return <Badge className="bg-green-500">Em andamento</Badge>;
      case 'missed':
        return <Badge variant="destructive">Perdida</Badge>;
      default:
        return <Badge variant="outline">Pendente</Badge>;
    }
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '-';
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    
    if (diffMins > 0) {
      return `${diffMins}min ${diffSecs}s`;
    }
    return `${diffSecs}s`;
  };

  const openNotesDialog = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setNotes(meeting.notes || '');
  };

  const saveNotes = () => {
    if (selectedMeeting) {
      onAddNotes(selectedMeeting.id, notes);
      setSelectedMeeting(null);
      setNotes('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Histórico de Reuniões</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {filteredMeetings.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma reunião encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      meeting.call_type === 'video' ? 'bg-primary/20' : 'bg-green-500/20'
                    }`}>
                      {meeting.call_type === 'video' ? (
                        <Video className="h-5 w-5 text-primary" />
                      ) : (
                        <Phone className="h-5 w-5 text-green-600" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {meeting.participant_names?.filter(n => n !== 'Eu').join(', ') || 'Reunião'}
                        </span>
                        {getStatusBadge(meeting.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>
                          {format(new Date(meeting.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(meeting.started_at, meeting.ended_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {meeting.participants?.length || 0} participantes
                        </span>
                      </div>
                      {meeting.notes && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          📝 {meeting.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openNotesDialog(meeting)}>
                        <FileText className="h-4 w-4 mr-2" />
                        {meeting.notes ? 'Editar notas' : 'Adicionar notas'}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => onDelete(meeting.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {/* Notes Dialog */}
      <Dialog open={!!selectedMeeting} onOpenChange={() => setSelectedMeeting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas da Reunião</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Adicione notas sobre esta reunião..."
            rows={6}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMeeting(null)}>
              Cancelar
            </Button>
            <Button onClick={saveNotes}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
