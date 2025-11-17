import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";

interface KomikCardProps {
  komik: {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    status: string | null;
    view_count: number | null;
    genres: string[] | null;
  };
  showViews?: boolean;
}

export const KomikCard = ({ komik, showViews }: KomikCardProps) => {
  return (
    <Link to={`/komik/${komik.slug}`}>
      <div className="group cursor-pointer">
        <div className="relative aspect-[2/3] mb-2 rounded-xl overflow-hidden shadow-card transition-smooth group-hover:shadow-glow group-hover:scale-105">
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
          
          {komik.status && (
            <Badge 
              className="absolute top-2 right-2" 
              variant={komik.status === "Complete" ? "secondary" : "default"}
            >
              {komik.status}
            </Badge>
          )}
        </div>
        
        <h3 className="font-semibold text-sm line-clamp-2 mb-1 group-hover:text-primary transition-smooth">
          {komik.title}
        </h3>
        
        {showViews && komik.view_count !== null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>{komik.view_count.toLocaleString()}</span>
          </div>
        )}
      </div>
    </Link>
  );
};
