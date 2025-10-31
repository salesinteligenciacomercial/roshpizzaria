import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, CheckCircle, XCircle, Clock, TrendingUp, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  recommendation_type: string; // 'product' | 'service' | 'timing' | 'followup' | 'risk'
  recommendation_data: any;
  confidence_score?: number;
  status: 'pending' | 'applied' | 'dismissed';
  created_at: string;
}

export function RecomendacoesIA() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
    
    // Realtime para novas recomendações
    const channel = supabase
      .channel('ia-recommendations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ia_recommendations'
      }, () => {
        loadRecommendations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadRecommendations = async () => {
    const { data, error } = await supabase
      .from('recommendation_engine')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Erro ao carregar recomendações:', error);
    } else {
      setRecommendations(data || []);
    }
    setLoading(false);
  };

  const handleRecommendation = async (id: string, action: 'accepted' | 'rejected') => {
    const { error } = await supabase
      .from('recommendation_engine')
      .update({
        status: action === 'accepted' ? 'applied' : 'dismissed',
        applied_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao processar recomendação');
    } else {
      toast.success(action === 'accepted' ? 'Recomendação aplicada!' : 'Recomendação rejeitada');
      loadRecommendations();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'timing': return Clock;
      case 'message': return MessageSquare;
      case 'action': return TrendingUp;
      default: return Lightbulb;
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando recomendações...</div>;
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhuma recomendação pendente no momento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTextFromRecommendation = (rec: Recommendation) => {
    const data = rec.recommendation_data || {};
    switch (rec.recommendation_type) {
      case 'timing':
        return data.message || `Enviar em ${data.suggestedHour || 'horário ideal'}`;
      case 'followup':
        return data.message || 'Realizar follow-up baseado em inatividade';
      case 'risk':
        return data.message || 'Risco de perda detectado — agir rapidamente';
      case 'product':
      case 'service':
        return data.message || `Sugerir ${data.item || 'oferta personalizada'}`;
      default:
        return data.message || 'Recomendação gerada pela IA';
    }
  };

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => {
        const Icon = getTypeIcon(rec.recommendation_type);
        
        return (
          <Card key={rec.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{getTextFromRecommendation(rec)}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      {typeof rec.confidence_score === 'number' && (
                        <Badge variant="outline">Confiança {Math.round((rec.confidence_score || 0) * 100)}%</Badge>
                      )}
                      <Badge variant="outline">
                        {rec.recommendation_type === 'timing' ? 'Momento Ideal' :
                         rec.recommendation_type === 'message' ? 'Mensagem' :
                         rec.recommendation_type === 'action' ? 'Ação' : 'Recomendação'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleRecommendation(rec.id, 'accepted')}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aplicar
                </Button>
                <Button
                  onClick={() => handleRecommendation(rec.id, 'rejected')}
                  variant="outline"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}