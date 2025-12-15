import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  GitBranch, 
  Edit2, 
  Trash2, 
  Plus,
  Search,
  Eye,
  Save,
  Clock,
  CheckCircle,
  ArrowRight,
  GripVertical
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

interface WorkspaceStagesProps {
  companyId: string | null;
  onSync?: () => void;
}

export function WorkspaceStages({ companyId, onSync }: WorkspaceStagesProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewStage, setViewStage] = useState<Stage | null>(null);
  const [editStage, setEditStage] = useState<Stage | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newStage, setNewStage] = useState({
    stage_name: "",
    objectives: "",
    max_time_hours: 24,
    checklist: [] as string[],
    dos: [] as string[],
    donts: [] as string[]
  });
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newDo, setNewDo] = useState("");
  const [newDont, setNewDont] = useState("");

  useEffect(() => {
    if (companyId) loadStages();
  }, [companyId]);

  const loadStages = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('processes_stages')
      .select('*')
      .eq('company_id', companyId)
      .order('stage_order', { ascending: true });
    setStages(data || []);
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('processes_stages').delete().eq('id', deleteId);
    toast.success("Etapa excluída");
    setDeleteId(null);
    loadStages();
    onSync?.();
  };

  const handleCreate = async () => {
    if (!companyId || !newStage.stage_name.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('processes_stages').insert({
      company_id: companyId,
      owner_id: user.user?.id,
      stage_name: newStage.stage_name,
      stage_order: stages.length + 1,
      objectives: newStage.objectives || null,
      max_time_hours: newStage.max_time_hours,
      checklist: newStage.checklist as unknown as Json,
      dos_and_donts: { dos: newStage.dos, donts: newStage.donts } as unknown as Json
    });
    toast.success("Etapa criada");
    setShowNew(false);
    setNewStage({ stage_name: "", objectives: "", max_time_hours: 24, checklist: [], dos: [], donts: [] });
    loadStages();
    onSync?.();
  };

  const handleUpdate = async () => {
    if (!editStage) return;
    await supabase.from('processes_stages').update({
      stage_name: editStage.stage_name,
      objectives: editStage.objectives,
      max_time_hours: editStage.max_time_hours,
      checklist: editStage.checklist,
      dos_and_donts: editStage.dos_and_donts
    }).eq('id', editStage.id);
    toast.success("Etapa atualizada");
    setEditStage(null);
    loadStages();
    onSync?.();
  };

  const getChecklist = (stage: Stage): string[] => {
    return Array.isArray(stage.checklist) ? stage.checklist as string[] : [];
  };

  const getDosAndDonts = (stage: Stage): { dos?: string[]; donts?: string[] } => {
    return (stage.dos_and_donts as { dos?: string[]; donts?: string[] }) || {};
  };

  const filteredStages = stages.filter(s =>
    s.stage_name.toLowerCase().includes(search.toLowerCase()) ||
    s.objectives?.toLowerCase().includes(search.toLowerCase())
  );

  const sortedStages = [...filteredStages].sort((a, b) => (a.stage_order || 0) - (b.stage_order || 0));

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar etapas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Etapa
        </Button>
      </div>

      {/* Visual Flow */}
      {sortedStages.length > 0 && (
        <div className="bg-muted/30 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {sortedStages.map((stage, index) => (
              <div key={stage.id} className="flex items-center">
                <div 
                  className="flex flex-col items-center min-w-[100px] cursor-pointer hover:opacity-80"
                  onClick={() => setViewStage(stage)}
                >
                  <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold shadow-lg">
                    {index + 1}
                  </div>
                  <span className="text-xs mt-2 text-center font-medium max-w-[90px] line-clamp-2">
                    {stage.stage_name}
                  </span>
                  {stage.max_time_hours && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {stage.max_time_hours}h
                    </span>
                  )}
                </div>
                {index < sortedStages.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-muted-foreground mx-3" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : sortedStages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma etapa encontrada</p>
          <p className="text-sm">Crie sua primeira etapa para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedStages.map((stage) => {
            const checklist = getChecklist(stage);
            const dosAndDonts = getDosAndDonts(stage);
            return (
              <div key={stage.id} className="bg-card border rounded-xl p-4 hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                      {stage.stage_order}
                    </div>
                    <div>
                      <h3 className="font-semibold line-clamp-1">{stage.stage_name}</h3>
                      {stage.max_time_hours && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Máx: {stage.max_time_hours}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {stage.objectives && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{stage.objectives}</p>
                )}

                {checklist.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium mb-1 flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Checklist
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {checklist.slice(0, 3).map((item, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {item}
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

                <div className="flex gap-4 text-xs mb-3">
                  {dosAndDonts.dos && dosAndDonts.dos.length > 0 && (
                    <span className="text-green-600">✓ {dosAndDonts.dos.length} do's</span>
                  )}
                  {dosAndDonts.donts && dosAndDonts.donts.length > 0 && (
                    <span className="text-red-600">✗ {dosAndDonts.donts.length} don'ts</span>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setViewStage(stage)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditStage(stage)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(stage.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewStage} onOpenChange={() => setViewStage(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm">
                {viewStage?.stage_order}
              </div>
              {viewStage?.stage_name}
            </DialogTitle>
            {viewStage?.max_time_hours && (
              <DialogDescription className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Tempo máximo: {viewStage.max_time_hours} horas
              </DialogDescription>
            )}
          </DialogHeader>
          
          <div className="space-y-4">
            {viewStage?.objectives && (
              <div>
                <h4 className="text-sm font-medium mb-2">Objetivos</h4>
                <p className="text-sm text-muted-foreground">{viewStage.objectives}</p>
              </div>
            )}
            
            {viewStage && getChecklist(viewStage).length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Checklist
                </h4>
                <ul className="space-y-1">
                  {getChecklist(viewStage).map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <div className="w-4 h-4 border rounded flex items-center justify-center">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {viewStage && (getDosAndDonts(viewStage).dos?.length || 0) > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-green-600">✓ O que fazer</h4>
                <ul className="space-y-1">
                  {getDosAndDonts(viewStage).dos?.map((item, idx) => (
                    <li key={idx} className="text-sm text-green-600">• {item}</li>
                  ))}
                </ul>
              </div>
            )}

            {viewStage && (getDosAndDonts(viewStage).donts?.length || 0) > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 text-red-600">✗ O que não fazer</h4>
                <ul className="space-y-1">
                  {getDosAndDonts(viewStage).donts?.map((item, idx) => (
                    <li key={idx} className="text-sm text-red-600">• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Nova Etapa</DialogTitle>
            <DialogDescription>
              Esta será a etapa #{stages.length + 1} do seu processo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da etapa"
              value={newStage.stage_name}
              onChange={(e) => setNewStage(prev => ({...prev, stage_name: e.target.value}))}
            />
            
            <Textarea
              placeholder="Objetivos desta etapa..."
              rows={3}
              value={newStage.objectives}
              onChange={(e) => setNewStage(prev => ({...prev, objectives: e.target.value}))}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Tempo máximo (horas)</label>
                <Input
                  type="number"
                  min="1"
                  value={newStage.max_time_hours}
                  onChange={(e) => setNewStage(prev => ({...prev, max_time_hours: parseInt(e.target.value) || 24}))}
                />
              </div>
            </div>

            {/* Checklist */}
            <div>
              <label className="text-sm font-medium mb-2 block">Checklist</label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Adicionar item..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newChecklistItem.trim()) {
                      setNewStage(prev => ({...prev, checklist: [...prev.checklist, newChecklistItem.trim()]}));
                      setNewChecklistItem("");
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (newChecklistItem.trim()) {
                      setNewStage(prev => ({...prev, checklist: [...prev.checklist, newChecklistItem.trim()]}));
                      setNewChecklistItem("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {newStage.checklist.map((item, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    {item}
                    <button onClick={() => setNewStage(prev => ({...prev, checklist: prev.checklist.filter((_, i) => i !== idx)}))}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Do's */}
            <div>
              <label className="text-sm font-medium mb-2 block text-green-600">✓ O que fazer</label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Adicionar..."
                  value={newDo}
                  onChange={(e) => setNewDo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDo.trim()) {
                      setNewStage(prev => ({...prev, dos: [...prev.dos, newDo.trim()]}));
                      setNewDo("");
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (newDo.trim()) {
                      setNewStage(prev => ({...prev, dos: [...prev.dos, newDo.trim()]}));
                      setNewDo("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {newStage.dos.map((item, idx) => (
                  <Badge key={idx} className="bg-green-500/10 text-green-600 flex items-center gap-1">
                    {item}
                    <button onClick={() => setNewStage(prev => ({...prev, dos: prev.dos.filter((_, i) => i !== idx)}))}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Don'ts */}
            <div>
              <label className="text-sm font-medium mb-2 block text-red-600">✗ O que não fazer</label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Adicionar..."
                  value={newDont}
                  onChange={(e) => setNewDont(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newDont.trim()) {
                      setNewStage(prev => ({...prev, donts: [...prev.donts, newDont.trim()]}));
                      setNewDont("");
                    }
                  }}
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (newDont.trim()) {
                      setNewStage(prev => ({...prev, donts: [...prev.donts, newDont.trim()]}));
                      setNewDont("");
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {newStage.donts.map((item, idx) => (
                  <Badge key={idx} className="bg-red-500/10 text-red-600 flex items-center gap-1">
                    {item}
                    <button onClick={() => setNewStage(prev => ({...prev, donts: prev.donts.filter((_, i) => i !== idx)}))}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
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
            <AlertDialogTitle>Excluir Etapa?</AlertDialogTitle>
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
