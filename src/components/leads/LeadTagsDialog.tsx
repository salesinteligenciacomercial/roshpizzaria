import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tag, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LeadTagsDialogProps {
  leadId: string;
  currentTags?: string[];
  onTagsUpdated: () => void;
  triggerButton?: React.ReactNode;
}

export function LeadTagsDialog({ leadId, currentTags = [], onTagsUpdated, triggerButton }: LeadTagsDialogProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(currentTags);
  const [newTag, setNewTag] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTags(currentTags);
    }
  }, [open, currentTags]);

  const adicionarTag = () => {
    const tagTrimmed = newTag.trim();
    if (!tagTrimmed) {
      toast.error("Digite uma tag");
      return;
    }

    if (tags.includes(tagTrimmed)) {
      toast.error("Tag já existe");
      return;
    }

    setTags([...tags, tagTrimmed]);
    setNewTag("");
  };

  const removerTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from("leads")
        .update({ tags })
        .eq("id", leadId);

      if (error) throw error;

      toast.success("Tags atualizadas com sucesso!");
      setOpen(false);
      onTagsUpdated();
    } catch (error) {
      console.error("Erro ao atualizar tags:", error);
      toast.error("Erro ao atualizar tags");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm">
            <Tag className="h-4 w-4 mr-2" />
            Gerenciar Tags
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerenciar Tags do Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nova tag..."
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarTag();
                }
              }}
              disabled={loading}
            />
            <Button onClick={adicionarTag} disabled={loading}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 min-h-[100px] p-4 border rounded-md bg-muted/20">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag adicionada</p>
            ) : (
              tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removerTag(tag)}
                    disabled={loading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Salvando..." : "Salvar Tags"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
