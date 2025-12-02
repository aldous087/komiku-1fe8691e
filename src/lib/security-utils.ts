// Security utility functions for URL validation and input sanitization

// Allowed image URL domains for hotlink mode
const ALLOWED_IMAGE_DOMAINS = [
  'i.imgur.com',
  'imgur.com',
  'cdn.discordapp.com',
  'media.discordapp.net',
  'i.ibb.co',
  'ibb.co',
  'postimg.cc',
  'i.postimg.cc',
  'prntscr.com',
  'image.prntscr.com',
  'raw.githubusercontent.com',
  'user-images.githubusercontent.com',
  // Comic CDN domains
  'cdn.komiku.id',
  'cdn.komikcast.lol',
  'cdn.shinigami.sh',
  'cdn.manhwalist.com',
  'cdn.mangaku.in',
  'cdn.mangadex.org',
  'uploads.mangadex.org',
  'i2.wp.com',
  'i3.wp.com',
  'i0.wp.com',
  'i1.wp.com',
  // Generic CDNs
  'cloudflare-ipfs.com',
  'cdn.jsdelivr.net',
  'images.weserv.nl',
];

// Allowed scraper source domains
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

// Private IP ranges that should be blocked (SSRF prevention)
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

// Allowed image extensions
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

/**
 * Validate if a URL is a valid image URL
 */
export function isValidImageUrl(url: string): { valid: boolean; error?: string } {
  try {
    // Check if URL is empty
    if (!url || url.trim() === '') {
      return { valid: false, error: 'URL kosong' };
    }

    // Parse URL
    const parsedUrl = new URL(url.trim());

    // Must be HTTPS (or HTTP for some CDNs)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'URL harus menggunakan protokol HTTP/HTTPS' };
    }

    // Block dangerous protocols
    if (['javascript:', 'data:', 'file:', 'vbscript:'].includes(parsedUrl.protocol.toLowerCase())) {
      return { valid: false, error: 'Protokol URL tidak diizinkan' };
    }

    // Check hostname is not a private IP (SSRF prevention)
    const hostname = parsedUrl.hostname.toLowerCase();
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'URL tidak boleh mengarah ke alamat lokal' };
      }
    }

    // Check file extension
    const pathname = parsedUrl.pathname.toLowerCase();
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext => pathname.endsWith(ext));
    
    // Allow URLs without extension if they're from known CDNs
    if (!hasValidExtension && !pathname.includes('.')) {
      // Some CDNs serve images without extension
      const isKnownCdn = ALLOWED_IMAGE_DOMAINS.some(domain => hostname.includes(domain));
      if (!isKnownCdn) {
        return { valid: false, error: 'URL harus memiliki ekstensi gambar yang valid (.jpg, .jpeg, .png, .webp, .gif)' };
      }
    }

    if (!hasValidExtension && pathname.includes('.')) {
      const ext = pathname.split('.').pop();
      if (ext && !ALLOWED_IMAGE_EXTENSIONS.includes(`.${ext}`)) {
        return { valid: false, error: `Ekstensi .${ext} tidak didukung. Gunakan: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}` };
      }
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Format URL tidak valid' };
  }
}

/**
 * Validate multiple image URLs and return results
 */
export function validateImageUrls(urls: string[]): { 
  valid: string[]; 
  invalid: Array<{ url: string; error: string }> 
} {
  const valid: string[] = [];
  const invalid: Array<{ url: string; error: string }> = [];

  for (const url of urls) {
    const result = isValidImageUrl(url);
    if (result.valid) {
      valid.push(url.trim());
    } else {
      invalid.push({ url, error: result.error || 'Invalid URL' });
    }
  }

  return { valid, invalid };
}

/**
 * Validate if a URL is safe for scraping (SSRF prevention)
 */
export function isValidScraperUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsedUrl = new URL(url);

    // Must be HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'Scraper hanya mendukung HTTPS' };
    }

    // Check hostname is not a private IP
    const hostname = parsedUrl.hostname.toLowerCase();
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'URL tidak boleh mengarah ke alamat lokal' };
      }
    }

    // Check against whitelist
    const isAllowed = ALLOWED_SCRAPER_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return { valid: false, error: `Domain ${hostname} tidak ada dalam whitelist scraper` };
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Format URL tidak valid' };
  }
}

/**
 * Validate ad URL (for ads management)
 */
export function isValidAdUrl(url: string, fieldType: 'link' | 'media'): { valid: boolean; error?: string } {
  try {
    if (!url || url.trim() === '') {
      return { valid: true }; // Empty is allowed for optional fields
    }

    const parsedUrl = new URL(url.trim());

    // Must be HTTPS only
    if (parsedUrl.protocol !== 'https:') {
      return { valid: false, error: 'URL harus menggunakan HTTPS' };
    }

    // Block dangerous protocols
    if (['javascript:', 'data:', 'file:', 'vbscript:'].includes(parsedUrl.protocol.toLowerCase())) {
      return { valid: false, error: 'Protokol URL tidak diizinkan' };
    }

    // Check hostname is not a private IP
    const hostname = parsedUrl.hostname.toLowerCase();
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: 'URL tidak boleh mengarah ke alamat lokal' };
      }
    }

    // For media URLs, check extension
    if (fieldType === 'media') {
      const pathname = parsedUrl.pathname.toLowerCase();
      const validMediaExts = [...ALLOWED_IMAGE_EXTENSIONS, '.mp4', '.webm'];
      const hasValidExtension = validMediaExts.some(ext => pathname.endsWith(ext));
      
      if (!hasValidExtension) {
        return { valid: false, error: 'URL media harus berupa gambar atau video' };
      }
    }

    return { valid: true };
  } catch (e) {
    return { valid: false, error: 'Format URL tidak valid' };
  }
}

/**
 * Sanitize HTML from user input (basic XSS prevention)
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .trim();
}

/**
 * Parse image URLs from text (one per line)
 */
export function parseImageUrlsFromText(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}
