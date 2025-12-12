import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Edit2, Trash2, Clock, CheckCircle, ArrowRight } from "lucide-react";
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

interface Stage {
  id: string;
  stage_name: string;
  stage_order: number;
  objectives: string | null;
  max_time_hours: number | null;
  checklist: Json;
  dos_and_donts: Json;
  created_at: string;
}

interface EtapasListProps {
  stages: Stage[];
  onRefresh: () => void;
}

export function EtapasList({ stages, onRefresh }: EtapasListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!deleteId) return;

    const { error } = await supabase
      .from('processes_stages')
      .delete()
      .eq('id', deleteId);

    if (error) {
      toast({ title: "Erro ao excluir", variant: "destructive" });
    } else {
      toast({ title: "Etapa excluída" });
      onRefresh();
    }
    setDeleteId(null);
  };

  if (stages.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma etapa configurada ainda</p>
        <p className="text-sm">Clique em "Nova Etapa" para configurar seu processo comercial</p>
      </div>
    );
  }

  const sortedStages = [...stages].sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));

  return (
    <>
      {/* Visual Flow */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4">
        {sortedStages.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <div className="flex flex-col items-center min-w-[120px]">
              <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <span className="text-xs mt-1 text-center font-medium">{stage.stage_name}</span>
            </div>
            {index < sortedStages.length - 1 && (
              <ArrowRight className="h-5 w-5 text-muted-foreground mx-2" />
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        {sortedStages.map((stage) => {
          const checklist = Array.isArray(stage.checklist) ? stage.checklist : [];
          const dosAndDonts = stage.dos_and_donts as { dos?: string[]; donts?: string[] } || {};
          
          return (
            <Card key={stage.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                      {stage.stage_order}
                    </div>
                    <div>
                      <CardTitle className="text-base">{stage.stage_name}</CardTitle>
                      {stage.max_time_hours && (
                        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs">Máximo: {stage.max_time_hours}h</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(stage.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {stage.objectives && (
                  <p className="text-sm text-muted-foreground">{stage.objectives}</p>
                )}
                
                {checklist.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Checklist
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {checklist.slice(0, 3).map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {String(item)}
                        </Badge>
                      ))}
                      {checklist.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{checklist.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-4 text-xs">
                  {dosAndDonts.dos && dosAndDonts.dos.length > 0 && (
                    <span className="text-green-600">✓ {dosAndDonts.dos.length} do's</span>
                  )}
                  {dosAndDonts.donts && dosAndDonts.donts.length > 0 && (
                    <span className="text-red-600">✗ {dosAndDonts.donts.length} don'ts</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A etapa será removida permanentemente.
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
