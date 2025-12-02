// Fetch Comic List Edge Function - Secured with Admin Auth & Rate Limiting

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as cheerio from 'https://esm.sh/cheerio@1.0.0-rc.12';
import { 
  requireAdmin, 
  checkRateLimit, 
  errorResponse,
  logAdminAction 
} from '../_shared/securityHelpers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit: 10 bulk fetch requests per minute per user
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const lastRequestTime: Record<string, number> = {};
const MIN_DELAY_MS = 2000;

async function safeFetch(url: string): Promise<string> {
  const hostname = new URL(url).hostname;
  const now = Date.now();
  const lastTime = lastRequestTime[hostname] || 0;
  const timeSinceLastRequest = now - lastTime;
  
  if (timeSinceLastRequest < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - timeSinceLastRequest));
  }
  
  lastRequestTime[hostname] = Date.now();
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

async function scrapeManHwaList(baseUrl: string, page: number = 1) {
  const url = `${baseUrl}manga/?page=${page}`;
  console.log(`Scraping ManHwaList: ${url}`);
  
  const html = await safeFetch(url);
  const $ = cheerio.load(html);
  const comics: any[] = [];

  $('.bs .bsx').each((_, el) => {
    const $el = $(el);
    const $link = $el.find('a').first();
    const sourceUrl = $link.attr('href');
    const title = $el.find('.tt').text().trim() || $link.attr('title')?.trim();
    const coverUrl = $el.find('img').first().attr('src');
    const status = $el.find('.status').text().trim();
    const genres = $el.find('.limit .genre a').map((_, g) => $(g).text().trim()).get();

    if (sourceUrl && title) {
      comics.push({
        title,
        sourceUrl,
        coverUrl,
        status: status || 'Ongoing',
        genres: genres.length > 0 ? genres : null,
      });
    }
  });

  const hasNextPage = $('.pagination .next').length > 0;
  return { comics, hasNextPage };
}

async function scrapeShinigami(baseUrl: string, page: number = 1) {
  const url = `${baseUrl}manga/?page=${page}`;
  console.log(`Scraping Shinigami: ${url}`);
  
  const html = await safeFetch(url);
  const $ = cheerio.load(html);
  const comics: any[] = [];

  $('.listupd .utao').each((_, el) => {
    const $el = $(el);
    const $link = $el.find('a').first();
    const sourceUrl = $link.attr('href');
    const title = $el.find('.luf h4, .luf h3').text().trim() || $link.attr('title')?.trim();
    const coverUrl = $el.find('.limit img').first().attr('src');
    const status = $el.find('.status').text().trim();

    if (sourceUrl && title) {
      comics.push({
        title,
        sourceUrl,
        coverUrl,
        status: status || 'Ongoing',
        genres: null,
      });
    }
  });

  const hasNextPage = $('.pagination .next, .hpage .r').length > 0;
  return { comics, hasNextPage };
}

async function scrapeKomikCast(baseUrl: string, page: number = 1) {
  const url = page === 1 ? `${baseUrl}komik/` : `${baseUrl}komik/page/${page}/`;
  console.log(`Scraping KomikCast: ${url}`);
  
  const html = await safeFetch(url);
  const $ = cheerio.load(html);
  const comics: any[] = [];

  $('.list-update_item, .list-update .animepost').each((_, el) => {
    const $el = $(el);
    const $link = $el.find('a').first();
    const sourceUrl = $link.attr('href');
    const title = $el.find('.list-title, .data .title').text().trim() || $link.attr('title')?.trim();
    const coverUrl = $el.find('.list-cover img, img').first().attr('src');
    const status = $el.find('.status').text().trim();

    if (sourceUrl && title) {
      comics.push({
        title,
        sourceUrl,
        coverUrl,
        status: status || 'Ongoing',
        genres: null,
      });
    }
  });

  const hasNextPage = $('.pagination .next, .pagination a.next').length > 0;
  return { comics, hasNextPage };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // === SECURITY: Require Admin Authentication ===
    const authResult = await requireAdmin(req);
    
    if (!authResult.authorized) {
      console.log('Auth failed:', authResult.error);
      return errorResponse(
        authResult.error || 'Unauthorized',
        authResult.statusCode || 401,
        corsHeaders
      );
    }

    const userId = authResult.userId!;
    console.log(`Admin user ${userId} authenticated for bulk fetch`);

    // === SECURITY: Rate Limiting ===
    const rateLimit = checkRateLimit(`fetch-list:${userId}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for user ${userId}`);
      return errorResponse(
        'Rate limit exceeded. Please wait before making more requests.',
        429,
        corsHeaders
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sourceCode, maxPages = 5 } = await req.json();

    // Limit maxPages to prevent abuse
    const safeMaxPages = Math.min(maxPages, 10);

    // Get sources
    const { data: sources } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true);

    if (!sources || sources.length === 0) {
      return errorResponse('No active sources found', 404, corsHeaders);
    }

    let totalComics = 0;
    const errors: string[] = [];

    for (const source of sources) {
      // Skip if specific source requested
      if (sourceCode && sourceCode !== 'ALL' && source.code !== sourceCode) {
        continue;
      }

      console.log(`Processing source: ${source.code}`);
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && currentPage <= safeMaxPages) {
        try {
          let result;
          
          if (source.code === 'MANHWALIST') {
            result = await scrapeManHwaList(source.base_url, currentPage);
          } else if (source.code === 'SHINIGAMI') {
            result = await scrapeShinigami(source.base_url, currentPage);
          } else if (source.code === 'KOMIKCAST') {
            result = await scrapeKomikCast(source.base_url, currentPage);
          } else {
            console.log(`Unknown source code: ${source.code}`);
            break;
          }

          if (!result || result.comics.length === 0) {
            break;
          }

          // Save comics to database
          for (const comic of result.comics) {
            const slug = comic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const sourceSlug = comic.sourceUrl.split('/').filter(Boolean).pop() || slug;

            try {
              await supabase
                .from('komik')
                .upsert({
                  title: comic.title,
                  slug: slug,
                  cover_url: comic.coverUrl,
                  status: comic.status,
                  genres: comic.genres,
                  source_id: source.id,
                  source_slug: sourceSlug,
                  source_url: comic.sourceUrl,
                  updated_at: new Date().toISOString(),
                }, {
                  onConflict: 'source_id,source_slug',
                  ignoreDuplicates: false,
                });
              
              totalComics++;
            } catch (err) {
              console.error(`Error saving comic ${comic.title}:`, err);
            }
          }

          await supabase.from('scrape_logs').insert({
            source_id: source.id,
            target_url: `${source.base_url}manga/?page=${currentPage}`,
            action: 'FETCH_COMIC_LIST',
            status: 'SUCCESS',
          });

          hasMore = result.hasNextPage;
          currentPage++;
          
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error on page ${currentPage} for ${source.code}:`, errorMsg);
          errors.push(`${source.code} page ${currentPage}: ${errorMsg}`);
          
          await supabase.from('scrape_logs').insert({
            source_id: source.id,
            target_url: `${source.base_url}manga/?page=${currentPage}`,
            action: 'FETCH_COMIC_LIST',
            status: 'FAILED',
            error_message: errorMsg,
          });
          
          break;
        }
      }
    }

    // Log admin action
    await logAdminAction(supabase, userId, 'FETCH_COMIC_LIST', 'bulk_scrape', undefined, {
      sourceCode: sourceCode || 'ALL',
      totalComics,
      errors: errors.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalComics,
        errors: errors.length > 0 ? errors : undefined,
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: new Date(rateLimit.resetAt).toISOString(),
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
