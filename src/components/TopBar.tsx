import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export const TopBar = () => {
  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-lg border-b border-border">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-hero flex items-center justify-center font-bold text-white shadow-glow">
            K
          </div>
          <span className="text-xl font-bold">KomikRu</span>
        </Link>
        
        <Link to="/search">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Search className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
};
