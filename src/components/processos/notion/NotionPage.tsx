import { useState, useEffect, useCallback } from "react";
import { 
  Star, 
  StarOff, 
  MoreHorizontal,
  Clock,
  Share2,
  Trash2,
  Image as ImageIcon,
  Copy,
  Download,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BlockEditor } from "./BlockEditor";
import { PageAssignees } from "./PageAssignees";
import { PageTags } from "./PageTags";
import { PageStatus } from "./PageStatus";
import { PageComments } from "./PageComments";
import { PageHistory } from "./PageHistory";
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
  properties: any;
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
  const [properties, setProperties] = useState<any>(page.properties || {});

  useEffect(() => {
    setTitle(page.title);
    setIcon(page.icon);
    setProperties(page.properties || {});
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
    setTitle(e.target.value);
  };

  const handleTitleBlur = () => {
    if (title !== page.title) {
      updateTitle(title);
    }
  };

  const handleBlocksChange = (newBlocks: Block[]) => {
    setBlocks(newBlocks);
  };

  const handlePropertyUpdate = (key: string, value: any) => {
    const newProperties = { ...properties, [key]: value };
    setProperties(newProperties);
  };

  const copyPublicLink = () => {
    const link = `${window.location.origin}/processos/page/${page.id}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const exportAsMarkdown = () => {
    let markdown = `# ${title}\n\n`;
    blocks.forEach(block => {
      const text = block.content.text || '';
      switch (block.block_type) {
        case 'heading1': markdown += `# ${text}\n\n`; break;
        case 'heading2': markdown += `## ${text}\n\n`; break;
        case 'heading3': markdown += `### ${text}\n\n`; break;
        case 'bullet_list': markdown += `- ${text}\n`; break;
        case 'numbered_list': markdown += `1. ${text}\n`; break;
        case 'checklist': markdown += `- [${block.content.checked ? 'x' : ' '}] ${text}\n`; break;
        case 'quote': markdown += `> ${text}\n\n`; break;
        case 'code': markdown += `\`\`\`\n${text}\n\`\`\`\n\n`; break;
        case 'divider': markdown += `---\n\n`; break;
        default: markdown += `${text}\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo exportado!');
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

      {/* Page Header with all controls */}
      <div className="border-b border-border px-6 py-3 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between gap-4">
          {/* Left side - Icon, Title, Status */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-medium truncate max-w-[200px]">{title || 'Sem título'}</span>
            <PageStatus 
              pageId={page.id}
              status={properties.status || 'draft'}
              onUpdate={(status) => handlePropertyUpdate('status', status)}
            />
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-1">
            <PageAssignees
              pageId={page.id}
              assignees={properties.assignees || []}
              onUpdate={(assignees) => handlePropertyUpdate('assignees', assignees)}
            />
            
            <Separator orientation="vertical" className="h-6 mx-1" />
            
            <Button variant="ghost" size="sm" onClick={toggleFavorite}>
              {page.is_favorite ? (
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ) : (
                <StarOff className="h-4 w-4" />
              )}
            </Button>
            
            <PageComments pageId={page.id} />
            
            <PageHistory pageId={page.id} onRestore={loadBlocks} />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={copyPublicLink}>
                  <Share2 className="h-4 w-4 mr-2" /> Copiar Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportAsMarkdown}>
                  <Download className="h-4 w-4 mr-2" /> Exportar Markdown
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-2 mt-2">
          <PageTags
            pageId={page.id}
            tags={properties.tags || []}
            onUpdate={(tags) => handlePropertyUpdate('tags', tags)}
          />
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
