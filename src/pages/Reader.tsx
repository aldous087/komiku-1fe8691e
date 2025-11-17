import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { useState, useEffect } from "react";
import { AdBanner } from "@/components/AdBanner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Reader = () => {
  const { slug, chapterNumber } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [showNav, setShowNav] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const { data: komik } = useQuery({
    queryKey: ["komik-reader", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: chapter, isLoading } = useQuery({
    queryKey: ["chapter-reader", komik?.id, chapterNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("komik_id", komik!.id)
        .eq("chapter_number", Number(chapterNumber))
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!komik?.id,
  });

  const { data: images } = useQuery({
    queryKey: ["chapter-images", chapter?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapter_images")
        .select("*")
        .eq("chapter_id", chapter!.id)
        .order("order_index", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!chapter?.id,
  });

  const { data: allChapters } = useQuery({
    queryKey: ["all-chapters", komik?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("komik_id", komik!.id)
        .order("chapter_number", { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!komik?.id,
  });

  const saveHistoryMutation = useMutation({
    mutationFn: async () => {
      if (!user || !komik || !chapter) return;
      
      const { error } = await supabase
        .from("reading_history")
        .upsert({
          user_id: user.id,
          komik_id: komik.id,
          chapter_id: chapter.id,
          last_page: images?.length || 0,
        }, {
          onConflict: "user_id,komik_id,chapter_id",
        });
      
      if (error) throw error;
    },
  });

  useEffect(() => {
    if (user && komik && chapter) {
      saveHistoryMutation.mutate();
    }
  }, [user, komik, chapter]);

  const currentChapterIndex = allChapters?.findIndex((c) => c.id === chapter?.id) ?? -1;
  const prevChapter = currentChapterIndex > 0 ? allChapters?.[currentChapterIndex - 1] : null;
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < (allChapters?.length || 0) - 1 
    ? allChapters?.[currentChapterIndex + 1] 
    : null;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="w-full aspect-[3/4]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-0 relative">
      {/* Top Nav */}
      <div 
        className={`sticky top-0 z-40 bg-card/90 backdrop-blur-lg border-b border-border transition-smooth ${
          showNav ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to={`/komik/${slug}`}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          
          <div className="flex-1 mx-4">
            <h1 className="font-semibold text-sm truncate">{komik?.title}</h1>
            <p className="text-xs text-muted-foreground">Chapter {chapterNumber}</p>
          </div>

          <Select
            value={chapter?.id}
            onValueChange={(chapterId) => {
              const selectedChapter = allChapters?.find((c) => c.id === chapterId);
              if (selectedChapter) {
                navigate(`/read/${slug}/${selectedChapter.chapter_number}`);
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allChapters?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Ch. {c.chapter_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Images */}
      <div className="space-y-0" onClick={() => setShowNav(!showNav)}>
        {images?.map((img, index) => (
          <div key={img.id}>
            <img
              src={img.image_url}
              alt={`Page ${index + 1}`}
              className="w-full h-auto"
              loading="lazy"
            />
            {index === Math.floor(images.length / 2) && (
              <AdBanner position="reader" />
            )}
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div className="sticky bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border py-4 px-4">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto gap-4">
          {prevChapter ? (
            <Link to={`/read/${slug}/${prevChapter.chapter_number}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
            </Link>
          ) : (
            <Button variant="outline" disabled className="flex-1">
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
          )}

          <Link to={`/komik/${slug}`} className="flex-1">
            <Button variant="secondary" className="w-full gap-2">
              <Menu className="h-4 w-4" />
              Chapters
            </Button>
          </Link>

          {nextChapter ? (
            <Link to={`/read/${slug}/${nextChapter.chapter_number}`} className="flex-1">
              <Button variant="outline" className="w-full gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" disabled className="flex-1">
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reader;
