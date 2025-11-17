import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Flame, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";

interface Comic {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  origin_country: string;
  country_flag_url: string | null;
  chapter_count: number;
  rating_admin: number;
  is_color: boolean;
}

interface PopularComicsCarouselProps {
  title: string;
  sortBy: "popularity" | "trending" | "new";
}

export const PopularComicsCarousel = ({ title, sortBy }: PopularComicsCarouselProps) => {
  const [comics, setComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchComics();
  }, [sortBy]);

  const fetchComics = async () => {
    try {
      let query = supabase.from("komik").select("*");

      switch (sortBy) {
        case "popularity":
          query = query.order("popularity_score", { ascending: false });
          break;
        case "trending":
          query = query.order("views_today", { ascending: false });
          break;
        case "new":
          query = query.order("updated_at", { ascending: false });
          break;
      }

      const { data, error } = await query.limit(12);

      if (error) throw error;
      setComics(data || []);
    } catch (error) {
      console.error("Error fetching comics:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating / 2);
    const hasHalfStar = rating % 2 >= 1;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <span key={i} className="text-yellow-400">
            ★
          </span>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <span key={i} className="text-yellow-400 relative">
            <span className="absolute inset-0 overflow-hidden w-1/2">★</span>
            <span className="text-muted">★</span>
          </span>
        );
      } else {
        stars.push(
          <span key={i} className="text-muted">
            ★
          </span>
        );
      }
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-foreground">{title}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 px-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <img 
            src="https://i.imgur.com/3qj5XqH.png" 
            alt="Luffy" 
            className="w-10 h-10 object-contain"
          />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground bg-accent px-6 py-2 rounded-r-full">
          {title}
        </h2>
      </div>

      <Carousel
        opts={{
          align: "start",
          loop: true,
        }}
        plugins={[
          Autoplay({
            delay: 5000,
          }),
        ]}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {comics.map((comic) => (
            <CarouselItem key={comic.id} className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/6">
              <Card
                className="group cursor-pointer overflow-hidden border-0 bg-card hover:scale-105 transition-transform duration-300"
                onClick={() => navigate(`/komik/${comic.slug}`)}
              >
                <div className="relative aspect-[2/3]">
                  {/* Cover Image */}
                  <img
                    src={comic.cover_url || "/placeholder.svg"}
                    alt={comic.title}
                    className="w-full h-full object-cover"
                  />

                  {/* Top Left - HOT Badge */}
                  <div className="absolute top-0 left-0">
                    <div className="w-0 h-0 border-l-[60px] border-l-red-600 border-b-[60px] border-b-transparent">
                      <Flame className="absolute top-2 left-[-52px] w-5 h-5 text-white" />
                    </div>
                  </div>

                  {/* Top Right - Country Flag */}
                  {comic.country_flag_url && (
                    <div className="absolute top-2 right-2">
                      <img
                        src={comic.country_flag_url}
                        alt={comic.origin_country}
                        className="w-8 h-6 object-cover rounded shadow-lg border border-white/20"
                      />
                    </div>
                  )}

                  {/* Bottom Left - WARNA Badge */}
                  {comic.is_color && (
                    <div className="absolute bottom-2 left-2">
                      <div className="bg-yellow-400 text-black px-3 py-1 rounded-md flex items-center gap-1 font-bold text-xs">
                        <Palette className="w-3 h-3" />
                        WARNA
                      </div>
                    </div>
                  )}
                </div>

                {/* Comic Info */}
                <div className="p-3 space-y-1">
                  <h3 className="font-semibold text-sm line-clamp-2 text-foreground min-h-[40px]">
                    {comic.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Chapter {comic.chapter_count}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex text-sm">
                      {renderStars(comic.rating_admin || 0)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {(comic.rating_admin || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-0" />
        <CarouselNext className="right-0" />
      </Carousel>
    </div>
  );
};
