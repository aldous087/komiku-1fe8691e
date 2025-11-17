import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { KomikCard } from "@/components/KomikCard";
import { AdBanner } from "@/components/AdBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { HotComicsCarousel } from "@/components/HotComicsCarousel";
import { PopularComicsCarousel } from "@/components/PopularComicsCarousel";
import { DomainNotice } from "@/components/DomainNotice";

const Home = () => {
  const { data: latestKomik, isLoading: latestLoading } = useQuery({
    queryKey: ["latest-komik"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(12);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: popularKomik, isLoading: popularLoading } = useQuery({
    queryKey: ["popular-komik"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("*")
        .order("view_count", { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen pb-20">
      {/* Hot Comics Carousel */}
      <HotComicsCarousel />

      {/* Ad Banner */}
      <AdBanner position="header" />

      {/* Domain Notice */}
      <DomainNotice />

      {/* Popular Carousels */}
      <PopularComicsCarousel title="Terpopuler Hari Ini" sortBy="popularity" />
      
      <AdBanner position="mid" />
      
      <PopularComicsCarousel title="Trending" sortBy="trending" />
      
      <PopularComicsCarousel title="Baru Rilis" sortBy="new" />

      {/* Latest Updates */}
      <section className="mb-8 px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Update Terbaru</h2>
          <Link to="/library">
            <Button variant="ghost" size="sm">Lihat Semua</Button>
          </Link>
        </div>
        
        {latestLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {latestKomik?.map((komik) => (
              <KomikCard key={komik.id} komik={komik} />
            ))}
          </div>
        )}
      </section>

      {/* Popular Comics */}
      <section className="mb-8 px-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-6 w-6 text-secondary" />
          <h2 className="text-2xl font-bold">Komik Populer</h2>
        </div>
        
        {popularLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[2/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {popularKomik?.map((komik) => (
              <KomikCard key={komik.id} komik={komik} showViews />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
