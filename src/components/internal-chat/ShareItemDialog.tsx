import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Users, CheckSquare, Layers, Search, Loader2 } from 'lucide-react';

interface ShareItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (itemType: string, itemId: string, itemName: string) => void;
}

interface ShareableItem {
  id: string;
  name: string;
  subtitle?: string;
}

export const ShareItemDialog = ({
  open,
  onOpenChange,
  onShare
}: ShareItemDialogProps) => {
  const [activeTab, setActiveTab] = useState('lead');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<ShareableItem[]>([]);
  const [tasks, setTasks] = useState<ShareableItem[]>([]);
  const [funnels, setFunnels] = useState<ShareableItem[]>([]);

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const [leadsRes, tasksRes, funnelsRes] = await Promise.all([
        supabase.from('leads').select('id, name, email').limit(50),
        supabase.from('tasks').select('id, title, status').limit(50),
        supabase.from('funis').select('id, nome, descricao').limit(50)
      ]);

      if (leadsRes.data) {
        setLeads(leadsRes.data.map(l => ({
          id: l.id,
          name: l.name,
          subtitle: l.email || undefined
        })));
      }

      if (tasksRes.data) {
        setTasks(tasksRes.data.map(t => ({
          id: t.id,
          name: t.title,
          subtitle: t.status
        })));
      }

      if (funnelsRes.data) {
        setFunnels(funnelsRes.data.map(f => ({
          id: f.id,
          name: f.nome,
          subtitle: f.descricao || undefined
        })));
      }
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredItems = (items: ShareableItem[]) => {
    if (!search.trim()) return items;
    const searchLower = search.toLowerCase();
    return items.filter(
      item => 
        item.name.toLowerCase().includes(searchLower) ||
        item.subtitle?.toLowerCase().includes(searchLower)
    );
  };

  const handleSelect = (item: ShareableItem) => {
    onShare(activeTab, item.id, item.name);
  };

  const renderItemList = (items: ShareableItem[], icon: React.ReactNode) => {
    const filtered = getFilteredItems(items);

    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (filtered.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          {search ? 'Nenhum resultado encontrado' : 'Nenhum item disponível'}
        </p>
      );
    }

    return (
      <ScrollArea className="h-[280px]">
        <div className="divide-y">
          {filtered.map(item => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                {item.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">
                    {item.subtitle}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartilhar Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="lead" className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                Leads
              </TabsTrigger>
              <TabsTrigger value="task" className="flex-1">
                <CheckSquare className="h-4 w-4 mr-2" />
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="funnel" className="flex-1">
                <Layers className="h-4 w-4 mr-2" />
                Funis
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lead" className="mt-4">
              {renderItemList(leads, <Users className="h-5 w-5" />)}
            </TabsContent>

            <TabsContent value="task" className="mt-4">
              {renderItemList(tasks, <CheckSquare className="h-5 w-5" />)}
            </TabsContent>

            <TabsContent value="funnel" className="mt-4">
              {renderItemList(funnels, <Layers className="h-5 w-5" />)}
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
