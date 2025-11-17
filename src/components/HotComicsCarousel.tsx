import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

export const HotComicsCarousel = () => {
  const { data: hotComics, isLoading } = useQuery({
    queryKey: ["hot-comics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("*")
        .order("rating_admin", { ascending: false })
        .order("view_count", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="gradient-hero p-5 mb-6 rounded-[20px] animate-pulse">
        <div className="h-64 bg-muted/20 rounded-lg" />
      </div>
    );
  }

  if (!hotComics || hotComics.length === 0) {
    return null;
  }

  return (
    <div className="gradient-hero p-5 mb-6 rounded-[20px] shadow-glow">
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-white flex items-center gap-2">
          Hot Komik Hari Ini <Flame className="h-8 w-8 text-orange-500" />
        </h2>
        <p className="text-white/80 mt-1">Komik paling banyak dibaca hari ini</p>
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: 4000,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent>
          {hotComics.map((komik) => (
            <CarouselItem key={komik.id} className="md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
              <Link to={`/komik/${komik.slug}`}>
                <div className="group cursor-pointer">
                  <div className="relative aspect-[2/3] mb-3 rounded-xl overflow-hidden shadow-card transition-smooth group-hover:shadow-glow group-hover:scale-105">
                    {komik.cover_url ? (
                      <img
                        src={komik.cover_url}
                        alt={komik.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-muted-foreground">No Cover</span>
                      </div>
                    )}
                    
                    <Badge 
                      className="absolute top-2 left-2 bg-orange-500 text-white border-none"
                    >
                      Hot
                    </Badge>
                    
                    {komik.rating_admin !== null && komik.rating_admin > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1">
                        ⭐ {komik.rating_admin.toFixed(1)}
                      </div>
                    )}
                  </div>
                  
                  <h3 className="font-semibold text-sm line-clamp-2 text-white group-hover:text-secondary transition-smooth">
                    {komik.title}
                  </h3>
                </div>
              </Link>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="hidden md:flex -left-4" />
        <CarouselNext className="hidden md:flex -right-4" />
      </Carousel>
    </div>
  );
};
