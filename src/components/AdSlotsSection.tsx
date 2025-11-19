import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdSlotsSectionProps {
  slots?: number[];
}

export const AdSlotsSection = ({ slots = [1, 2, 3, 4, 5, 6, 7, 8, 9] }: AdSlotsSectionProps) => {
  const { data: ads } = useQuery({
    queryKey: ["home-ad-slots", slots],
    queryFn: async () => {
      const promises = slots.map(async (slotNum) => {
        const { data, error } = await supabase
          .from("ads")
          .select("*")
          .eq("position", `home-slot-${slotNum}`)
          .eq("is_active", true)
          .maybeSingle();
        
        if (error) throw error;
        return { slotNumber: slotNum, ad: data };
      });
      
      const results = await Promise.all(promises);
      return results.filter(result => result.ad !== null);
    },
  });

  if (!ads || ads.length === 0) return null;

  const getFileType = (url: string) => {
    const extension = url.split('.').pop()?.toLowerCase();
    if (extension === 'mp4' || extension === 'webm') return 'video';
    return 'image';
  };

  // Check if we have first 4 slots (1-4) for grid layout
  const isFirstFourSlots = slots.length === 4 && slots.every(s => s >= 1 && s <= 4);
  const firstFourAds = isFirstFourSlots ? ads : [];
  const remainingAds = isFirstFourSlots ? [] : ads;

  const renderBanner = (ad: any, slotNumber: number) => {
    const content = getFileType(ad.image_url) === 'video' ? (
      <video
        src={ad.image_url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full block h-[95px] md:h-[120px] lg:h-[150px]"
        style={{ 
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block'
        }}
      />
    ) : (
      <img
        src={ad.image_url}
        alt={`Banner ${slotNumber}`}
        className="w-full block h-[95px] md:h-[120px] lg:h-[150px]"
        style={{ 
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block'
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

  if (isFirstFourSlots && firstFourAds.length > 0) {
    // Desktop: 2x2 grid for first 4 banners
    // Mobile: Stack vertically
    return (
      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[3px]">
          {firstFourAds.map(({ slotNumber, ad }) => (
            <div key={ad.id} className="w-full">
              {renderBanner(ad, slotNumber)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // For slots 5-12: vertical full width
  return (
    <div className="space-y-[3px]">
      {remainingAds.map(({ slotNumber, ad }) => (
        <div key={ad.id} className="w-full">
          {renderBanner(ad, slotNumber)}
        </div>
      ))}
    </div>
  );
};
