import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOTPRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email }: SendOTPRequest = await req.json();

    // Verify user is admin
    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Akses ditolak. Anda bukan admin." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OTP using database function
    const { data: otpCode, error: otpError } = await supabaseClient
      .rpc("generate_admin_otp", { admin_email: email });

    if (otpError || !otpCode) {
      console.error("Error generating OTP:", otpError);
      return new Response(
        JSON.stringify({ error: "Gagal menghasilkan OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send OTP email
    const emailResponse = await resend.emails.send({
      from: "KomikRu Admin <onboarding@resend.dev>",
      to: [email],
      subject: "Kode OTP Admin KomikRu",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; text-align: center;">KomikRu Admin</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Kode OTP Anda</h2>
            <p style="color: #4b5563; font-size: 16px;">Gunakan kode OTP berikut untuk melanjutkan login admin:</p>
            <div style="background: white; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px;">${otpCode}</span>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
              ⏱️ Kode ini berlaku selama <strong>5 menit</strong>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 20px;">
              🔒 Anda memiliki <strong>3 kali percobaan</strong> untuk memasukkan kode yang benar
            </p>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin-top: 20px;">
              <p style="color: #92400e; margin: 0; font-size: 14px;">
                ⚠️ Jika Anda tidak meminta kode ini, abaikan email ini. Jangan bagikan kode OTP kepada siapa pun.
              </p>
            </div>
          </div>
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">© ${new Date().getFullYear()} KomikRu. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    if (emailResponse.error) {
      console.error("Error sending email:", emailResponse.error);
      return new Response(
        JSON.stringify({ error: "Gagal mengirim email OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("OTP email sent successfully to:", email);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "OTP berhasil dikirim ke email Anda" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-admin-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
