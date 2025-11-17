import { Card } from "@/components/ui/card";
import { Flame, Palette } from "lucide-react";

interface ComicPreviewCardProps {
  title: string;
  coverUrl: string | null;
  countryFlagUrl: string | null;
  originCountry: string;
  chapterCount: number;
  rating: number;
  isColor: boolean;
}

export const ComicPreviewCard = ({
  title,
  coverUrl,
  countryFlagUrl,
  originCountry,
  chapterCount,
  rating,
  isColor,
}: ComicPreviewCardProps) => {
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

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Live Preview</h3>
      <Card className="overflow-hidden border-2 max-w-[200px]">
        <div className="relative aspect-[2/3]">
          {/* Cover Image */}
          <img
            src={coverUrl || "/placeholder.svg"}
            alt={title}
            className="w-full h-full object-cover"
          />

          {/* Top Left - HOT Badge */}
          <div className="absolute top-0 left-0">
            <div className="w-0 h-0 border-l-[60px] border-l-red-600 border-b-[60px] border-b-transparent">
              <Flame className="absolute top-2 left-[-52px] w-5 h-5 text-white" />
            </div>
          </div>

          {/* Top Right - Country Flag */}
          {countryFlagUrl && (
            <div className="absolute top-2 right-2">
              <img
                src={countryFlagUrl}
                alt={originCountry}
                className="w-8 h-6 object-cover rounded shadow-lg border border-white/20"
              />
            </div>
          )}

          {/* Bottom Left - WARNA Badge */}
          {isColor && (
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
          <h3 className="font-semibold text-sm line-clamp-2 min-h-[40px]">
            {title || "Untitled Comic"}
          </h3>
          <p className="text-xs text-muted-foreground">
            Chapter {chapterCount}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex text-sm">
              {renderStars(rating || 0)}
            </div>
            <span className="text-xs text-muted-foreground">
              {(rating || 0).toFixed(2)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
