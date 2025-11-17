import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { BookOpen, FileText, MessageSquare, Eye } from "lucide-react";

const AdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [komikRes, chaptersRes, commentsRes] = await Promise.all([
        supabase.from("komik").select("id", { count: "exact", head: true }),
        supabase.from("chapters").select("id", { count: "exact", head: true }),
        supabase.from("comments").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalKomik: komikRes.count || 0,
        totalChapters: chaptersRes.count || 0,
        totalComments: commentsRes.count || 0,
      };
    },
  });

  const statCards = [
    { label: "Total Komik", value: stats?.totalKomik || 0, icon: BookOpen, color: "text-primary" },
    { label: "Total Chapters", value: stats?.totalChapters || 0, icon: FileText, color: "text-secondary" },
    { label: "Total Komentar", value: stats?.totalComments || 0, icon: MessageSquare, color: "text-accent" },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold mt-2">{stat.value}</p>
              </div>
              <stat.icon className={`h-12 w-12 ${stat.color}`} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
