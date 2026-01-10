import { useState, useEffect } from "react";
import { 
  Plus, 
  MoreHorizontal, 
  Star, 
  StarOff,
  FileText,
  CheckSquare,
  BookOpen,
  Workflow,
  GitBranch,
  Trash2,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GalleryItem {
  id: string;
  title: string;
  type: 'page' | 'task' | 'playbook' | 'cadence' | 'stage';
  icon: string;
  cover_url?: string | null;
  is_favorite?: boolean;
  status?: string;
  tags?: string[];
  updated_at?: string;
  original: any;
}

interface GalleryViewProps {
  companyId: string | null;
  items: GalleryItem[];
  onSelect: (item: GalleryItem) => void;
  onRefresh: () => void;
}

const typeIcons: Record<string, React.ComponentType<any>> = {
  page: FileText,
  task: CheckSquare,
  playbook: BookOpen,
  cadence: Workflow,
  stage: GitBranch,
};

const typeLabels: Record<string, string> = {
  page: 'Página',
  task: 'Tarefa',
  playbook: 'Playbook',
  cadence: 'Cadência',
  stage: 'Etapa',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  completed: 'bg-blue-500',
  archived: 'bg-yellow-500',
};

export function GalleryView({ companyId, items, onSelect, onRefresh }: GalleryViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const toggleFavorite = async (item: GalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== 'page' && item.type !== 'task') return;
    
    try {
      const { error } = await supabase
        .from('process_pages')
        .update({ is_favorite: !item.is_favorite })
        .eq('id', item.id);

      if (error) throw error;
      onRefresh();
      toast.success(item.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (error) {
      toast.error('Erro ao atualizar favorito');
    }
  };

  const deleteItem = async (item: GalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      let error;
      switch (item.type) {
        case 'page':
        case 'task':
          ({ error } = await supabase.from('process_pages').delete().eq('id', item.id));
          break;
        case 'playbook':
          ({ error } = await supabase.from('processes_playbooks').delete().eq('id', item.id));
          break;
        case 'cadence':
          ({ error } = await supabase.from('processes_routines').delete().eq('id', item.id));
          break;
        case 'stage':
          ({ error } = await supabase.from('processes_stages').delete().eq('id', item.id));
          break;
      }

      if (error) throw error;
      onRefresh();
      toast.success('Item excluído');
    } catch (error) {
      toast.error('Erro ao excluir');
    }
  };

  const duplicateItem = async (item: GalleryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== 'page' && item.type !== 'task') return;
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('process_pages')
        .insert({
          company_id: companyId,
          title: `${item.title} (cópia)`,
          icon: item.icon,
          page_type: item.type,
          created_by: user.user?.id
        });

      if (error) throw error;
      onRefresh();
      toast.success('Item duplicado');
    } catch (error) {
      toast.error('Erro ao duplicar');
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold mb-1">Nenhum item encontrado</h3>
        <p className="text-sm text-muted-foreground">
          Crie uma nova página ou tarefa para começar
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
      {items.map((item) => {
        const TypeIcon = typeIcons[item.type] || FileText;
        const isHovered = hoveredId === item.id;

        return (
          <div
            key={`${item.type}-${item.id}`}
            className={cn(
              "group relative rounded-xl border border-border bg-card overflow-hidden cursor-pointer transition-all duration-200",
              "hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5"
            )}
            onClick={() => onSelect(item)}
            onMouseEnter={() => setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Cover Image or Gradient */}
            <div 
              className={cn(
                "h-28 relative",
                item.cover_url 
                  ? "bg-cover bg-center" 
                  : "bg-gradient-to-br from-primary/20 to-primary/5"
              )}
              style={item.cover_url ? { backgroundImage: `url(${item.cover_url})` } : undefined}
            >
              {/* Overlay actions */}
              <div className={cn(
                "absolute inset-0 bg-black/40 flex items-center justify-center gap-2 transition-opacity",
                isHovered ? "opacity-100" : "opacity-0"
              )}>
                {(item.type === 'page' || item.type === 'task') && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => toggleFavorite(item, e)}
                  >
                    {item.is_favorite ? (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {/* Icon badge */}
              <div className="absolute -bottom-4 left-4 w-10 h-10 rounded-lg bg-card border-2 border-background flex items-center justify-center text-xl shadow-sm">
                {item.icon}
              </div>

              {/* Type badge */}
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="text-xs gap-1 bg-background/80 backdrop-blur-sm">
                  <TypeIcon className="h-3 w-3" />
                  {typeLabels[item.type]}
                </Badge>
              </div>
            </div>

            {/* Content */}
            <div className="pt-6 pb-4 px-4">
              <h3 className="font-semibold truncate mb-1">{item.title}</h3>
              
              <div className="flex items-center gap-2 flex-wrap">
                {/* Status */}
                {item.status && (
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs capitalize", statusColors[item.status])}
                  >
                    {item.status}
                  </Badge>
                )}
                
                {/* Tags */}
                {item.tags?.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {(item.tags?.length || 0) > 2 && (
                  <span className="text-xs text-muted-foreground">
                    +{(item.tags?.length || 0) - 2}
                  </span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {item.updated_at && format(new Date(item.updated_at), "dd MMM", { locale: ptBR })}
                </span>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(item.type === 'page' || item.type === 'task') && (
                      <>
                        <DropdownMenuItem onClick={(e) => duplicateItem(item, e as any)}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem 
                      className="text-destructive"
                      onClick={(e) => deleteItem(item, e as any)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
