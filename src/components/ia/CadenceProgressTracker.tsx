import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Play, 
  Pause, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Phone, 
  Mail,
  Instagram,
  ArrowRight,
  User,
  Calendar,
  RefreshCw,
  Plus,
  Flame,
  Sun,
  Snowflake
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CadenceProgress {
  id: string;
  lead_id: string;
  company_id: string;
  cadence_name: string;
  current_step: number;
  total_steps: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  started_at: string;
  completed_at: string | null;
  completed_steps: any[];
  next_action_at: string | null;
  next_action_channel: string | null;
  next_action_description: string | null;
  assigned_to: string | null;
  leads?: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
}

interface LeadOption {
  id: string;
  name: string;
  phone?: string;
  temperature?: string;
}

const CADENCE_TEMPLATES = [
  {
    name: "Cadência Frio → Morno",
    description: "Para leads sem engajamento recente",
    steps: 7,
    duration: "14 dias"
  },
  {
    name: "Cadência Morno → Quente",
    description: "Para leads com interesse moderado",
    steps: 5,
    duration: "7 dias"
  },
  {
    name: "Cadência Quente → Fechamento",
    description: "Para leads prontos para comprar",
    steps: 4,
    duration: "5 dias"
  },
  {
    name: "Reengajamento",
    description: "Para leads que esfriaram",
    steps: 5,
    duration: "10 dias"
  }
];

export const CadenceProgressTracker: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [cadences, setCadences] = useState<CadenceProgress[]>([]);
  const [availableLeads, setAvailableLeads] = useState<LeadOption[]>([]);
  const [showNewCadence, setShowNewCadence] = useState(false);
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [companyId, setCompanyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!userRole?.company_id) return;
      setCompanyId(userRole.company_id);

      // Buscar cadências ativas
      const { data: cadenceData } = await supabase
        .from("lead_cadence_progress")
        .select(`
          *,
          leads:lead_id (id, name, phone, email)
        `)
        .eq("company_id", userRole.company_id)
        .in("status", ["active", "paused"])
        .order("next_action_at", { ascending: true });

      setCadences((cadenceData || []) as unknown as CadenceProgress[]);

      // Buscar leads disponíveis (sem cadência ativa)
      const { data: leadsData } = await supabase
        .from("leads")
        .select("id, name, phone")
        .eq("company_id", userRole.company_id)
        .limit(100);

      const { data: activeCadenceLeads } = await supabase
        .from("lead_cadence_progress")
        .select("lead_id")
        .eq("company_id", userRole.company_id)
        .eq("status", "active");

      const activeCadenceLeadIds = new Set(activeCadenceLeads?.map(c => c.lead_id) || []);
      const availableLeadsFiltered = (leadsData || []).filter(l => !activeCadenceLeadIds.has(l.id));
      
      setAvailableLeads(availableLeadsFiltered);

    } catch (error) {
      console.error("[CadenceProgressTracker] Erro:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Realtime subscription
    const channel = supabase
      .channel("cadence-progress")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lead_cadence_progress" },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  const startCadence = async () => {
    if (!selectedLead || !selectedTemplate || !companyId) {
      toast.error("Selecione um lead e uma cadência");
      return;
    }

    const template = CADENCE_TEMPLATES.find(t => t.name === selectedTemplate);
    if (!template) return;

    try {
      const { error } = await supabase
        .from("lead_cadence_progress")
        .insert({
          lead_id: selectedLead,
          company_id: companyId,
          cadence_name: template.name,
          current_step: 1,
          total_steps: template.steps,
          status: "active",
          next_action_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas
          next_action_channel: "whatsapp",
          next_action_description: "Primeira mensagem de contato",
        });

      if (error) throw error;

      toast.success("Cadência iniciada!");
      setShowNewCadence(false);
      setSelectedLead("");
      setSelectedTemplate("");
      loadData();
    } catch (error) {
      console.error("Erro ao iniciar cadência:", error);
      toast.error("Erro ao iniciar cadência");
    }
  };

  const updateCadenceStatus = async (cadenceId: string, status: 'active' | 'paused' | 'completed' | 'cancelled') => {
    try {
      const updateData: any = { status };
      if (status === 'completed' || status === 'cancelled') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("lead_cadence_progress")
        .update(updateData)
        .eq("id", cadenceId);

      if (error) throw error;

      toast.success(status === 'paused' ? "Cadência pausada" : 
                   status === 'completed' ? "Cadência concluída!" : 
                   status === 'cancelled' ? "Cadência cancelada" : "Cadência retomada");
      loadData();
    } catch (error) {
      toast.error("Erro ao atualizar cadência");
    }
  };

  const advanceStep = async (cadence: CadenceProgress) => {
    const newStep = cadence.current_step + 1;
    const isComplete = newStep > cadence.total_steps;

    try {
      if (isComplete) {
        await updateCadenceStatus(cadence.id, 'completed');
      } else {
        const { error } = await supabase
          .from("lead_cadence_progress")
          .update({
            current_step: newStep,
            completed_steps: [...(cadence.completed_steps || []), {
              step: cadence.current_step,
              completed_at: new Date().toISOString(),
            }],
            next_action_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // +1 dia
          })
          .eq("id", cadence.id);

        if (error) throw error;
        toast.success(`Passo ${cadence.current_step} concluído!`);
        loadData();
      }
    } catch (error) {
      toast.error("Erro ao avançar step");
    }
  };

  const getChannelIcon = (channel: string | null) => {
    switch (channel) {
      case "whatsapp": return <MessageSquare className="h-4 w-4 text-green-500" />;
      case "call": return <Phone className="h-4 w-4 text-blue-500" />;
      case "email": return <Mail className="h-4 w-4 text-purple-500" />;
      case "instagram": return <Instagram className="h-4 w-4 text-pink-500" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active": return <Badge className="bg-green-100 text-green-800">Ativa</Badge>;
      case "paused": return <Badge className="bg-yellow-100 text-yellow-800">Pausada</Badge>;
      case "completed": return <Badge className="bg-blue-100 text-blue-800">Concluída</Badge>;
      case "cancelled": return <Badge className="bg-gray-100 text-gray-800">Cancelada</Badge>;
      default: return null;
    }
  };

  const isOverdue = (nextActionAt: string | null) => {
    if (!nextActionAt) return false;
    return isPast(new Date(nextActionAt));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Cadências Ativas
            </CardTitle>
            <CardDescription>
              Gerencie o progresso das cadências de vendas
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={showNewCadence} onOpenChange={setShowNewCadence}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Cadência
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Iniciar Nova Cadência</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selecione o Lead</label>
                    <Select value={selectedLead} onValueChange={setSelectedLead}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um lead..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLeads.map(lead => (
                          <SelectItem key={lead.id} value={lead.id}>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {lead.name}
                              {lead.phone && <span className="text-muted-foreground text-xs">({lead.phone})</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de Cadência</label>
                    <div className="grid gap-2">
                      {CADENCE_TEMPLATES.map(template => (
                        <div
                          key={template.name}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedTemplate === template.name 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedTemplate(template.name)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{template.name}</p>
                              <p className="text-sm text-muted-foreground">{template.description}</p>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">{template.steps} passos</Badge>
                              <p className="text-xs text-muted-foreground mt-1">{template.duration}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full" onClick={startCadence} disabled={!selectedLead || !selectedTemplate}>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Cadência
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-4">
            {cadences.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma cadência ativa</p>
                <p className="text-sm">Clique em "Nova Cadência" para começar</p>
              </div>
            ) : (
              cadences.map(cadence => (
                <div
                  key={cadence.id}
                  className={`p-4 rounded-lg border ${
                    isOverdue(cadence.next_action_at) && cadence.status === 'active'
                      ? 'border-red-200 bg-red-50/50'
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{cadence.leads?.name || "Lead"}</span>
                        {getStatusBadge(cadence.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{cadence.cadence_name}</p>
                    </div>
                    <div className="flex gap-1">
                      {cadence.status === 'active' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateCadenceStatus(cadence.id, 'paused')}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => advanceStep(cadence)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                        </>
                      )}
                      {cadence.status === 'paused' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateCadenceStatus(cadence.id, 'active')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateCadenceStatus(cadence.id, 'cancelled')}
                      >
                        <XCircle className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Passo {cadence.current_step} de {cadence.total_steps}</span>
                      <span>{Math.round((cadence.current_step / cadence.total_steps) * 100)}%</span>
                    </div>
                    <Progress value={(cadence.current_step / cadence.total_steps) * 100} />
                  </div>

                  {/* Next Action */}
                  {cadence.status === 'active' && cadence.next_action_at && (
                    <div className={`flex items-center gap-2 text-sm p-2 rounded ${
                      isOverdue(cadence.next_action_at) 
                        ? 'bg-red-100 text-red-800' 
                        : 'bg-muted'
                    }`}>
                      {getChannelIcon(cadence.next_action_channel)}
                      <span className="flex-1">
                        {cadence.next_action_description || "Próxima ação"}
                      </span>
                      <Clock className="h-4 w-4" />
                      <span>
                        {isOverdue(cadence.next_action_at) 
                          ? `Atrasado há ${formatDistanceToNow(new Date(cadence.next_action_at), { locale: ptBR })}`
                          : formatDistanceToNow(new Date(cadence.next_action_at), { locale: ptBR, addSuffix: true })
                        }
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
