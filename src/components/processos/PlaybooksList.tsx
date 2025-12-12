import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BookOpen, Edit2, Trash2, FileText } from "lucide-react";
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

interface Playbook {
  id: string;
  title: string;
  type: string;
  category: string | null;
  content: string | null;
  is_active: boolean;
  created_at: string;
}

interface PlaybooksListProps {
  playbooks: Playbook[];
  onRefresh: () => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  atendimento: { label: "Atendimento", color: "bg-blue-500" },
  prospeccao: { label: "Prospecção", color: "bg-green-500" },
  follow_up: { label: "Follow-up", color: "bg-yellow-500" },
  fechamento: { label: "Fechamento", color: "bg-purple-500" },
  objecoes: { label: "Objeções", color: "bg-orange-500" },
  pos_venda: { label: "Pós-venda", color: "bg-cyan-500" }
};

export function PlaybooksList({ playbooks, onRefresh }: PlaybooksListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from('processes_playbooks')
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
      .from('processes_playbooks')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Playbook excluído" });
      onRefresh();
    }
    setDeleteId(null);
  };

  if (playbooks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhum playbook criado ainda</p>
        <p className="text-sm">Clique em "Novo Playbook" para criar seu primeiro script</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {playbooks.map((playbook) => {
          const typeInfo = typeLabels[playbook.type] || { label: playbook.type, color: "bg-gray-500" };
          return (
            <Card key={playbook.id} className={`border-border/50 ${!playbook.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <FileText className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{playbook.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${typeInfo.color} text-white text-xs`}>
                          {typeInfo.label}
                        </Badge>
                        {playbook.category && (
                          <Badge variant="outline" className="text-xs">
                            {playbook.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={playbook.is_active}
                      onCheckedChange={() => handleToggleActive(playbook.id, playbook.is_active)}
                    />
                    <Button variant="ghost" size="icon">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(playbook.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {playbook.content && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{playbook.content}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Playbook?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O playbook será removido permanentemente.
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
