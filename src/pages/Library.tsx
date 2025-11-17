import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KomikCard } from "@/components/KomikCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "Slice of Life", "Sports"];
const ITEMS_PER_PAGE = 24;

const Library = () => {
  const [status, setStatus] = useState<string>("all");
  const [genre, setGenre] = useState<string>("all");
  const [sort, setSort] = useState<string>("newest");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["library-komik", status, genre, sort, page],
    queryFn: async () => {
      let query = supabase.from("komik").select("*", { count: "exact" });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      if (genre !== "all") {
        query = query.contains("genres", [genre]);
      }

      switch (sort) {
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        case "popular":
          query = query.order("view_count", { ascending: false });
          break;
        case "title":
          query = query.order("title", { ascending: true });
          break;
      }

      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { komik: data, total: count || 0 };
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / ITEMS_PER_PAGE);

  return (
    <div className="min-h-screen pb-20">
      <h1 className="text-3xl font-bold mb-6">Perpustakaan Komik</h1>

      {/* Filters */}
      <div className="mb-6 space-y-4">
        <Tabs value={status} onValueChange={setStatus} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-md">
            <TabsTrigger value="all">Semua</TabsTrigger>
            <TabsTrigger value="Ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="Complete">Complete</TabsTrigger>
            <TabsTrigger value="Hiatus">Hiatus</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-4 max-w-md">
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger>
              <SelectValue placeholder="Genre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Genre</SelectItem>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger>
              <SelectValue placeholder="Urutkan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Terbaru</SelectItem>
              <SelectItem value="popular">Terpopuler</SelectItem>
              <SelectItem value="title">A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            {data?.komik?.map((komik) => (
              <KomikCard key={komik.id} komik={komik} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Sebelumnya
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Halaman {page} dari {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Selanjutnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Library;
