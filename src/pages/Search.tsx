import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { KomikCard } from "@/components/KomikCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon } from "lucide-react";

const Search = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isLoading } = useQuery({
    queryKey: ["search-komik", debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("komik")
        .select("*")
        .ilike("title", `%${debouncedQuery}%`)
        .order("title", { ascending: true })
        .limit(24);
      
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="min-h-screen pb-20">
      <h1 className="text-3xl font-bold mb-6">Cari Komik</h1>
      
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Cari judul komik..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 py-6 text-lg"
          autoFocus
        />
      </div>

      {!query ? (
        <div className="text-center py-20">
          <SearchIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Mulai ketik untuk mencari komik</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Ditemukan {results.length} komik
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {results.map((komik) => (
              <KomikCard key={komik.id} komik={komik} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Tidak ada hasil untuk "{query}"</p>
        </div>
      )}
    </div>
  );
};

export default Search;
