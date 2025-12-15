import { useState } from "react";
import { Tag, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TAG_COLORS = [
  { name: 'Vendas', color: 'bg-blue-500/20 text-blue-700 hover:bg-blue-500/30' },
  { name: 'Marketing', color: 'bg-purple-500/20 text-purple-700 hover:bg-purple-500/30' },
  { name: 'Suporte', color: 'bg-green-500/20 text-green-700 hover:bg-green-500/30' },
  { name: 'Onboarding', color: 'bg-orange-500/20 text-orange-700 hover:bg-orange-500/30' },
  { name: 'Urgente', color: 'bg-red-500/20 text-red-700 hover:bg-red-500/30' },
  { name: 'Em Revisão', color: 'bg-yellow-500/20 text-yellow-700 hover:bg-yellow-500/30' },
  { name: 'Arquivado', color: 'bg-gray-500/20 text-gray-700 hover:bg-gray-500/30' },
];

interface PageTagsProps {
  pageId: string;
  tags: string[];
  onUpdate: (tags: string[]) => void;
}

export function PageTags({ pageId, tags, onUpdate }: PageTagsProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");

  const getTagColor = (tagName: string) => {
    const preset = TAG_COLORS.find(t => t.name.toLowerCase() === tagName.toLowerCase());
    return preset?.color || 'bg-primary/20 text-primary hover:bg-primary/30';
  };

  const addTag = async (tagName: string) => {
    if (!tagName.trim() || tags.includes(tagName.trim())) return;
    
    const newTags = [...tags, tagName.trim()];
    
    try {
      await supabase
        .from('process_pages')
        .update({ 
          properties: { tags: newTags }
        })
        .eq('id', pageId);

      onUpdate(newTags);
      setNewTag("");
      toast.success('Tag adicionada');
    } catch (error) {
      toast.error('Erro ao adicionar tag');
    }
  };

  const removeTag = async (tagName: string) => {
    const newTags = tags.filter(t => t !== tagName);
    
    try {
      await supabase
        .from('process_pages')
        .update({ 
          properties: { tags: newTags }
        })
        .eq('id', pageId);

      onUpdate(newTags);
      toast.success('Tag removida');
    } catch (error) {
      toast.error('Erro ao remover tag');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(newTag);
    }
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <Badge 
          key={tag} 
          variant="secondary" 
          className={`${getTagColor(tag)} cursor-pointer group`}
        >
          {tag}
          <X 
            className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" 
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
          />
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 gap-1">
            <Plus className="h-3 w-3" />
            <Tag className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Nova tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 text-sm"
              />
              <Button size="sm" className="h-8" onClick={() => addTag(newTag)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Sugestões</p>
              <div className="flex flex-wrap gap-1">
                {TAG_COLORS.filter(t => !tags.includes(t.name)).map((preset) => (
                  <Badge 
                    key={preset.name}
                    variant="secondary"
                    className={`${preset.color} cursor-pointer text-xs`}
                    onClick={() => addTag(preset.name)}
                  >
                    {preset.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
