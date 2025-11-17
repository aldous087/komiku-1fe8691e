import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, Eye, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { CommentSection } from "@/components/CommentSection";
import { AdBanner } from "@/components/AdBanner";

const KomikDetail = () => {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: komik, isLoading } = useQuery({
    queryKey: ["komik-detail", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error("Komik tidak ditemukan");
      
      // Increment view count
      await supabase
        .from("komik")
        .update({ view_count: (data.view_count || 0) + 1 })
        .eq("id", data.id);
      
      return data;
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["chapters", komik?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("komik_id", komik!.id)
        .order("chapter_number", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!komik?.id,
  });

  const { data: isBookmarked } = useQuery({
    queryKey: ["bookmark", komik?.id, user?.id],
    queryFn: async () => {
      if (!user || !komik) return false;
      const { data, error } = await supabase
        .from("bookmarks")
        .select("id")
        .eq("user_id", user.id)
        .eq("komik_id", komik.id)
        .maybeSingle();
      
      return !!data;
    },
    enabled: !!user && !!komik,
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        toast.error("Silakan login terlebih dahulu");
        return;
      }

      const { data, error } = await supabase.rpc("toggle_bookmark", {
        _user_id: user.id,
        _komik_id: komik!.id,
      });

      if (error) throw error;
      return data as { is_bookmarked: boolean; bookmark_id: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bookmark", komik?.id, user?.id] });
      toast.success(data?.is_bookmarked ? "Ditambahkan ke bookmark" : "Dihapus dari bookmark");
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20">
        <Skeleton className="w-full h-[350px] rounded-xl mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!komik) return <div>Komik tidak ditemukan</div>;

  return (
    <div className="min-h-screen pb-20">
      {/* Cover Image */}
      <div className="w-full mb-6">
        <div className="w-full max-h-[350px] rounded-xl overflow-hidden shadow-glow">
          {komik.cover_url ? (
            <img 
              src={komik.cover_url} 
              alt={komik.title} 
              className="w-full h-full max-h-[350px] object-cover" 
            />
          ) : (
            <div className="w-full h-[350px] bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <span className="text-muted-foreground">No Cover</span>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-bold mb-4">{komik.title}</h1>
      
      {/* Bookmark Button */}
      <Button
        className="w-full gap-2 mb-4"
        variant={isBookmarked ? "secondary" : "default"}
        onClick={() => bookmarkMutation.mutate()}
      >
        <Bookmark className={`h-4 w-4 ${isBookmarked ? "fill-current" : ""}`} />
        {isBookmarked ? "Di Bookmark" : "Tambah Bookmark"}
      </Button>
      
      {/* Genre Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {komik.status && <Badge>{komik.status}</Badge>}
        {komik.genres?.map((genre) => (
          <Badge key={genre} variant="outline">{genre}</Badge>
        ))}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <div className="flex items-center gap-1">
          <Eye className="h-4 w-4" />
          <span>{komik.view_count?.toLocaleString() || 0} views</span>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen className="h-4 w-4" />
          <span>{chapters?.length || 0} chapters</span>
        </div>
      </div>

      <p className="text-muted-foreground mb-6">{komik.description}</p>

      {/* Ad Banner - Detail Sidebar */}
      <AdBanner position="detail-sidebar" />

      {/* Chapters */}
      <Card className="p-4 mb-8">
        <h2 className="text-xl font-bold mb-4">Daftar Chapter</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {chapters?.map((chapter) => (
            <Link
              key={chapter.id}
              to={`/read/${komik.slug}/${chapter.chapter_number}`}
              className="block"
            >
              <div className="p-3 rounded-lg hover:bg-muted transition-smooth flex justify-between items-center">
                <span className="font-medium">
                  Chapter {chapter.chapter_number}
                  {chapter.title && ` - ${chapter.title}`}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(chapter.created_at).toLocaleDateString("id-ID")}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Comments */}
      <CommentSection komikId={komik.id} />
    </div>
  );
};

export default KomikDetail;
