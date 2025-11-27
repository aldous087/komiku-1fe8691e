import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, PutObjectCommand } from "https://esm.sh/@aws-sdk/client-s3@3";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

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

// Rate limiting
const lastRequestTime: Map<string, number> = new Map();
const MIN_DELAY_MS = 2000;

async function safeFetch(url: string): Promise<string> {
  const hostname = new URL(url).hostname;
  const lastTime = lastRequestTime.get(hostname) || 0;
  const now = Date.now();
  const timeSinceLastRequest = now - lastTime;

  if (timeSinceLastRequest < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - timeSinceLastRequest));
  }

  lastRequestTime.set(hostname, Date.now());

  const response = await fetch(url, {
    headers: {
      'User-Agent': Deno.env.get('SCRAPER_USER_AGENT') || 'Mozilla/5.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

function extractChapterNumber(text: string): number {
  const patterns = [
    /chapter[\s-]*(\d+(?:\.\d+)?)/i,
    /ch[\s-]*(\d+(?:\.\d+)?)/i,
    /ep[\s-]*(\d+(?:\.\d+)?)/i,
    /episode[\s-]*(\d+(?:\.\d+)?)/i,
    /#(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseFloat(match[1]);
    }
  }

  return 0;
}

async function scrapeChapterPages(sourceCode: string, url: string): Promise<{ pageNumber: number; imageUrl: string }[]> {
  const html = await safeFetch(url);
  const $ = cheerio.load(html);
  const pages: { pageNumber: number; imageUrl: string }[] = [];

  if (sourceCode === 'MANHWALIST') {
    $('#readerarea img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('loading')) {
        pages.push({
          pageNumber: i + 1,
          imageUrl: src.trim(),
        });
      }
    });
  } else if (sourceCode === 'SHINIGAMI') {
    $('.chapter-images img').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('loading')) {
        pages.push({
          pageNumber: i + 1,
          imageUrl: src.trim(),
        });
      }
    });
  } else if (sourceCode === 'KOMIKCAST') {
    $('#chapter_body img').each((i, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('loader')) {
        pages.push({
          pageNumber: i + 1,
          imageUrl: src.trim(),
        });
      }
    });
  }

  return pages;
}

async function uploadImageToR2(
  imageUrl: string,
  destinationPath: string
): Promise<string> {
  try {
    // Fetch image from source
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': Deno.env.get('SCRAPER_USER_AGENT') || 'Mozilla/5.0',
        'Referer': new URL(imageUrl).origin,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: destinationPath,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
        CacheControl: 'public, max-age=86400', // 24 hours
      })
    );

    // Return public URL
    return `${R2_PUBLIC_URL}/${destinationPath}`;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw error;
  }
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

    const { chapterId } = await req.json();

    if (!chapterId) {
      throw new Error('chapterId is required');
    }

    // Fetch chapter details
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('*, komik!inner(*)')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapter) {
      throw new Error('Chapter not found');
    }

    // Fetch source info
    const { data: source } = await supabase
      .from('sources')
      .select('*')
      .eq('id', (chapter as any).komik.source_id)
      .single();


    // Check existing cache
    const { data: existingCache } = await supabase
      .from('chapter_pages')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('page_number');

    // If cache exists and not expired, return it
    if (existingCache && existingCache.length > 0) {
      const firstPage = existingCache[0];
      if (firstPage.expires_at && new Date(firstPage.expires_at) > new Date()) {
        return new Response(
          JSON.stringify({
            chapterId,
            cached: true,
            pages: existingCache.map((p: any) => ({
              pageNumber: p.page_number,
              imageUrl: p.cached_image_url,
            })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Cache expired or doesn't exist - delete old cache
    if (existingCache && existingCache.length > 0) {
      await supabase
        .from('chapter_pages')
        .delete()
        .eq('chapter_id', chapterId);
    }

    // Scrape chapter pages
    const sourceCode = source?.code || 'MANHWALIST';
    const chapterUrl = (chapter as any).source_url;

    if (!chapterUrl) {
      throw new Error('Chapter source URL not found');
    }

    const scrapedPages = await scrapeChapterPages(sourceCode, chapterUrl);

    if (scrapedPages.length === 0) {
      throw new Error('No pages found');
    }

    // Upload to R2 and save to database
    const komikId = (chapter as any).komik.id;
    const chapterNumber = (chapter as any).chapter_number;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const insertData = [];

    for (const page of scrapedPages) {
      const fileExt = page.imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const destinationPath = `chapter-cache/${komikId}/${chapterNumber}/${String(page.pageNumber).padStart(3, '0')}.${fileExt}`;

      try {
        const r2Url = await uploadImageToR2(page.imageUrl, destinationPath);

        insertData.push({
          chapter_id: chapterId,
          page_number: page.pageNumber,
          source_image_url: page.imageUrl,
          cached_image_url: r2Url,
          cached_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      } catch (uploadError) {
        console.error(`Failed to upload page ${page.pageNumber}:`, uploadError);
        // Continue with other pages
      }
    }

    // Insert all pages
    const { error: insertError } = await supabase
      .from('chapter_pages')
      .insert(insertData);

    if (insertError) {
      console.error('Error inserting cache:', insertError);
    }

    // Log success
    await supabase.from('scrape_logs').insert({
      source_id: (chapter as any).komik.source_id,
      action: 'CACHE_CHAPTER',
      target_url: chapterUrl,
      status: 'SUCCESS',
    });

    return new Response(
      JSON.stringify({
        chapterId,
        cached: false,
        pages: insertData.map((p) => ({
          pageNumber: p.page_number,
          imageUrl: p.cached_image_url,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cache-chapter:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
