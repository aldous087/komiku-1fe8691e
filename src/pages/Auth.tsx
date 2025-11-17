import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { X } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only set up auth state change listener, don't auto-redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Don't redirect on auth state change, let user navigate manually
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const validated = authSchema.parse({ email, password });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast.error("Email atau password salah");
        } else {
          toast.error(error.message);
        }
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleData) {
        // Admin user - send OTP for 2FA
        try {
          const { error: otpError } = await supabase.functions.invoke("send-admin-otp", {
            body: { email: validated.email },
          });

          if (otpError) {
            toast.error("Gagal mengirim OTP. Silakan coba lagi.");
            await supabase.auth.signOut();
            return;
          }

          toast.success("Kode OTP telah dikirim ke email Anda");
          navigate("/admin/verify-otp", { state: { email: validated.email } });
        } catch (error) {
          console.error("Error sending OTP:", error);
          toast.error("Terjadi kesalahan saat mengirim OTP");
          await supabase.auth.signOut();
        }
      } else {
        // Regular user - login directly
        toast.success("Berhasil login!");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      const validated = authSchema.parse({ email, password });
      
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast.error("Email sudah terdaftar");
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success("Berhasil daftar! Silakan login.");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClose}
        className="absolute top-4 left-4 h-10 w-10 rounded-full bg-background/50 hover:bg-background/80 backdrop-blur-sm border border-border/20 z-50"
      >
        <X className="h-5 w-5" />
      </Button>
      
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-xl bg-gradient-hero flex items-center justify-center font-bold text-white shadow-glow mx-auto mb-4">
            K
          </div>
          <h1 className="text-2xl font-bold">Selamat Datang di KomikRu</h1>
          <p className="text-muted-foreground text-sm">
            Login atau daftar untuk melanjutkan
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Daftar</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? "Loading..." : "Login"}
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Password (min. 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSignup()}
            />
            <Button
              className="w-full"
              onClick={handleSignup}
              disabled={loading}
            >
              {loading ? "Loading..." : "Daftar"}
            </Button>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;
