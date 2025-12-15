import { useState, useEffect } from "react";
import { History, Clock, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Version {
  id: string;
  title: string;
  blocks_snapshot: any;
  created_at: string;
  user_id: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface PageHistoryProps {
  pageId: string;
  onRestore: () => void;
}

export function PageHistory({ pageId, onRestore }: PageHistoryProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, pageId]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('process_page_versions')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Fetch user profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(v => v.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const versionsWithUsers = data.map(v => ({
          ...v,
          user: profileMap.get(v.user_id)
        }));
        setVersions(versionsWithUsers);
      } else {
        setVersions([]);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentVersion = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get current page and blocks
      const { data: page } = await supabase
        .from('process_pages')
        .select('title')
        .eq('id', pageId)
        .single();

      const { data: blocks } = await supabase
        .from('process_blocks')
        .select('*')
        .eq('page_id', pageId)
        .order('position', { ascending: true });

      await supabase
        .from('process_page_versions')
        .insert({
          page_id: pageId,
          user_id: user.user.id,
          title: page?.title || 'Sem título',
          blocks_snapshot: blocks || []
        });

      await loadVersions();
      toast.success('Versão salva!');
    } catch (error) {
      toast.error('Erro ao salvar versão');
    }
  };

  const restoreVersion = async (version: Version) => {
    try {
      // Delete current blocks
      await supabase
        .from('process_blocks')
        .delete()
        .eq('page_id', pageId);

      // Restore blocks from snapshot
      if (version.blocks_snapshot && version.blocks_snapshot.length > 0) {
        const blocksToInsert = version.blocks_snapshot.map((block: any) => ({
          page_id: pageId,
          block_type: block.block_type,
          content: block.content,
          position: block.position,
          parent_block_id: block.parent_block_id
        }));

        await supabase
          .from('process_blocks')
          .insert(blocksToInsert);
      }

      // Update page title
      await supabase
        .from('process_pages')
        .update({ title: version.title })
        .eq('id', pageId);

      setOpen(false);
      onRestore();
      toast.success('Versão restaurada!');
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Erro ao restaurar versão');
    }
  };

  const getInitials = (name: string = 'U') => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <History className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico de Versões
          </SheetTitle>
        </SheetHeader>

        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-muted-foreground">
            {versions.length} versões salvas
          </p>
          <Button size="sm" onClick={saveCurrentVersion}>
            Salvar versão atual
          </Button>
        </div>

        <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
          <div className="space-y-3">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : versions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhuma versão salva</p>
                <p className="text-sm">Clique em "Salvar versão atual" para criar um ponto de restauração</p>
              </div>
            ) : (
              versions.map((version, index) => (
                <div 
                  key={version.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    selectedVersion?.id === version.id 
                      ? 'border-primary bg-primary/5' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedVersion(
                    selectedVersion?.id === version.id ? null : version
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={version.user?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(version.user?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {version.title}
                        </span>
                        {index === 0 && (
                          <Badge variant="secondary" className="text-xs">Mais recente</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(version.created_at), { 
                            addSuffix: true, 
                            locale: ptBR 
                          })}
                        </span>
                        <span>•</span>
                        <span>
                          {format(new Date(version.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        por {version.user?.full_name || 'Usuário'}
                      </p>
                    </div>
                  </div>

                  {selectedVersion?.id === version.id && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => {/* Preview functionality */}}
                      >
                        <Eye className="h-4 w-4" />
                        Visualizar
                      </Button>
                      <Button 
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => restoreVersion(version)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restaurar
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
