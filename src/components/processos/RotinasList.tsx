import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Workflow, Edit2, Trash2, MessageCircle, Phone, Mail, MessageSquare, Linkedin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Json } from "@/integrations/supabase/types";

interface Routine {
  id: string;
  name: string;
  type: string;
  channels: Json;
  steps: Json;
  is_active: boolean;
  created_at: string;
}

interface RotinasListProps {
  routines: Routine[];
  onRefresh: () => void;
}

const typeLabels: Record<string, string> = {
  prospeccao: "Prospecção",
  follow_up: "Follow-up",
  reativacao: "Reativação",
  onboarding: "Onboarding",
  pos_venda: "Pós-venda"
};

const channelIcons: Record<string, React.ReactNode> = {
  whatsapp: <MessageCircle className="h-4 w-4 text-green-500" />,
  telefone: <Phone className="h-4 w-4 text-blue-500" />,
  email: <Mail className="h-4 w-4 text-red-500" />,
  sms: <MessageSquare className="h-4 w-4 text-purple-500" />,
  linkedin: <Linkedin className="h-4 w-4 text-blue-600" />
};

export function RotinasList({ routines, onRefresh }: RotinasListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('processes_routines')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
    } else {
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from('processes_routines')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Rotina excluída" });
      onRefresh();
    }
    setDeleteId(null);
  };

  if (routines.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma rotina criada ainda</p>
        <p className="text-sm">Clique em "Nova Rotina" para criar sua primeira cadência</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {routines.map((routine) => {
          const channels = Array.isArray(routine.channels) ? routine.channels : [];
          const steps = Array.isArray(routine.steps) ? routine.steps : [];
          
          return (
            <Card key={routine.id} className={`border-border/50 ${!routine.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Workflow className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{routine.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {typeLabels[routine.type] || routine.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {steps.length} etapa{steps.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={routine.is_active}
                      onCheckedChange={() => handleToggleActive(routine.id, routine.is_active)}
                    />
                    <Button variant="ghost" size="icon">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(routine.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Canais:</span>
                  <div className="flex gap-1">
                    {channels.map((channel, idx) => (
                      <span key={idx} title={String(channel)}>
                        {channelIcons[String(channel)] || String(channel)}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Rotina?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A rotina será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
