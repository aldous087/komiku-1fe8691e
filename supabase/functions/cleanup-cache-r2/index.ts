import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from "https://esm.sh/@aws-sdk/client-s3@3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// R2 Configuration
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') || '',
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') || '',
  },
});

const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME') || 'komikru';
const R2_PUBLIC_URL = Deno.env.get('R2_PUBLIC_URL') || '';

async function deleteFromR2(filePath: string): Promise<void> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: filePath,
      })
    );
  } catch (error) {
    console.error(`Error deleting ${filePath} from R2:`, error);
  }
}

async function deleteChapterCacheFromR2(
  komikId: string,
  chapterNumber: number
): Promise<number> {
  try {
    const prefix = `chapter-cache/${komikId}/${chapterNumber}/`;

    // List all objects with prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
    });

    const listResult = await r2Client.send(listCommand);

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return 0;
    }

    // Delete all objects
    let deletedCount = 0;
    for (const obj of listResult.Contents) {
      if (obj.Key) {
        await deleteFromR2(obj.Key);
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error deleting chapter cache from R2:', error);
    return 0;
  }
}

function extractR2PathFromUrl(url: string): string {
  if (url.startsWith(R2_PUBLIC_URL)) {
    return url.replace(`${R2_PUBLIC_URL}/`, '');
  }
  return url;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting cleanup-cache-r2...');

    // Find expired cache entries (batch of 500)
    const { data: expiredPages, error: queryError } = await supabase
      .from('chapter_pages')
      .select(`
        *,
        chapters!inner (
          id,
          chapter_number,
          komik_id
        )
      `)
      .lt('expires_at', new Date().toISOString())
      .limit(500);

    if (queryError) {
      throw queryError;
    }

    if (!expiredPages || expiredPages.length === 0) {
      console.log('No expired cache found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired cache found',
          deletedFiles: 0,
          deletedRows: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredPages.length} expired pages`);

    // Group by chapter for efficient R2 deletion
    const chapterGroups = new Map<string, { komikId: string; chapterNumber: number }>();
    const pageIds = [];

    for (const page of expiredPages) {
      const chapter = (page as any).chapters;
      if (chapter) {
        const key = `${chapter.komik_id}-${chapter.chapter_number}`;
        chapterGroups.set(key, {
          komikId: chapter.komik_id,
          chapterNumber: chapter.chapter_number,
        });
      }
      pageIds.push(page.id);
    }

    // Delete files from R2 by chapter
    let totalDeletedFiles = 0;
    for (const [key, { komikId, chapterNumber }] of chapterGroups) {
      console.log(`Deleting cache for chapter: ${key}`);
      const deletedCount = await deleteChapterCacheFromR2(komikId, chapterNumber);
      totalDeletedFiles += deletedCount;
    }

    // Delete rows from database
    const { error: deleteError } = await supabase
      .from('chapter_pages')
      .delete()
      .in('id', pageIds);

    if (deleteError) {
      console.error('Error deleting rows:', deleteError);
    }

    // Log cleanup
    await supabase.from('scrape_logs').insert({
      action: 'CLEANUP_CACHE',
      status: 'SUCCESS',
      error_message: `Deleted ${totalDeletedFiles} files and ${pageIds.length} rows`,
    });

    console.log(`Cleanup complete: ${totalDeletedFiles} files, ${pageIds.length} rows`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Cache cleanup completed',
        deletedFiles: totalDeletedFiles,
        deletedRows: pageIds.length,
        chaptersProcessed: chapterGroups.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cleanup-cache-r2:', error);

    // Log error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      await supabase.from('scrape_logs').insert({
        action: 'CLEANUP_CACHE',
        status: 'FAILED',
        error_message: errorMessage,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
