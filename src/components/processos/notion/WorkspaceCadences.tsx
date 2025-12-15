import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Workflow, 
  Edit2, 
  Trash2, 
  Plus,
  Search,
  Eye,
  Save,
  MessageCircle, 
  Phone, 
  Mail, 
  MessageSquare, 
  Linkedin,
  Clock,
  ArrowRight
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface Step {
  day: number;
  action: string;
  channel: string;
}

interface WorkspaceCadencesProps {
  companyId: string | null;
  onSync?: () => void;
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

const allChannels = ["whatsapp", "telefone", "email", "sms", "linkedin"];

export function WorkspaceCadences({ companyId, onSync }: WorkspaceCadencesProps) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewRoutine, setViewRoutine] = useState<Routine | null>(null);
  const [editRoutine, setEditRoutine] = useState<Routine | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newRoutine, setNewRoutine] = useState<{
    name: string;
    type: string;
    channels: string[];
    steps: Step[];
  }>({ name: "", type: "prospeccao", channels: [], steps: [{ day: 1, action: "", channel: "whatsapp" }] });

  useEffect(() => {
    if (companyId) loadRoutines();
  }, [companyId]);

  const loadRoutines = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('processes_routines')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setRoutines(data || []);
    setLoading(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('processes_routines').update({ is_active: !isActive }).eq('id', id);
    loadRoutines();
    onSync?.();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('processes_routines').delete().eq('id', deleteId);
    toast.success("Cadência excluída");
    setDeleteId(null);
    loadRoutines();
    onSync?.();
  };

  const handleCreate = async () => {
    if (!companyId || !newRoutine.name.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('processes_routines').insert({
      company_id: companyId,
      owner_id: user.user?.id,
      name: newRoutine.name,
      type: newRoutine.type,
      channels: newRoutine.channels as unknown as Json,
      steps: newRoutine.steps as unknown as Json,
      is_active: true
    });
    toast.success("Cadência criada");
    setShowNew(false);
    setNewRoutine({ name: "", type: "prospeccao", channels: [], steps: [{ day: 1, action: "", channel: "whatsapp" }] });
    loadRoutines();
    onSync?.();
  };

  const handleUpdate = async () => {
    if (!editRoutine) return;
    await supabase.from('processes_routines').update({
      name: editRoutine.name,
      type: editRoutine.type,
      channels: editRoutine.channels,
      steps: editRoutine.steps
    }).eq('id', editRoutine.id);
    toast.success("Cadência atualizada");
    setEditRoutine(null);
    loadRoutines();
    onSync?.();
  };

  const addStep = () => {
    const lastDay = newRoutine.steps.length > 0 ? newRoutine.steps[newRoutine.steps.length - 1].day : 0;
    setNewRoutine(prev => ({
      ...prev,
      steps: [...prev.steps, { day: lastDay + 1, action: "", channel: "whatsapp" }]
    }));
  };

  const removeStep = (index: number) => {
    setNewRoutine(prev => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index)
    }));
  };

  const updateStep = (index: number, field: keyof Step, value: any) => {
    setNewRoutine(prev => ({
      ...prev,
      steps: prev.steps.map((s, i) => i === index ? { ...s, [field]: value } : s)
    }));
  };

  const filteredRoutines = routines.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || r.type === filterType;
    return matchesSearch && matchesType;
  });

  const getSteps = (routine: Routine): Step[] => {
    return Array.isArray(routine.steps) ? routine.steps as unknown as Step[] : [];
  };

  const getChannels = (routine: Routine): string[] => {
    return Array.isArray(routine.channels) ? routine.channels as string[] : [];
  };

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cadências..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(typeLabels).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Cadência
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredRoutines.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma cadência encontrada</p>
          <p className="text-sm">Crie sua primeira cadência para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRoutines.map((routine) => {
            const steps = getSteps(routine);
            const channels = getChannels(routine);
            return (
              <div
                key={routine.id}
                className={`bg-card border rounded-xl p-4 hover:shadow-lg transition-all ${!routine.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Workflow className="h-5 w-5 text-purple-500" />
                  </div>
                  <Switch
                    checked={routine.is_active}
                    onCheckedChange={() => handleToggleActive(routine.id, routine.is_active)}
                  />
                </div>
                
                <h3 className="font-semibold mb-2 line-clamp-1">{routine.name}</h3>
                
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[routine.type] || routine.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {steps.length} etapa{steps.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1 mb-3">
                  {channels.map((channel, idx) => (
                    <span key={idx} title={channel}>
                      {channelIcons[channel] || channel}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setViewRoutine(routine)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditRoutine(routine)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(routine.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewRoutine} onOpenChange={() => setViewRoutine(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-purple-500" />
              {viewRoutine?.name}
            </DialogTitle>
            <DialogDescription>
              {typeLabels[viewRoutine?.type || ''] || viewRoutine?.type}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Canais</h4>
              <div className="flex gap-2">
                {viewRoutine && getChannels(viewRoutine).map((channel, idx) => (
                  <Badge key={idx} variant="outline" className="flex items-center gap-1">
                    {channelIcons[channel]} {channel}
                  </Badge>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium mb-2">Etapas</h4>
              <div className="space-y-2">
                {viewRoutine && getSteps(viewRoutine).map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm font-bold">
                      D{step.day}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm">{step.action || "Sem descrição"}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {channelIcons[step.channel]} 
                        <span className="text-xs text-muted-foreground">{step.channel}</span>
                      </div>
                    </div>
                    {idx < getSteps(viewRoutine).length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Nova Cadência</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da cadência"
              value={newRoutine.name}
              onChange={(e) => setNewRoutine(prev => ({...prev, name: e.target.value}))}
            />
            
            <Select value={newRoutine.type} onValueChange={(v) => setNewRoutine(prev => ({...prev, type: v}))}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                {Object.entries(typeLabels).map(([key, val]) => (
                  <SelectItem key={key} value={key}>{val}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Canais</label>
              <div className="flex flex-wrap gap-3">
                {allChannels.map(channel => (
                  <label key={channel} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={newRoutine.channels.includes(channel)}
                      onCheckedChange={(checked) => {
                        setNewRoutine(prev => ({
                          ...prev,
                          channels: checked 
                            ? [...prev.channels, channel]
                            : prev.channels.filter(c => c !== channel)
                        }));
                      }}
                    />
                    <span className="flex items-center gap-1 text-sm">
                      {channelIcons[channel]} {channel}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Etapas</label>
                <Button type="button" variant="outline" size="sm" onClick={addStep}>
                  <Plus className="h-3 w-3 mr-1" />
                  Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {newRoutine.steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                    <Input
                      type="number"
                      min="1"
                      className="w-16"
                      placeholder="Dia"
                      value={step.day}
                      onChange={(e) => updateStep(idx, 'day', parseInt(e.target.value) || 1)}
                    />
                    <Input
                      className="flex-1"
                      placeholder="Ação (ex: Enviar mensagem de apresentação)"
                      value={step.action}
                      onChange={(e) => updateStep(idx, 'action', e.target.value)}
                    />
                    <Select value={step.channel} onValueChange={(v) => updateStep(idx, 'channel', v)}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allChannels.map(c => (
                          <SelectItem key={c} value={c}>
                            <span className="flex items-center gap-1">
                              {channelIcons[c]} {c}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {newRoutine.steps.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeStep(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
              <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-2" />Criar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cadência?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
