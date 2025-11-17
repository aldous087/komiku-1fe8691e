import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

const AdminChapters = () => {
  const { data: chapters } = useQuery({
    queryKey: ["admin-chapters-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select(`
          *,
          komik:komik_id (
            title,
            slug
          )
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manajemen Chapter</h1>
        <Link to="/admin/chapters/tambah">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah Chapter
          </Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          {chapters?.map((chapter) => (
            <div key={chapter.id} className="flex items-center gap-4 p-4 border border-border rounded-lg">
              <div className="flex-1">
                <h3 className="font-semibold">
                  {chapter.komik?.title} - Chapter {chapter.chapter_number}
                </h3>
                <p className="text-sm text-muted-foreground">{chapter.title}</p>
              </div>
              <Link to={`/admin/chapters/${chapter.id}/edit`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminChapters;
