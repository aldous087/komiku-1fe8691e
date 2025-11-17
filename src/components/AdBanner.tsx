import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdBannerProps {
  position: string;
}

export const AdBanner = ({ position }: AdBannerProps) => {
  const { data: ad } = useQuery({
    queryKey: ["ad", position],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .eq("position", position)
        .eq("is_active", true)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  if (!ad) return null;

  const content = (
    <div className="w-full rounded-xl overflow-hidden shadow-card my-6">
      {ad.image_url && (
        <img 
          src={ad.image_url} 
          alt="Advertisement" 
          className="w-full h-auto"
        />
      )}
    </div>
  );

  if (ad.link_url) {
    return (
      <a 
        href={ad.link_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block transition-smooth hover:opacity-90"
      >
        {content}
      </a>
    );
  }

  return content;
};
