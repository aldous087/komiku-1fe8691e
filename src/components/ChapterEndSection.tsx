import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, RotateCcw, List } from "lucide-react";
import { ChapterCommentSection } from "./ChapterCommentSection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ChapterEndSectionProps {
  komikId: string;
  komikSlug: string;
  chapterId: string;
  currentChapterNumber: number;
  nextChapter: { id: string; chapter_number: number } | null;
}

export const ChapterEndSection = ({ 
  komikId, 
  komikSlug, 
  chapterId, 
  currentChapterNumber,
  nextChapter 
}: ChapterEndSectionProps) => {
  const navigate = useNavigate();

  const { data: chapterAds } = useQuery({
    queryKey: ["chapter-ads"],
    queryFn: async () => {
      const slots = ["chapter-ad-1", "chapter-ad-2", "chapter-ad-3"];
      const promises = slots.map(async (position) => {
        const { data, error } = await supabase
          .from("ads")
          .select("*")
          .eq("position", position)
          .eq("is_active", true)
          .maybeSingle();
        
        if (error) throw error;
        return { position, ad: data };
      });
      
      const results = await Promise.all(promises);
      return results.filter(result => result.ad !== null);
    },
  });

  const getFileType = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (extension === 'mp4' || extension === 'webm') return 'video';
    return 'image';
  };

  const renderAd = (ad: any) => {
    const content = getFileType(ad.image_url) === 'video' ? (
      <video
        src={ad.image_url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-[95px] md:h-[120px] lg:h-[150px] block"
        style={{ 
          objectFit: 'contain',
          objectPosition: 'center',
        }}
      />
    ) : (
      <img
        src={ad.image_url}
        alt="Chapter Advertisement"
        className="w-full h-[95px] md:h-[120px] lg:h-[150px] block"
        style={{ 
          objectFit: 'contain',
          objectPosition: 'center',
        }}
      />
    );

    return ad.link_url ? (
      <a
        href={ad.link_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full hover:opacity-95 transition-opacity"
      >
        {content}
      </a>
    ) : (
      content
    );
  };

  const handleReplay = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="w-full bg-background">
      {/* Chapter Comments */}
      <ChapterCommentSection komikId={komikId} chapterId={chapterId} />

      {/* Chapter Ads */}
      {chapterAds && chapterAds.length > 0 && (
        <div className="w-full space-y-[3px] my-[3px]">
          {chapterAds.map(({ ad }) => (
            <div key={ad.id} className="w-full">
              {renderAd(ad)}
            </div>
          ))}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="w-full py-8 px-4">
        <div className="max-w-[720px] mx-auto space-y-3">
          {nextChapter ? (
            <Link to={`/read/${komikSlug}/${nextChapter.chapter_number}`} className="block">
              <Button 
                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-base font-semibold shadow-lg"
              >
                Chapter Selanjutnya
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link to={`/komik/${komikSlug}`} className="block">
              <Button 
                className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-base font-semibold shadow-lg"
              >
                <List className="mr-2 h-5 w-5" />
                Kembali ke Daftar Chapter
              </Button>
            </Link>
          )}

          <Button 
            variant="outline"
            onClick={handleReplay}
            className="w-full h-12 rounded-xl border-2 hover:bg-accent/10"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Baca Ulang Chapter Ini
          </Button>
        </div>
      </div>
    </div>
  );
};
