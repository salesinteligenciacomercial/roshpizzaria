import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle, XCircle, Edit2, Lightbulb, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Json } from "@/integrations/supabase/types";

interface Suggestion {
  id: string;
  title: string;
  suggestion_type: string;
  status: string;
  details: Json;
  created_at: string;
  approved: boolean;
}

interface SugestoesIAListProps {
  suggestions: Suggestion[];
  onRefresh: () => void;
}

const typeLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  playbook: { label: "Playbook", icon: <Lightbulb className="h-4 w-4" />, color: "bg-blue-500" },
  rotina: { label: "Rotina", icon: <Lightbulb className="h-4 w-4" />, color: "bg-purple-500" },
  etapa: { label: "Etapa", icon: <Lightbulb className="h-4 w-4" />, color: "bg-green-500" },
  melhoria: { label: "Melhoria", icon: <AlertTriangle className="h-4 w-4" />, color: "bg-orange-500" }
};

export function SugestoesIAList({ suggestions, onRefresh }: SugestoesIAListProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ai_process_suggestions')
        .update({ 
          status: 'approved', 
          approved: true,
          approved_at: new Date().toISOString(),
          approved_by: userData.user?.id
        })
        .eq('id', id);

      if (error) throw error;

      toast({ title: "Sugestão aprovada e aplicada!" });
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao aprovar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('ai_process_suggestions')
        .update({ 
          status: 'rejected',
          rejected_reason: rejectReason || null
        })
        .eq('id', rejectingId);

      if (error) throw error;

      toast({ title: "Sugestão rejeitada" });
      setRejectingId(null);
      setRejectReason("");
      onRefresh();
    } catch (error: any) {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const processedSuggestions = suggestions.filter(s => s.status !== 'pending');

  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma sugestão pendente</p>
        <p className="text-sm">A IA analisará seus processos e fará sugestões de melhoria</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Pending Suggestions */}
        {pendingSuggestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Badge variant="destructive">{pendingSuggestions.length}</Badge>
              Sugestões Pendentes
            </h3>
            <div className="grid gap-4">
              {pendingSuggestions.map((suggestion) => {
                const typeInfo = typeLabels[suggestion.suggestion_type] || 
                  { label: suggestion.suggestion_type, icon: <Lightbulb className="h-4 w-4" />, color: "bg-gray-500" };
                const details = suggestion.details as Record<string, any> || {};
                
                return (
                  <Card key={suggestion.id} className="border-border/50 border-l-4 border-l-cyan-500">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-cyan-500/10">
                            <Brain className="h-5 w-5 text-cyan-500" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{suggestion.title}</CardTitle>
                            <Badge className={`${typeInfo.color} text-white text-xs mt-1`}>
                              {typeInfo.label}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {details.description && (
                        <p className="text-sm text-muted-foreground">{details.description}</p>
                      )}
                      {details.suggestedContent && (
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs font-medium mb-1">Conteúdo sugerido:</p>
                          <p className="text-sm">{details.suggestedContent}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          className="gap-1"
                          onClick={() => handleApprove(suggestion.id)}
                          disabled={loading}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar e Aplicar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setRejectingId(suggestion.id)}
                          disabled={loading}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Edit2 className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Processed Suggestions */}
        {processedSuggestions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-muted-foreground">Histórico</h3>
            <div className="grid gap-3">
              {processedSuggestions.map((suggestion) => (
                <Card key={suggestion.id} className="border-border/50 opacity-60">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{suggestion.title}</CardTitle>
                      <Badge variant={suggestion.status === 'approved' ? 'default' : 'secondary'}>
                        {suggestion.status === 'approved' ? 'Aprovada' : 'Rejeitada'}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={() => setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Sugestão</DialogTitle>
            <DialogDescription>
              Opcionalmente, informe o motivo da rejeição para ajudar a IA a melhorar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Motivo da rejeição (opcional)"
              className="min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectingId(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={loading}>
                {loading ? "Rejeitando..." : "Confirmar Rejeição"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
