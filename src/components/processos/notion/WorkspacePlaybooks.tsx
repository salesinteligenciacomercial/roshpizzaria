import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  BookOpen, 
  Edit2, 
  Trash2, 
  FileText, 
  Plus,
  Search,
  Eye,
  X,
  Save
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

interface Playbook {
  id: string;
  title: string;
  type: string;
  category: string | null;
  content: string | null;
  is_active: boolean;
  created_at: string;
}

interface WorkspacePlaybooksProps {
  companyId: string | null;
  onSync?: () => void;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  atendimento: { label: "Atendimento", color: "bg-blue-500" },
  prospeccao: { label: "Prospecção", color: "bg-green-500" },
  follow_up: { label: "Follow-up", color: "bg-yellow-500" },
  fechamento: { label: "Fechamento", color: "bg-purple-500" },
  objecoes: { label: "Objeções", color: "bg-orange-500" },
  pos_venda: { label: "Pós-venda", color: "bg-cyan-500" }
};

export function WorkspacePlaybooks({ companyId, onSync }: WorkspacePlaybooksProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewPlaybook, setViewPlaybook] = useState<Playbook | null>(null);
  const [editPlaybook, setEditPlaybook] = useState<Playbook | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ title: "", type: "atendimento", category: "", content: "" });

  useEffect(() => {
    if (companyId) loadPlaybooks();
  }, [companyId]);

  const loadPlaybooks = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('processes_playbooks')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    setPlaybooks(data || []);
    setLoading(false);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await supabase.from('processes_playbooks').update({ is_active: !isActive }).eq('id', id);
    loadPlaybooks();
    onSync?.();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('processes_playbooks').delete().eq('id', deleteId);
    toast.success("Playbook excluído");
    setDeleteId(null);
    loadPlaybooks();
    onSync?.();
  };

  const handleCreate = async () => {
    if (!companyId || !newPlaybook.title.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('processes_playbooks').insert({
      company_id: companyId,
      owner_id: user.user?.id,
      title: newPlaybook.title,
      type: newPlaybook.type,
      category: newPlaybook.category || null,
      content: newPlaybook.content || null,
      is_active: true
    });
    toast.success("Playbook criado");
    setShowNew(false);
    setNewPlaybook({ title: "", type: "atendimento", category: "", content: "" });
    loadPlaybooks();
    onSync?.();
  };

  const handleUpdate = async () => {
    if (!editPlaybook) return;
    await supabase.from('processes_playbooks').update({
      title: editPlaybook.title,
      type: editPlaybook.type,
      category: editPlaybook.category,
      content: editPlaybook.content
    }).eq('id', editPlaybook.id);
    toast.success("Playbook atualizado");
    setEditPlaybook(null);
    loadPlaybooks();
    onSync?.();
  };

  const filteredPlaybooks = playbooks.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.content?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar playbooks..."
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
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Playbook
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filteredPlaybooks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhum playbook encontrado</p>
          <p className="text-sm">Crie seu primeiro playbook para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlaybooks.map((playbook) => {
            const typeInfo = typeLabels[playbook.type] || { label: playbook.type, color: "bg-gray-500" };
            return (
              <div
                key={playbook.id}
                className={`bg-card border rounded-xl p-4 hover:shadow-lg transition-all ${!playbook.is_active ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <Switch
                    checked={playbook.is_active}
                    onCheckedChange={() => handleToggleActive(playbook.id, playbook.is_active)}
                  />
                </div>
                
                <h3 className="font-semibold mb-2 line-clamp-1">{playbook.title}</h3>
                
                <div className="flex items-center gap-2 mb-3">
                  <Badge className={`${typeInfo.color} text-white text-xs`}>
                    {typeInfo.label}
                  </Badge>
                  {playbook.category && (
                    <Badge variant="outline" className="text-xs">
                      {playbook.category}
                    </Badge>
                  )}
                </div>

                {playbook.content && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {playbook.content}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto pt-2 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setViewPlaybook(playbook)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditPlaybook(playbook)}>
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(playbook.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewPlaybook} onOpenChange={() => setViewPlaybook(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              {viewPlaybook?.title}
            </DialogTitle>
            <DialogDescription>
              {typeLabels[viewPlaybook?.type || '']?.label || viewPlaybook?.type}
              {viewPlaybook?.category && ` • ${viewPlaybook.category}`}
            </DialogDescription>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {viewPlaybook?.content || "Sem conteúdo"}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editPlaybook} onOpenChange={() => setEditPlaybook(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Playbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Título"
              value={editPlaybook?.title || ""}
              onChange={(e) => setEditPlaybook(prev => prev ? {...prev, title: e.target.value} : null)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select value={editPlaybook?.type || ""} onValueChange={(v) => setEditPlaybook(prev => prev ? {...prev, type: v} : null)}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Categoria (opcional)"
                value={editPlaybook?.category || ""}
                onChange={(e) => setEditPlaybook(prev => prev ? {...prev, category: e.target.value} : null)}
              />
            </div>
            <Textarea
              placeholder="Conteúdo do playbook..."
              rows={10}
              value={editPlaybook?.content || ""}
              onChange={(e) => setEditPlaybook(prev => prev ? {...prev, content: e.target.value} : null)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditPlaybook(null)}>Cancelar</Button>
              <Button onClick={handleUpdate}><Save className="h-4 w-4 mr-2" />Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Playbook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Título do playbook"
              value={newPlaybook.title}
              onChange={(e) => setNewPlaybook(prev => ({...prev, title: e.target.value}))}
            />
            <div className="grid grid-cols-2 gap-4">
              <Select value={newPlaybook.type} onValueChange={(v) => setNewPlaybook(prev => ({...prev, type: v}))}>
                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Categoria (opcional)"
                value={newPlaybook.category}
                onChange={(e) => setNewPlaybook(prev => ({...prev, category: e.target.value}))}
              />
            </div>
            <Textarea
              placeholder="Conteúdo do playbook..."
              rows={10}
              value={newPlaybook.content}
              onChange={(e) => setNewPlaybook(prev => ({...prev, content: e.target.value}))}
            />
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
            <AlertDialogTitle>Excluir Playbook?</AlertDialogTitle>
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
