import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user and check admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check admin role
    const { data: hasAdminRole } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!hasAdminRole) {
      throw new Error('Admin access required');
    }

    // Rate limiting: 30 flag uploads per hour per user
    const rateLimitIdentifier = user.id;
    const { data: canProceed } = await supabase.rpc('check_rate_limit', {
      _identifier: rateLimitIdentifier,
      _action: 'upload_flag',
      _max_requests: 30,
      _window_minutes: 60
    });

    if (!canProceed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 30 flag uploads per hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: UploadRequest = await req.json();
    const { fileName, fileType, fileSize } = body;

    // Validate input
    if (!fileName || !fileType) {
      throw new Error('Missing required fields');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(fileType)) {
      throw new Error('Invalid file type. Only JPEG, PNG, WebP, and SVG allowed.');
    }

    // Validate file size (2MB max for flags)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (fileSize > maxSize) {
      throw new Error('File too large. Maximum size is 2MB.');
    }

    // Generate UUID for file name
    const fileExt = fileName.split('.').pop();
    const uuid = crypto.randomUUID();
    const filePath = `${uuid}.${fileExt}`;

    // Generate signed upload URL (1 hour expiry)
    const { data: signedUrl, error: signedError } = await supabase
      .storage
      .from('flags')
      .createSignedUploadUrl(filePath);

    if (signedError) {
      throw new Error('Failed to generate upload URL');
    }

    // Log audit event
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    await supabase.rpc('log_audit_event', {
      _user_id: user.id,
      _action: 'request_flag_upload',
      _resource_type: 'flag',
      _resource_id: uuid,
      _ip_address: clientIp,
      _user_agent: userAgent,
      _metadata: { fileName, fileSize, fileType }
    });

    // Get the public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('flags')
      .getPublicUrl(filePath);

    return new Response(
      JSON.stringify({
        uploadUrl: signedUrl.signedUrl,
        filePath,
        publicUrl: publicUrlData.publicUrl,
        expiresIn: 3600
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in secure-upload-flag:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
