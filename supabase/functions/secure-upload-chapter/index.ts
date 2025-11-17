import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  komikId: string;
  chapterId: string;
  files: Array<{
    fileName: string;
    fileType: string;
    fileSize: number;
    index: number;
  }>;
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

    // Rate limiting: 50 chapter images per hour per user
    const rateLimitIdentifier = user.id;
    const { data: canProceed } = await supabase.rpc('check_rate_limit', {
      _identifier: rateLimitIdentifier,
      _action: 'upload_chapter',
      _max_requests: 50,
      _window_minutes: 60
    });

    if (!canProceed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 50 chapter images per hour.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: UploadRequest = await req.json();
    const { komikId, chapterId, files } = body;

    // Validate input
    if (!komikId || !chapterId || !files || files.length === 0) {
      throw new Error('Missing required fields');
    }

    // Validate file types and sizes
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 20 * 1024 * 1024; // 20MB

    const uploadUrls = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.fileType)) {
        throw new Error(`Invalid file type for ${file.fileName}. Only JPEG, PNG, and WebP allowed.`);
      }

      if (file.fileSize > maxSize) {
        throw new Error(`File ${file.fileName} too large. Maximum size is 20MB.`);
      }

      // Generate UUID for file name
      const fileExt = file.fileName.split('.').pop();
      const uuid = crypto.randomUUID();
      const paddedIndex = String(file.index).padStart(3, '0');
      
      // Create signed URLs for both original and derivative
      const originalPath = `${komikId}/${chapterId}/original-${paddedIndex}-${uuid}.${fileExt}`;
      const derivativePath = `${komikId}/${chapterId}/${paddedIndex}.${fileExt}`;

      // Generate signed upload URLs (1 hour expiry)
      const { data: originalSignedUrl, error: originalError } = await supabase
        .storage
        .from('chapters-originals')
        .createSignedUploadUrl(originalPath);

      const { data: derivativeSignedUrl, error: derivativeError } = await supabase
        .storage
        .from('chapters')
        .createSignedUploadUrl(derivativePath);

      if (originalError || derivativeError) {
        throw new Error('Failed to generate upload URLs');
      }

      uploadUrls.push({
        index: file.index,
        fileName: file.fileName,
        originalUploadUrl: originalSignedUrl.signedUrl,
        derivativeUploadUrl: derivativeSignedUrl.signedUrl,
        originalPath,
        derivativePath
      });
    }

    // Log audit event
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    
    await supabase.rpc('log_audit_event', {
      _user_id: user.id,
      _action: 'request_chapter_upload',
      _resource_type: 'chapter',
      _resource_id: chapterId,
      _ip_address: clientIp,
      _user_agent: userAgent,
      _metadata: { komikId, fileCount: files.length }
    });

    return new Response(
      JSON.stringify({
        uploadUrls,
        expiresIn: 3600
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in secure-upload-chapter:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
