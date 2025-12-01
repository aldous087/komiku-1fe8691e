import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { S3Client, PutObjectCommand, HeadObjectCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.940.0';
import { unzip } from 'https://esm.sh/fflate@0.8.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ComicInfoMetadata {
  title?: string;
  series?: string;
  number?: number;
  summary?: string;
  tags?: string[];
  genres?: string[];
  writer?: string;
  penciller?: string;
  alternativeTitles?: string[];
  pageCount?: number;
  [key: string]: any;
}

interface ProcessedImage {
  pageNumber: number;
  buffer: Uint8Array;
  filename: string;
}

// Initialize R2 client
const R2_CONFIG = {
  accountId: Deno.env.get('R2_ACCOUNT_ID') || '',
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') || '',
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') || '',
  bucketName: Deno.env.get('R2_BUCKET_NAME') || 'komikru',
  publicUrl: Deno.env.get('R2_PUBLIC_URL') || '',
};

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

function parseComicInfoXml(xmlString: string): ComicInfoMetadata {
  // Simple regex-based XML parsing for Deno environment
  const getTextContent = (tagName: string): string | undefined => {
    const regex = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i');
    const match = xmlString.match(regex);
    return match?.[1]?.trim();
  };
  
  const getNumber = (tagName: string): number | undefined => {
    const text = getTextContent(tagName);
    return text ? parseInt(text, 10) : undefined;
  };

  const metadata: ComicInfoMetadata = {
    title: getTextContent('Title'),
    series: getTextContent('Series'),
    number: getNumber('Number'),
    summary: getTextContent('Summary'),
    writer: getTextContent('Writer'),
    penciller: getTextContent('Penciller'),
    pageCount: getNumber('PageCount'),
    tags: [],
    genres: [],
    alternativeTitles: [],
  };

  // Parse tags and genres
  const genre = getTextContent('Genre');
  if (genre) {
    metadata.genres = genre.split(',').map(g => g.trim());
  }

  const tags = getTextContent('Tags');
  if (tags) {
    metadata.tags = tags.split(',').map(t => t.trim());
  }

  // Alternative titles
  const altSeries = getTextContent('AlternateSeries');
  const localizedSeries = getTextContent('LocalizedSeries');
  if (altSeries) metadata.alternativeTitles?.push(altSeries);
  if (localizedSeries) metadata.alternativeTitles?.push(localizedSeries);

  return metadata;
}

function autoDetectMetadata(filename: string, imageCount: number): ComicInfoMetadata {
  // Remove .cbz extension
  const baseName = filename.replace(/\.cbz$/i, '');
  
  // Try to extract chapter number: "Chapter 285", "ch285", "285", etc.
  const chapterMatch = baseName.match(/(?:chapter|ch|ep|episode)[\s\-_]*(\d+)/i);
  const numberMatch = baseName.match(/(\d+)/);
  
  const chapterNumber = chapterMatch 
    ? parseInt(chapterMatch[1], 10) 
    : numberMatch 
    ? parseInt(numberMatch[1], 10) 
    : undefined;

  // Extract series name (everything before chapter number)
  let series = baseName;
  if (chapterMatch) {
    series = baseName.substring(0, chapterMatch.index).trim();
  } else if (numberMatch) {
    series = baseName.substring(0, numberMatch.index).trim();
  }
  
  // Clean up series name
  series = series.replace(/[\-_]+/g, ' ').trim();

  return {
    title: chapterNumber ? `Chapter ${chapterNumber}` : baseName,
    series: series || baseName,
    number: chapterNumber,
    pageCount: imageCount,
    tags: [],
    genres: [],
    alternativeTitles: [],
  };
}

function sortImagesNumerically(files: [string, Uint8Array][]): [string, Uint8Array][] {
  return files.sort((a, b) => {
    const numA = parseInt(a[0].match(/(\d+)/)?.[1] || '0', 10);
    const numB = parseInt(b[0].match(/(\d+)/)?.[1] || '0', 10);
    return numA - numB;
  });
}

async function compressToWebP(imageBuffer: Uint8Array): Promise<Uint8Array> {
  // Convert to base64 for processing
  const base64 = btoa(String.fromCharCode(...imageBuffer));
  const mimeType = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 ? 'image/jpeg' :
                   imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 ? 'image/png' : 'image/jpeg';
  
  // For edge function, we'll use a simple pass-through for now
  // In production, you might want to use a service like Cloudinary or similar
  // For now, we'll return original but plan for webp conversion
  return imageBuffer;
}

async function uploadToR2(path: string, buffer: Uint8Array, contentType: string): Promise<string> {
  try {
    // Check if file already exists
    try {
      await s3Client.send(new HeadObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: path,
      }));
      console.log(`File already exists: ${path}`);
      return `${R2_CONFIG.publicUrl}/${path}`;
    } catch (error: any) {
      if (error.name !== 'NotFound') {
        throw error;
      }
    }

    await s3Client.send(new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: path,
      Body: buffer,
      ContentType: contentType,
    }));

    return `${R2_CONFIG.publicUrl}/${path}`;
  } catch (error) {
    console.error(`Error uploading to R2: ${path}`, error);
    throw error;
  }
}

function generateInfoHtml(metadata: ComicInfoMetadata, chapterNumber: number, totalPages: number): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.series || 'Unknown'} - Chapter ${chapterNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; }
    h1 { color: #333; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .field { margin: 10px 0; }
    .label { font-weight: bold; color: #666; }
  </style>
</head>
<body>
  <h1>${metadata.series || 'Unknown Series'}</h1>
  <h2>Chapter ${chapterNumber}${metadata.title ? ` - ${metadata.title}` : ''}</h2>
  
  <div class="metadata">
    ${metadata.summary ? `
    <div class="field">
      <div class="label">Summary:</div>
      <p>${metadata.summary}</p>
    </div>
    ` : ''}
    
    <div class="field">
      <span class="label">Total Pages:</span> ${totalPages}
    </div>
    
    ${metadata.genres && metadata.genres.length > 0 ? `
    <div class="field">
      <span class="label">Genres:</span> ${metadata.genres.join(', ')}
    </div>
    ` : ''}
    
    ${metadata.tags && metadata.tags.length > 0 ? `
    <div class="field">
      <span class="label">Tags:</span> ${metadata.tags.join(', ')}
    </div>
    ` : ''}
    
    ${metadata.writer ? `
    <div class="field">
      <span class="label">Writer:</span> ${metadata.writer}
    </div>
    ` : ''}
    
    ${metadata.penciller ? `
    <div class="field">
      <span class="label">Penciller:</span> ${metadata.penciller}
    </div>
    ` : ''}
    
    ${metadata.alternativeTitles && metadata.alternativeTitles.length > 0 ? `
    <div class="field">
      <span class="label">Alternative Titles:</span> ${metadata.alternativeTitles.join(', ')}
    </div>
    ` : ''}
    
    <div class="field">
      <span class="label">Uploaded:</span> ${new Date().toLocaleString('id-ID')}
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: hasAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const cbzFile = formData.get('file') as File;
    const comicIdParam = formData.get('comic_id') as string | null;
    const chapterNumberParam = formData.get('chapter_number') as string | null;

    if (!cbzFile) {
      return new Response(JSON.stringify({ error: 'No CBZ file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing CBZ: ${cbzFile.name}`);

    // Read CBZ file as ArrayBuffer
    const cbzBuffer = await cbzFile.arrayBuffer();
    const cbzUint8 = new Uint8Array(cbzBuffer);

    // Unzip CBZ
    let unzipped: any;
    try {
      unzipped = await new Promise((resolve, reject) => {
        unzip(cbzUint8, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    } catch (error) {
      console.error('Error unzipping CBZ:', error);
      return new Response(JSON.stringify({ error: 'Failed to extract CBZ file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract files
    const imageFiles: [string, Uint8Array][] = [];
    let comicInfoXml: string | null = null;

    for (const [filename, fileData] of Object.entries(unzipped)) {
      const lowerFilename = filename.toLowerCase();
      
      if (lowerFilename === 'comicinfo.xml') {
        const decoder = new TextDecoder();
        comicInfoXml = decoder.decode(fileData as Uint8Array);
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(lowerFilename)) {
        imageFiles.push([filename, fileData as Uint8Array]);
      }
    }

    if (imageFiles.length === 0) {
      return new Response(JSON.stringify({ error: 'No images found in CBZ' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sort images numerically
    const sortedImages = sortImagesNumerically(imageFiles);

    // Parse metadata
    let metadata: ComicInfoMetadata;
    if (comicInfoXml) {
      metadata = parseComicInfoXml(comicInfoXml);
      console.log('Parsed ComicInfo.xml:', metadata);
    } else {
      metadata = autoDetectMetadata(cbzFile.name, sortedImages.length);
      console.log('Auto-detected metadata:', metadata);
    }

    // Determine chapter number
    const chapterNumber = chapterNumberParam 
      ? parseInt(chapterNumberParam, 10) 
      : metadata.number || 1;

    // Find or create comic
    let comicId = comicIdParam;
    
    if (!comicId && metadata.series) {
      // Try to find existing comic by series name
      const { data: existingComic } = await supabase
        .from('komik')
        .select('id')
        .ilike('title', metadata.series)
        .single();

      if (existingComic) {
        comicId = existingComic.id;
      } else {
        // Create new comic
        const { data: newComic, error: comicError } = await supabase
          .from('komik')
          .insert({
            title: metadata.series,
            slug: metadata.series.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            description: metadata.summary || '',
            genres: metadata.genres || [],
            type: 'manga',
            status: 'Ongoing',
          })
          .select()
          .single();

        if (comicError) {
          console.error('Error creating comic:', comicError);
          return new Response(JSON.stringify({ error: 'Failed to create comic' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        comicId = newComic.id;
        console.log(`Created new comic: ${comicId}`);
      }
    }

    if (!comicId) {
      return new Response(JSON.stringify({ error: 'Comic ID required or series name not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upload images to R2
    const basePath = `comics/${comicId}/chapters/${chapterNumber}`;
    const imageUrls: string[] = [];

    for (let i = 0; i < sortedImages.length; i++) {
      const [filename, imageBuffer] = sortedImages[i];
      const pageNumber = i + 1;
      const extension = filename.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
      const r2Path = `${basePath}/${pageNumber}.${extension}`;

      console.log(`Uploading page ${pageNumber}/${sortedImages.length}`);
      
      const imageUrl = await uploadToR2(r2Path, imageBuffer, `image/${extension}`);
      imageUrls.push(imageUrl);
    }

    // Generate and upload info.html
    const infoHtml = generateInfoHtml(metadata, chapterNumber, sortedImages.length);
    const infoPath = `${basePath}/info.html`;
    const encoder = new TextEncoder();
    const infoUrl = await uploadToR2(infoPath, encoder.encode(infoHtml), 'text/html');

    // Save chapter to database
    const chapterData = {
      komik_id: comicId,
      chapter_number: chapterNumber,
      title: metadata.title || `Chapter ${chapterNumber}`,
      summary: metadata.summary || null,
      total_pages: sortedImages.length,
      r2_base_path: basePath,
      html_info_url: infoUrl,
      cover_page_url: imageUrls[0],
      metadata: metadata,
    };

    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .upsert(chapterData, {
        onConflict: 'komik_id,chapter_number',
      })
      .select()
      .single();

    if (chapterError) {
      console.error('Error saving chapter:', chapterError);
      return new Response(JSON.stringify({ error: 'Failed to save chapter to database' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log upload
    await supabase.from('cbz_upload_logs').insert({
      comic_id: comicId,
      chapter_id: chapter.id,
      original_filename: cbzFile.name,
      total_pages: sortedImages.length,
      status: 'SUCCESS',
      metadata: metadata,
    });

    // Update comic chapter count
    await supabase.rpc('increment_komik_view', { komik_id: comicId });

    console.log(`Successfully processed CBZ: ${cbzFile.name}`);

    return new Response(JSON.stringify({
      success: true,
      comic_id: comicId,
      chapter_id: chapter.id,
      chapter_number: chapterNumber,
      total_pages: sortedImages.length,
      metadata,
      html_url: infoUrl,
      images_url: imageUrls,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing CBZ:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
