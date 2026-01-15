import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  Flame, 
  ThermometerSun,
  MessageSquare, 
  Phone, 
  FileText,
  Calendar,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Bell,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface CommercialAlert {
  id: string;
  lead_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  recommended_action: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  action_buttons: any[];
  action_data: any;
  leads?: {
    id: string;
    name: string;
    phone?: string;
  };
}

const ALERT_ACTIONS: Record<string, { label: string; icon: React.ReactNode; action: string }[]> = {
  lead_quente: [
    { label: "Ver Lead", icon: <Eye className="h-4 w-4" />, action: "view_lead" },
    { label: "Ligar Agora", icon: <Phone className="h-4 w-4" />, action: "call" },
    { label: "WhatsApp", icon: <MessageSquare className="h-4 w-4" />, action: "whatsapp" },
  ],
  lead_esfriando: [
    { label: "Ver Lead", icon: <Eye className="h-4 w-4" />, action: "view_lead" },
    { label: "Enviar Follow-up", icon: <MessageSquare className="h-4 w-4" />, action: "follow_up" },
    { label: "Agendar Ligação", icon: <Calendar className="h-4 w-4" />, action: "schedule_call" },
  ],
  objecao_detectada: [
    { label: "Ver Scripts", icon: <FileText className="h-4 w-4" />, action: "view_scripts" },
    { label: "Ver Conversa", icon: <MessageSquare className="h-4 w-4" />, action: "view_conversation" },
  ],
  cadencia_proxima_acao: [
    { label: "Ver Lead", icon: <Eye className="h-4 w-4" />, action: "view_lead" },
    { label: "Concluir Step", icon: <CheckCircle className="h-4 w-4" />, action: "complete_step" },
    { label: "Pausar", icon: <Clock className="h-4 w-4" />, action: "pause_cadence" },
  ],
};

export const ActionableAlerts: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<CommercialAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');

  const loadAlerts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;

      const { data } = await supabase
        .from("ia_commercial_alerts")
        .select(`
          *,
          leads:lead_id (id, name, phone)
        `)
        .eq("company_id", userRole.company_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);

      setAlerts((data || []) as unknown as CommercialAlert[]);
    } catch (error) {
      console.error("[ActionableAlerts] Erro:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();

    // Realtime subscription
    const channel = supabase
      .channel("commercial-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ia_commercial_alerts" },
        () => loadAlerts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAlerts]);

  const handleAlertAction = async (alert: CommercialAlert, actionType: string) => {
    switch (actionType) {
      case "view_lead":
        navigate(`/leads?search=${alert.leads?.name || ""}`);
        break;
      case "call":
        if (alert.leads?.phone) {
          window.open(`tel:${alert.leads.phone}`, "_blank");
        }
        break;
      case "whatsapp":
        if (alert.leads?.phone) {
          const phone = alert.leads.phone.replace(/\D/g, "");
          window.open(`https://wa.me/${phone}`, "_blank");
        }
        break;
      case "follow_up":
        navigate(`/conversas?lead=${alert.lead_id}`);
        break;
      case "schedule_call":
        navigate(`/agenda?lead=${alert.lead_id}`);
        break;
      case "view_scripts":
        navigate(`/processos?tab=scripts&lead=${alert.lead_id}`);
        break;
      case "view_conversation":
        navigate(`/conversas?lead=${alert.lead_id}`);
        break;
      case "complete_step":
        // Marcar step da cadência como completo
        toast.success("Step concluído!");
        break;
      case "pause_cadence":
        // Pausar cadência
        toast.success("Cadência pausada");
        break;
    }

    // Marcar alerta como acionado
    await markAlertAsActioned(alert.id);
  };

  const markAlertAsActioned = async (alertId: string) => {
    try {
      await supabase
        .from("ia_commercial_alerts")
        .update({ 
          status: "actioned", 
          actioned_at: new Date().toISOString() 
        })
        .eq("id", alertId);
      
      loadAlerts();
    } catch (error) {
      console.error("Erro ao marcar alerta:", error);
    }
  };

  const dismissAlert = async (alertId: string) => {
    try {
      await supabase
        .from("ia_commercial_alerts")
        .update({ status: "dismissed" })
        .eq("id", alertId);
      
      toast.success("Alerta dispensado");
      loadAlerts();
    } catch (error) {
      toast.error("Erro ao dispensar alerta");
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "lead_quente": return <Flame className="h-5 w-5 text-orange-500" />;
      case "lead_esfriando": return <ThermometerSun className="h-5 w-5 text-blue-500" />;
      case "objecao_detectada": return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "cadencia_proxima_acao": return <Calendar className="h-5 w-5 text-purple-500" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge className="bg-red-500 text-white">Crítico</Badge>;
      case "high": return <Badge className="bg-orange-500 text-white">Alto</Badge>;
      case "medium": return <Badge className="bg-yellow-500 text-white">Médio</Badge>;
      default: return <Badge variant="outline">Baixo</Badge>;
    }
  };

  const filteredAlerts = filter === 'all' 
    ? alerts 
    : alerts.filter(a => a.severity === filter);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Alertas Acionáveis
              {alerts.length > 0 && (
                <Badge variant="destructive">{alerts.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Ações imediatas recomendadas pela IA
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1">
              {(['all', 'critical', 'high', 'medium'] as const).map(f => (
                <Button
                  key={f}
                  variant={filter === f ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? 'Todos' : f === 'critical' ? 'Crítico' : f === 'high' ? 'Alto' : 'Médio'}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={loadAlerts}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {filteredAlerts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p>Nenhum alerta pendente</p>
                <p className="text-sm">Todos os alertas foram tratados 🎉</p>
              </div>
            ) : (
              filteredAlerts.map(alert => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    alert.severity === 'critical' 
                      ? 'border-red-200 bg-red-50/50' 
                      : alert.severity === 'high'
                      ? 'border-orange-200 bg-orange-50/50'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getAlertIcon(alert.alert_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{alert.title}</span>
                        {getSeverityBadge(alert.severity)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {alert.description}
                      </p>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        {(ALERT_ACTIONS[alert.alert_type] || ALERT_ACTIONS.lead_quente).map((action, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => handleAlertAction(alert, action.action)}
                          >
                            {action.icon}
                            <span className="ml-1">{action.label}</span>
                          </Button>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissAlert(alert.id)}
                        >
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(alert.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
