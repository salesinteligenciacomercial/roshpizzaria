import { useState, useEffect } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  MoreHorizontal,
  Star,
  StarOff,
  Trash2,
  Copy,
  FileText,
  Folder,
  CheckSquare,
  BookOpen,
  Workflow,
  GitBranch,
  CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SidebarItem {
  id: string;
  title: string;
  icon: string | React.ReactNode;
  type: 'page' | 'task' | 'playbook' | 'cadence' | 'stage';
  is_favorite?: boolean;
  parent_id?: string | null;
  children?: SidebarItem[];
  original?: any;
}

interface NotionSidebarProps {
  companyId: string | null;
  selectedPageId: string | null;
  onSelectPage: (page: any) => void;
  onCreatePage: (parentId?: string | null, type?: string) => void;
  onViewCalendar: () => void;
  showCalendar: boolean;
}

export function NotionSidebar({ 
  companyId, 
  selectedPageId, 
  onSelectPage, 
  onCreatePage,
  onViewCalendar,
  showCalendar
}: NotionSidebarProps) {
  const [allItems, setAllItems] = useState<SidebarItem[]>([]);
  const [tasks, setTasks] = useState<SidebarItem[]>([]);
  const [favorites, setFavorites] = useState<SidebarItem[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['pages', 'tasks']));
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (companyId) {
      loadAllData();
    }
  }, [companyId]);

  const getIconForType = (type: string, customIcon?: string) => {
    if (customIcon && typeof customIcon === 'string' && customIcon.length <= 4) {
      return <span className="text-base">{customIcon}</span>;
    }
    
    switch (type) {
      case 'playbook':
        return <BookOpen className="h-4 w-4 text-blue-500" />;
      case 'cadence':
        return <Workflow className="h-4 w-4 text-purple-500" />;
      case 'stage':
        return <GitBranch className="h-4 w-4 text-green-500" />;
      case 'task':
        return <CheckSquare className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const loadAllData = async () => {
    if (!companyId) return;
    
    try {
      const [pagesRes, playbooksRes, cadencesRes, stagesRes] = await Promise.all([
        supabase
          .from('process_pages')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_template', false)
          .order('position', { ascending: true }),
        supabase
          .from('processes_playbooks')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('processes_routines')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('processes_stages')
          .select('*')
          .eq('company_id', companyId)
          .order('stage_order', { ascending: true })
      ]);

      const items: SidebarItem[] = [];
      const taskItems: SidebarItem[] = [];
      const favoriteItems: SidebarItem[] = [];

      // Process pages
      const pagesData = pagesRes.data || [];
      pagesData.forEach(page => {
        const item: SidebarItem = {
          id: page.id,
          title: page.title,
          icon: page.icon || '📄',
          type: page.page_type === 'task' ? 'task' : 'page',
          is_favorite: page.is_favorite,
          parent_id: page.parent_id,
          original: page
        };
        
        if (page.page_type === 'task') {
          taskItems.push(item);
        } else if (!page.parent_id) {
          items.push(item);
        }
        
        if (page.is_favorite) {
          favoriteItems.push(item);
        }
      });

      // Process playbooks
      (playbooksRes.data || []).forEach(pb => {
        items.push({
          id: pb.id,
          title: pb.title,
          icon: '📘',
          type: 'playbook',
          original: pb
        });
      });

      // Process cadences
      (cadencesRes.data || []).forEach(c => {
        items.push({
          id: c.id,
          title: c.name,
          icon: '🔄',
          type: 'cadence',
          original: c
        });
      });

      // Process stages
      (stagesRes.data || []).forEach(s => {
        items.push({
          id: s.id,
          title: s.stage_name,
          icon: '📊',
          type: 'stage',
          original: s
        });
      });

      setAllItems(items);
      setTasks(taskItems);
      setFavorites(favoriteItems);
      setTotalItems(items.length + taskItems.length);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleFavorite = async (item: SidebarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== 'page' && item.type !== 'task') return;
    
    try {
      const { error } = await supabase
        .from('process_pages')
        .update({ is_favorite: !item.is_favorite })
        .eq('id', item.id);

      if (error) throw error;
      await loadAllData();
      toast.success(item.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (error) {
      toast.error('Erro ao atualizar favorito');
    }
  };

  const deleteItem = async (item: SidebarItem, e: React.MouseEvent) => {
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
      await loadAllData();
      if (selectedPageId === item.id) {
        onSelectPage(null);
      }
      toast.success('Item excluído');
    } catch (error) {
      toast.error('Erro ao excluir item');
    }
  };

  const duplicateItem = async (item: SidebarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type !== 'page' && item.type !== 'task') return;
    
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('process_pages')
        .insert({
          company_id: companyId,
          parent_id: item.parent_id || null,
          title: `${item.title} (cópia)`,
          icon: typeof item.icon === 'string' ? item.icon : '📄',
          page_type: item.type,
          created_by: user.user?.id
        });

      if (error) throw error;
      await loadAllData();
      toast.success('Item duplicado');
    } catch (error) {
      toast.error('Erro ao duplicar item');
    }
  };

  const handleItemClick = (item: SidebarItem) => {
    if (item.type === 'page' || item.type === 'task') {
      onSelectPage(item.original);
    } else {
      // For playbooks, cadences, stages - just show a toast for now
      // In the future, we could open an edit dialog or create a page view for these
      toast.info(`Selecionado: ${item.title}`);
    }
  };

  const renderItem = (item: SidebarItem, depth: number = 0) => {
    const isSelected = selectedPageId === item.id;
    const canFavorite = item.type === 'page' || item.type === 'task';
    const canDuplicate = item.type === 'page' || item.type === 'task';

    const typeLabels: Record<string, string> = {
      page: 'Página',
      task: 'Tarefa',
      playbook: 'Playbook',
      cadence: 'Cadência',
      stage: 'Etapa'
    };

    return (
      <div key={item.id}>
        <div
          className={cn(
            "group flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50",
            depth > 0 && "ml-4"
          )}
          onClick={() => handleItemClick(item)}
        >
          <div className="w-5 flex items-center justify-center">
            {typeof item.icon === 'string' ? (
              <span className="text-sm">{item.icon}</span>
            ) : (
              item.icon
            )}
          </div>
          
          <span className="flex-1 text-sm truncate">{item.title}</span>
          
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {typeLabels[item.type]}
          </span>
          
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {(item.type === 'page') && (
              <button
                className="p-1 hover:bg-muted rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreatePage(item.id, 'page');
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-muted rounded" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {canFavorite && (
                  <DropdownMenuItem onClick={(e) => toggleFavorite(item, e as any)}>
                    {item.is_favorite ? (
                      <><StarOff className="h-4 w-4 mr-2" /> Remover favorito</>
                    ) : (
                      <><Star className="h-4 w-4 mr-2" /> Adicionar favorito</>
                    )}
                  </DropdownMenuItem>
                )}
                {canDuplicate && (
                  <DropdownMenuItem onClick={(e) => duplicateItem(item, e as any)}>
                    <Copy className="h-4 w-4 mr-2" /> Duplicar
                  </DropdownMenuItem>
                )}
                {(canFavorite || canDuplicate) && <DropdownMenuSeparator />}
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
  };

  const filteredItems = searchQuery
    ? allItems.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : allItems;

  const filteredTasks = searchQuery
    ? tasks.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : tasks;

  return (
    <div className="w-64 border-r border-border bg-muted/30 flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <Input
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm bg-background"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Quick Views */}
          <div className="space-y-1">
            <div
              className={cn(
                "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
                showCalendar ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
              onClick={onViewCalendar}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="text-sm">Calendário</span>
            </div>
          </div>

          <div className="h-px bg-border my-2" />

          {/* Favorites */}
          {favorites.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
                <Star className="h-3 w-3" />
                <span>FAVORITOS</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                {favorites.map(item => renderItem(item))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* All Items (Pages, Playbooks, Cadences, Stages) */}
          <Collapsible open={expandedIds.has('pages')} onOpenChange={() => toggleExpand('pages')}>
            <CollapsibleTrigger className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
              <div className="flex items-center gap-2">
                <Folder className="h-3 w-3" />
                <span>PÁGINAS</span>
              </div>
              {allItems.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{allItems.length}</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              {loading ? (
                <div className="text-center py-2 text-muted-foreground text-xs">Carregando...</div>
              ) : filteredItems.length === 0 ? (
                <div className="text-center py-2 text-muted-foreground text-xs">Nenhum item</div>
              ) : (
                filteredItems.map(item => renderItem(item))
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Tasks */}
          <Collapsible open={expandedIds.has('tasks')} onOpenChange={() => toggleExpand('tasks')}>
            <CollapsibleTrigger className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-3 w-3" />
                <span>TAREFAS</span>
              </div>
              {tasks.length > 0 && <Badge variant="secondary" className="h-4 px-1 text-[10px]">{tasks.length}</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-2 text-muted-foreground text-xs">Nenhuma tarefa</div>
              ) : (
                filteredTasks.map(task => renderItem(task))
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* New Item Button */}
      <div className="p-2 border-t border-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => onCreatePage(null, 'page')}>
              <FileText className="h-4 w-4 mr-2" />
              Página
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreatePage(null, 'task')}>
              <CheckSquare className="h-4 w-4 mr-2" />
              Tarefa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
