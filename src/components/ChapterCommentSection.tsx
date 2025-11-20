import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Trash2, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface ChapterCommentSectionProps {
  komikId: string;
  chapterId: string;
}

export const ChapterCommentSection = ({ komikId, chapterId }: ChapterCommentSectionProps) => {
  const [user, setUser] = useState<any>(null);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: comments } = useQuery({
    queryKey: ["chapter-comments", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        toast.error("Silakan login terlebih dahulu");
        return;
      }
      if (!comment.trim()) {
        toast.error("Komentar tidak boleh kosong");
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        "sanitize-comment",
        {
          body: {
            komikId,
            chapterId,
            text: comment,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapter-comments", chapterId] });
      setComment("");
      toast.success("Komentar berhasil ditambahkan");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapter-comments", chapterId] });
      toast.success("Komentar berhasil dihapus");
    },
  });

  return (
    <div className="w-full bg-background py-8 px-4">
      <div className="max-w-[720px] mx-auto">
        <h2 className="text-xl font-bold mb-6">Komentar Chapter</h2>
        
        {/* Add Comment */}
        {user ? (
          <div className="mb-6 space-y-3">
            <Textarea
              placeholder="Tulis komentar untuk chapter ini..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="bg-[#1E1E1E] border-border text-foreground rounded-xl resize-none"
              rows={3}
            />
            <Button 
              onClick={() => addCommentMutation.mutate()}
              className="bg-primary hover:bg-primary/90 rounded-xl"
            >
              Kirim Komentar
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground mb-6 text-sm">
            Silakan login untuk memberikan komentar
          </p>
        )}

        {/* Comments List */}
        <div className="space-y-4">
          {comments?.map((c) => (
            <div 
              key={c.id} 
              className="bg-[#1E1E1E] rounded-2xl p-4 border border-border/50"
            >
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary/20 text-primary text-xs">
                    {c.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-sm text-foreground">
                      {c.username}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(c.created_at), { 
                          addSuffix: true,
                          locale: id 
                        })}
                      </span>
                      {user?.id === c.user_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => deleteCommentMutation.mutate(c.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-foreground/90 leading-relaxed break-words">
                    {c.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
          
          {comments && comments.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">
              Belum ada komentar. Jadilah yang pertama berkomentar!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
