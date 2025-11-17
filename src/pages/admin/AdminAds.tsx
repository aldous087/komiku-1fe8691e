import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";

const AdminAds = () => {
  const { data: ads } = useQuery({
    queryKey: ["admin-ads-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Manajemen Iklan</h1>
        <Link to="/admin/ads/tambah">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah Iklan
          </Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          {ads?.map((ad) => (
            <div key={ad.id} className="flex items-center gap-4 p-4 border border-border rounded-lg">
              <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0">
                {ad.image_url ? (
                  <img src={ad.image_url} alt="Ad" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{ad.position}</h3>
                <p className="text-sm text-muted-foreground">
                  Status: {ad.is_active ? "Aktif" : "Nonaktif"}
                </p>
              </div>
              <Link to={`/admin/ads/${ad.id}/edit`}>
                <Button variant="outline" size="sm">Edit</Button>
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AdminAds;
