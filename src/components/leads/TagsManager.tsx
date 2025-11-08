import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tag, Plus, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTagsManager } from "@/hooks/useTagsManager";

interface TagStats {
  tag: string;
  count: number;
  leads: Array<{ id: string; name: string }>;
}

interface TagsManagerProps {
  onTagSelected?: (tag: string | null) => void;
  selectedTag?: string | null;
}

export function TagsManager({ onTagSelected, selectedTag }: TagsManagerProps) {
  const [open, setOpen] = useState(false);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [loading, setLoading] = useState(false);
  const { addStandaloneTag, removeStandaloneTag, allTags } = useTagsManager();

  useEffect(() => {
    if (open) {
      loadTagStats();
    }
  }, [open]);

  const loadTagStats = async () => {
    setLoading(true);
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("id, name, tags")
        .not("tags", "is", null);

      if (error) throw error;

      // Agrupar leads por tag
      const tagsMap = new Map<string, { count: number; leads: Array<{ id: string; name: string }> }>();

      leads?.forEach((lead) => {
        if (lead.tags && Array.isArray(lead.tags)) {
          lead.tags.forEach((tag) => {
            if (!tagsMap.has(tag)) {
              tagsMap.set(tag, { count: 0, leads: [] });
            }
            const tagData = tagsMap.get(tag)!;
            tagData.count++;
            tagData.leads.push({ id: lead.id, name: lead.name });
          });
        }
      });

      // Converter para array e ordenar por quantidade
      let stats: TagStats[] = Array.from(tagsMap.entries())
        .map(([tag, data]) => ({
          tag,
          count: data.count,
          leads: data.leads,
        }))
        .sort((a, b) => b.count - a.count);

      // Incluir tags independentes (sem leads) para ficarem visíveis
      const known = new Set(stats.map(s => s.tag.toLowerCase()));
      allTags.forEach((t) => {
        if (!known.has(t.toLowerCase())) {
          stats.push({ tag: t, count: 0, leads: [] });
        }
      });
      // Ordenar novamente: primeiro por count desc, depois alfabético
      stats = stats.sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));

      setTagStats(stats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas de tags:", error);
      toast.error("Erro ao carregar tags");
    } finally {
      setLoading(false);
    }
  };

  const createAndAssignTag = async () => {
    if (!newTagName.trim()) {
      toast.error("Digite um nome para a tag");
      return;
    }

    const tagName = newTagName.trim();

    // Verificar se a tag já existe
    if (tagStats.some((stat) => stat.tag.toLowerCase() === tagName.toLowerCase())) {
      toast.error("Esta tag já existe");
      return;
    }

    try {
      // Tornar a tag visível globalmente (catálogo da empresa)
      await addStandaloneTag(tagName);

      // Incluir imediatamente na lista local com contagem 0
      setTagStats((prev) => {
        const exists = prev.some(s => s.tag.toLowerCase() === tagName.toLowerCase());
        if (exists) return prev;
        const next = [...prev, { tag: tagName, count: 0, leads: [] }];
        return next.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
      });

      setNewTagName("");
      toast.success(`Tag "${tagName}" criada com sucesso`);
    } catch (e) {
      console.error("Erro ao criar tag:", e);
      toast.error("Erro ao criar tag");
    }
  };

  const deleteTag = async (tagToDelete: string) => {
    try {
      // Buscar todos os leads com esta tag
      const { data: leads, error: fetchError } = await supabase
        .from("leads")
        .select("id, tags")
        .contains("tags", [tagToDelete]);

      if (fetchError) throw fetchError;

      if (!leads || leads.length === 0) {
        // Remover do catálogo independente e atualizar UI
        await removeStandaloneTag(tagToDelete);
        // Atualizar UI local imediatamente
        setTagStats(prev => prev.filter(s => s.tag.toLowerCase() !== tagToDelete.toLowerCase()));
        toast.success("Tag removida com sucesso");
        return;
      }

      // Remover a tag de todos os leads
      for (const lead of leads) {
        const newTags = lead.tags?.filter((tag) => tag !== tagToDelete) || [];
        
        const { error: updateError } = await supabase
          .from("leads")
          .update({ tags: newTags.length > 0 ? newTags : null })
          .eq("id", lead.id);

        if (updateError) throw updateError;
      }

      // Remover do catálogo independente e atualizar UI
      await removeStandaloneTag(tagToDelete);

      toast.success(`Tag "${tagToDelete}" removida de ${leads.length} lead(s)`);
      // Atualizar UI local
      setTagStats(prev => prev.filter(s => s.tag.toLowerCase() !== tagToDelete.toLowerCase()));
      
      // Se a tag removida estava selecionada, limpar seleção
      if (selectedTag === tagToDelete && onTagSelected) {
        onTagSelected(null);
      }
    } catch (error) {
      console.error("Erro ao deletar tag:", error);
      toast.error("Erro ao remover tag");
    }
  };

  const handleTagClick = (tag: string) => {
    if (onTagSelected) {
      // Toggle: se já está selecionada, remove a seleção
      onTagSelected(selectedTag === tag ? null : tag);
      setOpen(false);
    }
  };

  const totalLeadsWithTags = new Set(tagStats.flatMap((stat) => stat.leads.map((l) => l.id))).size;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Tag className="h-4 w-4" />
          Gerenciar Tags
          {selectedTag && (
            <Badge variant="secondary" className="ml-1">
              {selectedTag}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Gerenciamento de Tags
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Criar nova tag */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da nova tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      createAndAssignTag();
                    }
                  }}
                />
                <Button onClick={createAndAssignTag}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Tag
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas gerais */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{tagStats.length}</div>
                  <div className="text-sm text-muted-foreground">Tags Criadas</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{totalLeadsWithTags}</div>
                  <div className="text-sm text-muted-foreground">Leads com Tags</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {tagStats.reduce((sum, stat) => sum + stat.count, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Atribuições</div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Lista de tags */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Tags Cadastradas</h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : tagStats.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma tag cadastrada ainda
                  </div>
                ) : (
                  tagStats.map((stat) => (
                    <Card
                      key={stat.tag}
                      className={`transition-all hover:shadow-md cursor-pointer ${
                        selectedTag === stat.tag ? "ring-2 ring-primary" : ""
                      }`}
                      onClick={() => handleTagClick(stat.tag)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <Badge variant="secondary" className="gap-1">
                              <Tag className="h-3 w-3" />
                              {stat.tag}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              <span>{stat.count} lead(s)</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTag(stat.tag);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {/* Mostrar alguns leads */}
                        {stat.leads.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {stat.leads.slice(0, 3).map((lead) => (
                              <Badge key={lead.id} variant="outline" className="text-xs">
                                {lead.name}
                              </Badge>
                            ))}
                            {stat.leads.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{stat.leads.length - 3} mais
                              </Badge>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
