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
  GripVertical
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

interface ProcessPage {
  id: string;
  title: string;
  icon: string;
  parent_id: string | null;
  page_type: string;
  is_favorite: boolean;
  is_template: boolean;
  position: number;
  children?: ProcessPage[];
}

interface NotionSidebarProps {
  companyId: string | null;
  selectedPageId: string | null;
  onSelectPage: (page: ProcessPage | null) => void;
  onCreatePage: (parentId?: string | null) => void;
}

export function NotionSidebar({ companyId, selectedPageId, onSelectPage, onCreatePage }: NotionSidebarProps) {
  const [pages, setPages] = useState<ProcessPage[]>([]);
  const [favorites, setFavorites] = useState<ProcessPage[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      loadPages();
    }
  }, [companyId]);

  const loadPages = async () => {
    if (!companyId) return;
    
    try {
      const { data, error } = await supabase
        .from('process_pages')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_template', false)
        .order('position', { ascending: true });

      if (error) throw error;

      // Build tree structure
      const pagesMap = new Map<string, ProcessPage>();
      const rootPages: ProcessPage[] = [];
      const favoritePages: ProcessPage[] = [];

      data?.forEach(page => {
        pagesMap.set(page.id, { ...page, children: [] });
      });

      data?.forEach(page => {
        const currentPage = pagesMap.get(page.id)!;
        if (page.is_favorite) {
          favoritePages.push(currentPage);
        }
        if (page.parent_id && pagesMap.has(page.parent_id)) {
          pagesMap.get(page.parent_id)!.children!.push(currentPage);
        } else if (!page.parent_id) {
          rootPages.push(currentPage);
        }
      });

      setPages(rootPages);
      setFavorites(favoritePages);
    } catch (error) {
      console.error('Error loading pages:', error);
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

  const toggleFavorite = async (page: ProcessPage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('process_pages')
        .update({ is_favorite: !page.is_favorite })
        .eq('id', page.id);

      if (error) throw error;
      await loadPages();
      toast.success(page.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (error) {
      toast.error('Erro ao atualizar favorito');
    }
  };

  const deletePage = async (page: ProcessPage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('process_pages')
        .delete()
        .eq('id', page.id);

      if (error) throw error;
      await loadPages();
      if (selectedPageId === page.id) {
        onSelectPage(null);
      }
      toast.success('Página excluída');
    } catch (error) {
      toast.error('Erro ao excluir página');
    }
  };

  const duplicatePage = async (page: ProcessPage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('process_pages')
        .insert({
          company_id: companyId,
          parent_id: page.parent_id,
          title: `${page.title} (cópia)`,
          icon: page.icon,
          page_type: page.page_type,
          created_by: user.user?.id
        });

      if (error) throw error;
      await loadPages();
      toast.success('Página duplicada');
    } catch (error) {
      toast.error('Erro ao duplicar página');
    }
  };

  const renderPageItem = (page: ProcessPage, depth: number = 0) => {
    const hasChildren = page.children && page.children.length > 0;
    const isExpanded = expandedIds.has(page.id);
    const isSelected = selectedPageId === page.id;

    return (
      <div key={page.id}>
        <div
          className={cn(
            "group flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors",
            isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/50",
            depth > 0 && "ml-4"
          )}
          onClick={() => onSelectPage(page)}
        >
          <button
            className="p-0.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(page.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <div className="w-3.5" />
            )}
          </button>
          
          <span className="text-base">{page.icon}</span>
          
          <span className="flex-1 text-sm truncate">{page.title}</span>
          
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1 hover:bg-muted rounded"
              onClick={(e) => {
                e.stopPropagation();
                onCreatePage(page.id);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-muted rounded" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={(e) => toggleFavorite(page, e as any)}>
                  {page.is_favorite ? (
                    <><StarOff className="h-4 w-4 mr-2" /> Remover favorito</>
                  ) : (
                    <><Star className="h-4 w-4 mr-2" /> Adicionar favorito</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => duplicatePage(page, e as any)}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => deletePage(page, e as any)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {hasChildren && isExpanded && (
          <div className="ml-2">
            {page.children!.map(child => renderPageItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const filteredPages = searchQuery
    ? pages.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : pages;

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
        <div className="p-2 space-y-4">
          {/* Favorites */}
          {favorites.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
                <Star className="h-3 w-3" />
                <span>FAVORITOS</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                {favorites.map(page => renderPageItem(page))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* All Pages */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full">
              <Folder className="h-3 w-3" />
              <span>PÁGINAS</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              {loading ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Carregando...
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Nenhuma página ainda
                </div>
              ) : (
                filteredPages.map(page => renderPageItem(page))
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* New Page Button */}
      <div className="p-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => onCreatePage()}
        >
          <Plus className="h-4 w-4" />
          Nova Página
        </Button>
      </div>
    </div>
  );
}
