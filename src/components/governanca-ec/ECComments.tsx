import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/external-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Send, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ECCommentsProps {
  recordId?: string;
  cardId: string;
}

export function ECComments({ recordId, cardId }: ECCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  const { data: comments, isLoading } = useQuery({
    queryKey: ['ec-record-comments', recordId],
    queryFn: async () => {
      if (!recordId) return [];
      
      const { data, error } = await supabase
        .from('ec_record_comments')
        .select(`
          *,
          created_by_profile:profiles!ec_record_comments_created_by_fkey(id, first_name, last_name, avatar_url)
        `)
        .eq('record_id', recordId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!recordId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!recordId || !newComment.trim()) return;

      const { error } = await supabase
        .from('ec_record_comments')
        .insert({
          record_id: recordId,
          text: newComment.trim(),
          created_by: user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comentário adicionado');
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['ec-record-comments', recordId] });
    },
    onError: () => {
      toast.error('Erro ao adicionar comentário');
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from('ec_record_comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Comentário removido');
      queryClient.invalidateQueries({ queryKey: ['ec-record-comments', recordId] });
    },
    onError: () => {
      toast.error('Erro ao remover comentário');
    },
  });

  if (!recordId) {
    return (
      <Card className="p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Salve o registro primeiro para adicionar comentários.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {/* Formulário para novo comentário */}
      <div className="mb-6">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Adicione um comentário..."
          rows={3}
        />
        <div className="flex justify-end mt-2">
          <Button
            onClick={() => addCommentMutation.mutate()}
            disabled={!newComment.trim() || addCommentMutation.isPending}
          >
            {addCommentMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar
          </Button>
        </div>
      </div>

      {/* Lista de comentários */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded" />
            <div className="h-20 bg-muted rounded" />
          </div>
        ) : comments && comments.length > 0 ? (
          comments.map((comment: any) => (
            <div 
              key={comment.id}
              className="flex gap-3 p-3 bg-muted/30 rounded-lg"
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={comment.created_by_profile?.avatar_url} />
                <AvatarFallback>
                  {comment.created_by_profile?.first_name?.[0]}
                  {comment.created_by_profile?.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.created_by_profile?.first_name} {comment.created_by_profile?.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  
                  {comment.created_by === user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                      disabled={deleteCommentMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap">{comment.text}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-muted-foreground text-sm py-8">
            Nenhum comentário ainda. Seja o primeiro a comentar!
          </p>
        )}
      </div>
    </Card>
  );
}
