// Security helper functions for Edge Functions

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Private IP ranges for SSRF prevention
const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^169\.254\.\d{1,3}\.\d{1,3}$/,
];

// Allowed scraper domains whitelist
const ALLOWED_SCRAPER_DOMAINS = [
  'manhwalist.com',
  'www.manhwalist.com',
  'shinigami.sh',
  'www.shinigami.sh',
  'komikcast.lol',
  'www.komikcast.lol',
  'komiku.org',
  'www.komiku.org',
  'komikindo.ch',
  'www.komikindo.ch',
  'mangadex.org',
  'www.mangadex.org',
];

// Rate limit tracking (in-memory, per function instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Validate JWT and return user info
 */
export async function validateAuth(req: Request): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  return { valid: true, userId: user.id };
}

/**
 * Check if user has admin role
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  });

  if (error) {
    console.error('Error checking admin role:', error);
    return false;
  }

  return data === true;
}

/**
 * Full admin authentication check
 */
export async function requireAdmin(req: Request): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
  statusCode?: number;
}> {
  const authResult = await validateAuth(req);
  
  if (!authResult.valid) {
    return { 
      authorized: false, 
      error: authResult.error, 
      statusCode: 401 
    };
  }

  const adminCheck = await isAdmin(authResult.userId!);
  
  if (!adminCheck) {
    return { 
      authorized: false, 
      error: 'Admin access required', 
      statusCode: 403 
    };
  }

  return { authorized: true, userId: authResult.userId };
}

/**
 * Simple in-memory rate limiter
 */
export function checkRateLimit(
  identifier: string, 
  maxRequests: number, 
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;
  
  let entry = rateLimitMap.get(key);
  
  if (!entry || entry.resetAt <= now) {
    // Create new window
    entry = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }
  
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  
  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Validate URL is safe for scraping (SSRF prevention)
 */
export function isValidScraperUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Check hostname is not a private IP
    const hostname = parsedUrl.hostname.toLowerCase();
    
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'Private/local addresses are not allowed' };
      }
    }

    // Check against whitelist
    const isAllowed = ALLOWED_SCRAPER_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return { valid: false, error: `Domain ${hostname} is not in the allowed list` };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Create error response with CORS headers
 */
export function errorResponse(
  message: string, 
  statusCode: number, 
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { 
      status: statusCode, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Log admin action to audit_logs
 */
export async function logAdminAction(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await supabase.rpc('log_audit_event', {
      _user_id: userId,
      _action: action,
      _resource_type: resourceType,
      _resource_id: resourceId || null,
      _metadata: metadata || null,
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
