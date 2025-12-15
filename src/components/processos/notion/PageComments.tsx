import { useState, useEffect } from "react";
import { MessageSquare, Send, MoreHorizontal, Trash2, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  is_resolved: boolean;
  parent_comment_id: string | null;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface PageCommentsProps {
  pageId: string;
  blockId?: string;
}

export function PageComments({ pageId, blockId }: PageCommentsProps) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadComments();
    }
  }, [open, pageId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('process_comments')
        .select('*')
        .eq('page_id', pageId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch user profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const commentsWithUsers = data.map(c => ({
          ...c,
          user: profileMap.get(c.user_id)
        }));
        setComments(commentsWithUsers);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // First, get any block ID for this page
      const { data: blocks } = await supabase
        .from('process_blocks')
        .select('id')
        .eq('page_id', pageId)
        .limit(1);

      const targetBlockId = blockId || blocks?.[0]?.id;
      if (!targetBlockId) {
        // Create a placeholder block if none exists
        const { data: newBlock } = await supabase
          .from('process_blocks')
          .insert({
            page_id: pageId,
            block_type: 'paragraph',
            content: { text: '' },
            position: 0
          })
          .select()
          .single();
        
        if (!newBlock) {
          toast.error('Erro ao criar comentário');
          return;
        }
      }

      const { error } = await supabase
        .from('process_comments')
        .insert({
          page_id: pageId,
          block_id: targetBlockId || blockId,
          user_id: user.user.id,
          content: newComment.trim(),
          parent_comment_id: replyingTo
        });

      if (error) throw error;

      setNewComment("");
      setReplyingTo(null);
      await loadComments();
      toast.success('Comentário adicionado');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erro ao adicionar comentário');
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await supabase
        .from('process_comments')
        .delete()
        .eq('id', commentId);

      await loadComments();
      toast.success('Comentário excluído');
    } catch (error) {
      toast.error('Erro ao excluir comentário');
    }
  };

  const toggleResolved = async (comment: Comment) => {
    try {
      await supabase
        .from('process_comments')
        .update({ is_resolved: !comment.is_resolved })
        .eq('id', comment.id);

      await loadComments();
    } catch (error) {
      toast.error('Erro ao atualizar comentário');
    }
  };

  const getInitials = (name: string = 'U') => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const rootComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_comment_id === parentId);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <MessageSquare className="h-4 w-4" />
          {comments.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {comments.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentários
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
          <div className="space-y-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : rootComments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>Nenhum comentário ainda</p>
                <p className="text-sm">Seja o primeiro a comentar!</p>
              </div>
            ) : (
              rootComments.map((comment) => (
                <div key={comment.id} className="space-y-2">
                  <div className={`p-3 rounded-lg ${comment.is_resolved ? 'bg-muted/50 opacity-60' : 'bg-muted'}`}>
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={comment.user?.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(comment.user?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {comment.user?.full_name || 'Usuário'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), "dd/MM HH:mm", { locale: ptBR })}
                          </span>
                          {comment.is_resolved && (
                            <Badge variant="outline" className="text-xs">Resolvido</Badge>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => setReplyingTo(comment.id)}
                          >
                            <Reply className="h-3 w-3 mr-1" />
                            Responder
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={() => toggleResolved(comment)}
                          >
                            {comment.is_resolved ? 'Reabrir' : 'Resolver'}
                          </Button>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteComment(comment.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Replies */}
                  {getReplies(comment.id).map((reply) => (
                    <div key={reply.id} className="ml-8 p-3 rounded-lg bg-muted/50 border-l-2 border-primary/20">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={reply.user?.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(reply.user?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-xs">
                              {reply.user?.full_name || 'Usuário'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(reply.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{reply.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* New Comment Input */}
        <div className="mt-4 pt-4 border-t space-y-2">
          {replyingTo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Reply className="h-4 w-4" />
              <span>Respondendo a um comentário</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2"
                onClick={() => setReplyingTo(null)}
              >
                Cancelar
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              placeholder="Adicionar comentário..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey) {
                  addComment();
                }
              }}
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">⌘ + Enter para enviar</span>
            <Button onClick={addComment} disabled={!newComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Comentar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
