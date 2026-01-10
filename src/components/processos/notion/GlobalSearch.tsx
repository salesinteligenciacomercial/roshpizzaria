import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, 
  FileText, 
  CheckSquare, 
  BookOpen, 
  Workflow, 
  GitBranch,
  Clock,
  Star,
  Command
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SearchResult {
  id: string;
  title: string;
  type: 'page' | 'task' | 'playbook' | 'cadence' | 'stage';
  icon: string;
  is_favorite?: boolean;
  updated_at?: string;
  original: any;
}

interface GlobalSearchProps {
  companyId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
}

export function GlobalSearch({ companyId, isOpen, onClose, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentItems, setRecentItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent items on open
  useEffect(() => {
    if (isOpen && companyId) {
      loadRecentItems();
      inputRef.current?.focus();
    }
  }, [isOpen, companyId]);

  const loadRecentItems = async () => {
    if (!companyId) return;
    
    try {
      const { data: pages } = await supabase
        .from('process_pages')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_template', false)
        .order('updated_at', { ascending: false })
        .limit(5);

      const items: SearchResult[] = (pages || []).map(p => ({
        id: p.id,
        title: p.title,
        type: p.page_type === 'task' ? 'task' : 'page',
        icon: p.icon || '📄',
        is_favorite: p.is_favorite,
        updated_at: p.updated_at,
        original: p
      }));

      setRecentItems(items);
    } catch (error) {
      console.error('Error loading recent items:', error);
    }
  };

  const search = useCallback(async (searchQuery: string) => {
    if (!companyId || !searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchTerm = `%${searchQuery}%`;
      
      const [pagesRes, playbooksRes, cadencesRes, stagesRes] = await Promise.all([
        supabase
          .from('process_pages')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_template', false)
          .ilike('title', searchTerm)
          .limit(10),
        supabase
          .from('processes_playbooks')
          .select('*')
          .eq('company_id', companyId)
          .ilike('title', searchTerm)
          .limit(5),
        supabase
          .from('processes_routines')
          .select('*')
          .eq('company_id', companyId)
          .ilike('name', searchTerm)
          .limit(5),
        supabase
          .from('processes_stages')
          .select('*')
          .eq('company_id', companyId)
          .ilike('stage_name', searchTerm)
          .limit(5),
      ]);

      const allResults: SearchResult[] = [];

      (pagesRes.data || []).forEach(p => {
        allResults.push({
          id: p.id,
          title: p.title,
          type: p.page_type === 'task' ? 'task' : 'page',
          icon: p.icon || '📄',
          is_favorite: p.is_favorite,
          updated_at: p.updated_at,
          original: p
        });
      });

      (playbooksRes.data || []).forEach(p => {
        allResults.push({
          id: p.id,
          title: p.title,
          type: 'playbook',
          icon: '📘',
          updated_at: p.updated_at,
          original: p
        });
      });

      (cadencesRes.data || []).forEach(c => {
        allResults.push({
          id: c.id,
          title: c.name,
          type: 'cadence',
          icon: '🔄',
          updated_at: c.updated_at,
          original: c
        });
      });

      (stagesRes.data || []).forEach(s => {
        allResults.push({
          id: s.id,
          title: s.stage_name,
          type: 'stage',
          icon: '📊',
          original: s
        });
      });

      setResults(allResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(debounce);
  }, [query, search]);

  const displayItems = query ? results : recentItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < displayItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : displayItems.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (displayItems[selectedIndex]) {
          onSelect(displayItems[selectedIndex]);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task': return CheckSquare;
      case 'playbook': return BookOpen;
      case 'cadence': return Workflow;
      case 'stage': return GitBranch;
      default: return FileText;
    }
  };

  const typeLabels: Record<string, string> = {
    page: 'Página',
    task: 'Tarefa',
    playbook: 'Playbook',
    cadence: 'Cadência',
    stage: 'Etapa'
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Buscar páginas, tarefas, playbooks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {!query && recentItems.length > 0 && (
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" />
                RECENTES
              </div>
            )}

            {query && results.length === 0 && !loading && (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum resultado para "{query}"</p>
              </div>
            )}

            {loading && (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
              </div>
            )}

            {displayItems.map((item, index) => {
              const Icon = getIcon(item.type);
              return (
                <button
                  key={`${item.type}-${item.id}`}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors",
                    selectedIndex === index ? "bg-accent" : "hover:bg-muted/50"
                  )}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{item.title}</span>
                      {item.is_favorite && (
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{typeLabels[item.type]}</span>
                      {item.updated_at && (
                        <>
                          <span>•</span>
                          <span>
                            {format(new Date(item.updated_at), "dd MMM", { locale: ptBR })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span><kbd className="px-1 bg-muted rounded">↑↓</kbd> navegar</span>
          <span><kbd className="px-1 bg-muted rounded">Enter</kbd> abrir</span>
          <span><kbd className="px-1 bg-muted rounded">Esc</kbd> fechar</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
