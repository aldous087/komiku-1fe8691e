import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User, History, Settings, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate("/auth");
      } else {
        setUser(data.user);
      }
    });
  }, [navigate]);

  const { data: isAdmin } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: history } = useQuery({
    queryKey: ["reading-history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("reading_history")
        .select("*, komik(*), chapters(*)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Gagal logout");
    } else {
      toast.success("Berhasil logout");
      navigate("/");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pb-20">
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-gradient-hero flex items-center justify-center text-2xl font-bold text-white shadow-glow">
            {user.email?.[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.email}</h2>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Admin" : "User"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {isAdmin && (
            <Link to="/admin">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" />
                Admin Panel
              </Button>
            </Link>
          )}
          
          <Button
            variant="outline"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </Card>

      {/* Reading History */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <History className="h-5 w-5" />
          Riwayat Baca
        </h2>
        
        {history && history.length > 0 ? (
          <div className="space-y-3">
            {history.map((item) => (
              <Link
                key={item.id}
                to={`/komik/${item.komik.slug}`}
                className="block p-3 rounded-lg hover:bg-muted transition-smooth"
              >
                <div className="flex gap-3">
                  <div className="w-12 h-16 rounded overflow-hidden flex-shrink-0">
                    {item.komik.cover_url ? (
                      <img
                        src={item.komik.cover_url}
                        alt={item.komik.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {item.komik.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Chapter {item.chapters.chapter_number}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.updated_at).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Belum ada riwayat baca
          </p>
        )}
      </Card>
    </div>
  );
};

export default Profile;
