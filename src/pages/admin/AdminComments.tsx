import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const AdminComments = () => {
  const queryClient = useQueryClient();

  const { data: comments } = useQuery({
    queryKey: ["admin-comments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select(`
          *,
          komik:komik_id (
            title,
            slug
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Komentar berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["admin-comments-list"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Terjadi kesalahan");
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Manajemen Komentar</h1>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          {comments?.map((comment) => (
            <div key={comment.id} className="flex items-start gap-4 p-4 border border-border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{comment.username}</h3>
                  <span className="text-sm text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">{comment.komik?.title}</span>
                </div>
                <p className="text-sm">{comment.text}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(comment.created_at).toLocaleString("id-ID")}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => deleteMutation.mutate(comment.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminComments;
