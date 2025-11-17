import { supabase } from "@/integrations/supabase/client";

/**
 * Download original file (admin only)
 * @param bucket - Bucket name (covers-originals or chapters-originals)
 * @param path - File path in bucket
 * @returns Blob of original file
 */
export async function downloadOriginal(
  bucket: "covers-originals" | "chapters-originals",
  path: string
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) throw error;
  if (!data) throw new Error("File not found");

  return data;
}

/**
 * Get audit logs (admin only)
 * @param limit - Number of logs to retrieve
 * @param action - Filter by action type
 * @returns Array of audit log entries
 */
export async function getAuditLogs(
  limit: number = 100,
  action?: string
): Promise<any[]> {
  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) {
    query = query.eq("action", action);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

/**
 * Clear rate limit for user (admin only)
 * @param identifier - User ID or IP address
 * @param action - Specific action to clear, or null for all
 */
export async function clearRateLimit(
  identifier: string,
  action?: string
): Promise<void> {
  let query = supabase
    .from("rate_limits")
    .delete()
    .eq("identifier", identifier);

  if (action) {
    query = query.eq("action", action);
  }

  const { error } = await query;
  if (error) throw error;
}

/**
 * Get storage statistics (admin only)
 * @returns Storage usage statistics
 */
export async function getStorageStats(): Promise<{
  coversSize: number;
  coversOriginalsSize: number;
  chaptersSize: number;
  chaptersOriginalsSize: number;
  adsSize: number;
}> {
  // Note: Supabase doesn't provide direct API for bucket size
  // This would need to be implemented via custom Edge Function
  // that queries storage.objects table
  
  return {
    coversSize: 0,
    coversOriginalsSize: 0,
    chaptersSize: 0,
    chaptersOriginalsSize: 0,
    adsSize: 0,
  };
}

/**
 * List all files in a bucket (admin only)
 * @param bucket - Bucket name
 * @param path - Optional path prefix
 * @returns List of files
 */
export async function listBucketFiles(
  bucket: string,
  path: string = ""
): Promise<any[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path, {
      limit: 1000,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (error) throw error;
  return data || [];
}
