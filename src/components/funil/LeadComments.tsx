import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  user?: {
    name?: string;
    email?: string;
  };
}

interface LeadCommentsProps {
  leadId: string;
  onCommentAdded?: () => void;
}

export function LeadComments({ leadId, onCommentAdded }: LeadCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, leadId]);

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_comments")
        .select(`
          id,
          comment,
          created_at,
          updated_at,
          user_id,
          user_roles:user_id (
            name,
            email
          )
        `)
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar comentários:", error);
        // Fallback: tentar carregar sem join se houver erro
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("lead_comments")
          .select(`
            id,
            comment,
            created_at,
            updated_at,
            user_id
          `)
          .eq("lead_id", leadId)
          .order("created_at", { ascending: false });

        if (fallbackError) throw fallbackError;
        setComments((fallbackData || []).map(comment => ({
          ...comment,
          user: { name: "Usuário", email: "" }
        })));
        return;
      }

      setComments(data || []);
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
      toast.error("Erro ao carregar comentários");
    }
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      const { error } = await supabase
        .from("lead_comments")
        .insert({
          lead_id: leadId,
          user_id: session.user.id,
          comment: newComment.trim()
        });

      if (error) throw error;

      setNewComment("");
      toast.success("Comentário adicionado");
      loadComments();
      onCommentAdded?.();
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      toast.error("Erro ao adicionar comentário");
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("lead_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("Comentário removido");
      loadComments();
      onCommentAdded?.();
    } catch (error) {
      console.error("Erro ao remover comentário:", error);
      toast.error("Erro ao remover comentário");
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowComments(!showComments)}
        className="flex items-center gap-2 text-xs"
      >
        <MessageCircle className="h-3 w-3" />
        Comentários ({comments.length})
      </Button>

      {showComments && (
        <Card className="p-3 space-y-3">
          <form onSubmit={addComment} className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Digite seu comentário..."
              className="flex-1 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !newComment.trim()}
              className="px-3"
            >
              <Send className="h-3 w-3" />
            </Button>
          </form>

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhum comentário ainda
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2 p-2 bg-muted/50 rounded-md">
                  <div className="flex-shrink-0">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">
                        {comment.user?.name || comment.user?.email || "Usuário"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground break-words">
                      {comment.comment}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 hover:bg-destructive/10"
                    onClick={() => deleteComment(comment.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
