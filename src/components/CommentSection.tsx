import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface CommentSectionProps {
  komikId: string;
}

export const CommentSection = ({ komikId }: CommentSectionProps) => {
  const [user, setUser] = useState<any>(null);
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: comments } = useQuery({
    queryKey: ["comments", komikId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("komik_id", komikId)
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

      // Use sanitize-comment Edge Function for security
      const { data, error } = await supabase.functions.invoke(
        "sanitize-comment",
        {
          body: {
            komikId,
            text: comment,
          },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", komikId] });
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
      queryClient.invalidateQueries({ queryKey: ["comments", komikId] });
      toast.success("Komentar berhasil dihapus");
    },
  });

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Komentar</h2>
      
      {/* Add Comment */}
      {user ? (
        <div className="mb-6">
          <Textarea
            placeholder="Tulis komentar..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-2"
          />
          <Button onClick={() => addCommentMutation.mutate()}>
            Kirim Komentar
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground mb-6">
          Silakan login untuk memberikan komentar
        </p>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments?.map((c) => (
          <div key={c.id} className="border-b border-border pb-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-semibold">{c.username}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {new Date(c.created_at).toLocaleDateString("id-ID", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {user?.id === c.user_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteCommentMutation.mutate(c.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm">{c.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
