import { useState, useEffect, useCallback } from "react";
import { 
  Star, 
  StarOff, 
  MoreHorizontal,
  Clock,
  MessageSquare,
  History,
  Share2,
  Trash2,
  Image as ImageIcon,
  Smile
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BlockEditor } from "./BlockEditor";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessPage {
  id: string;
  title: string;
  icon: string;
  cover_url: string | null;
  page_type: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface Block {
  id: string;
  block_type: string;
  content: any;
  position: number;
}

interface NotionPageProps {
  page: ProcessPage;
  onPageUpdate: () => void;
}

const EMOJI_LIST = ['📄', '📝', '📋', '📌', '📎', '📁', '📂', '💼', '💡', '🎯', '🚀', '✨', '⭐', '🔥', '💪', '🎨', '🎭', '🎬', '🎪', '🎢', '📊', '📈', '📉', '💹', '💰', '💵', '💳', '🏆', '🥇', '🎖️', '🏅', '📱', '💻', '🖥️', '⌨️', '🖱️', '🔧', '⚙️', '🔩', '🔨', '📞', '☎️', '📧', '✉️', '📬', '📮', '🗂️', '📑', '📓', '📔', '📒', '📕', '📗', '📘', '📙'];

export function NotionPage({ page, onPageUpdate }: NotionPageProps) {
  const [title, setTitle] = useState(page.title);
  const [icon, setIcon] = useState(page.icon);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    setTitle(page.title);
    setIcon(page.icon);
    loadBlocks();
  }, [page.id]);

  const loadBlocks = async () => {
    try {
      const { data, error } = await supabase
        .from('process_blocks')
        .select('*')
        .eq('page_id', page.id)
        .order('position', { ascending: true });

      if (error) throw error;
      setBlocks(data || []);
    } catch (error) {
      console.error('Error loading blocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateTitle = useCallback(async (newTitle: string) => {
    try {
      await supabase
        .from('process_pages')
        .update({ title: newTitle })
        .eq('id', page.id);
      onPageUpdate();
    } catch (error) {
      console.error('Error updating title:', error);
    }
  }, [page.id, onPageUpdate]);

  const updateIcon = async (newIcon: string) => {
    try {
      await supabase
        .from('process_pages')
        .update({ icon: newIcon })
        .eq('id', page.id);
      setIcon(newIcon);
      setShowEmojiPicker(false);
      onPageUpdate();
    } catch (error) {
      toast.error('Erro ao atualizar ícone');
    }
  };

  const toggleFavorite = async () => {
    try {
      await supabase
        .from('process_pages')
        .update({ is_favorite: !page.is_favorite })
        .eq('id', page.id);
      onPageUpdate();
      toast.success(page.is_favorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos');
    } catch (error) {
      toast.error('Erro ao atualizar favorito');
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
  };

  const handleTitleBlur = () => {
    if (title !== page.title) {
      updateTitle(title);
    }
  };

  const handleBlocksChange = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Cover Image Area */}
      {page.cover_url && (
        <div 
          className="h-48 bg-cover bg-center relative group"
          style={{ backgroundImage: `url(${page.cover_url})` }}
        >
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button variant="secondary" size="sm">
              <ImageIcon className="h-4 w-4 mr-2" /> Alterar capa
            </Button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium truncate max-w-[200px]">{title || 'Sem título'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFavorite}
          >
            {page.is_favorite ? (
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff className="h-4 w-4" />
            )}
          </Button>
          
          <Button variant="ghost" size="sm">
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <History className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Share2 className="h-4 w-4 mr-2" /> Compartilhar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <History className="h-4 w-4 mr-2" /> Histórico
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Page Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-8">
          {/* Icon & Title */}
          <div className="mb-8">
            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <PopoverTrigger asChild>
                <button className="text-6xl hover:bg-muted/50 p-2 rounded-lg transition-colors mb-4">
                  {icon}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3">
                <div className="grid grid-cols-8 gap-1">
                  {EMOJI_LIST.map((emoji) => (
                    <button
                      key={emoji}
                      className="p-2 text-xl hover:bg-muted rounded transition-colors"
                      onClick={() => updateIcon(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              onBlur={handleTitleBlur}
              placeholder="Sem título"
              className="w-full text-4xl font-bold bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50"
            />
            
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Atualizado em {format(new Date(page.updated_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Block Editor */}
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando conteúdo...
            </div>
          ) : (
            <BlockEditor
              pageId={page.id}
              blocks={blocks}
              onBlocksChange={handleBlocksChange}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
