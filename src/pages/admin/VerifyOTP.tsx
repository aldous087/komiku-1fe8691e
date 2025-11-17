import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, ArrowLeft } from "lucide-react";

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      toast.error("Email tidak ditemukan. Silakan login kembali.");
      navigate("/auth");
    }
  }, [email, navigate]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast.error("Kode OTP harus 6 digit");
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc("verify_admin_otp", {
        admin_email: email,
        submitted_otp: otp,
      }) as { data: { success: boolean; error?: string; message?: string; attempts_remaining?: number } | null; error: any };

      if (error) {
        console.error("Error verifying OTP:", error);
        toast.error("Terjadi kesalahan saat verifikasi OTP");
        return;
      }

      if (data?.success) {
        toast.success(data.message || "OTP berhasil diverifikasi!");
        navigate("/admin");
      } else {
        toast.error(data?.error || "OTP tidak valid");
        if (data?.attempts_remaining === 0) {
          setOtp("");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      setResending(true);
      
      const { error } = await supabase.functions.invoke("send-admin-otp", {
        body: { email },
      });

      if (error) {
        toast.error("Gagal mengirim ulang OTP");
        return;
      }

      toast.success("OTP baru telah dikirim ke email Anda");
      setOtp("");
    } catch (error) {
      console.error("Error resending OTP:", error);
      toast.error("Terjadi kesalahan saat mengirim ulang OTP");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-hero flex items-center justify-center mx-auto mb-4 shadow-glow">
            <Shield className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verifikasi 2FA</h1>
          <p className="text-muted-foreground">
            Masukkan kode OTP yang telah dikirim ke
          </p>
          <p className="text-primary font-semibold mt-1">{email}</p>
        </div>

        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-bold"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Kode OTP berlaku selama 5 menit. Maksimal 3x percobaan.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || otp.length !== 6}
          >
            {loading ? "Memverifikasi..." : "Verifikasi OTP"}
          </Button>

          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleResendOTP}
              disabled={resending}
            >
              {resending ? "Mengirim..." : "Kirim Ulang OTP"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full gap-2"
              onClick={() => navigate("/auth")}
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Login
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground text-center">
            🔒 Sistem keamanan Two-Factor Authentication (2FA) melindungi akun admin Anda dari akses tidak sah.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default VerifyOTP;
