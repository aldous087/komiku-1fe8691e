import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KomikCard } from "@/components/KomikCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Bookmarks = () => {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: bookmarks, isLoading } = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*, komik(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="min-h-screen pb-20 flex flex-col items-center justify-center">
        <Bookmark className="h-16 w-16 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Silakan login untuk melihat bookmark</p>
        <Link to="/auth">
          <Button>Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <h1 className="text-3xl font-bold mb-6">Bookmark Saya</h1>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : bookmarks && bookmarks.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {bookmarks.map((bookmark) => (
            <KomikCard key={bookmark.id} komik={bookmark.komik} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <Bookmark className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Belum ada bookmark</p>
        </div>
      )}
    </div>
  );
};

export default Bookmarks;
