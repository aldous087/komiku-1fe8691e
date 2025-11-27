/**
 * Cloudflare R2 Storage Integration
 * Replaces all Lovable Storage with R2
 * Supports: covers, banners, ads, flags, chapter cache
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 Configuration from environment
const R2_CONFIG = {
  accountId: import.meta.env.VITE_R2_ACCOUNT_ID || '',
  accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || '',
  secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '',
  bucketName: import.meta.env.VITE_R2_BUCKET_NAME || 'komikru',
  publicUrl: import.meta.env.VITE_R2_PUBLIC_URL || '',
};

// Initialize R2 Client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey,
  },
});

/**
 * Storage path structure:
 * /covers/{comic-id}.webp
 * /banners/{id}.webp
 * /ads/{id}.webp
 * /flags/{user-id}.png
 * /chapter-cache/{comic-id}/{chapter-number}/{page}.webp
 * /chapter-original/{comic-id}/{chapter-number}/{page}.webp
 */

// ============================================
// UPLOAD FUNCTIONS
// ============================================

/**
 * Upload comic cover to R2
 * @param file - Cover image file
 * @param komikId - Comic ID
 * @returns Public URL of uploaded cover
 */
export async function uploadComicCoverToR2(
  file: File,
  komikId?: string
): Promise<string> {
  try {
    // Validate file
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error('File size must be less than 15MB');
    }

    // Generate file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${komikId || crypto.randomUUID()}.${fileExt}`;
    const filePath = `covers/${fileName}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000', // 1 year
      })
    );

    // Return public URL
    const publicUrl = `${R2_CONFIG.publicUrl}/${filePath}`;
    return publicUrl;
  } catch (error) {
    console.error('Error uploading cover to R2:', error);
    throw error;
  }
}

/**
 * Upload chapter images to R2 (24-hour cache)
 * @param files - Array of image files
 * @param komikId - Comic ID
 * @param chapterId - Chapter ID
 * @param chapterNumber - Chapter number
 * @returns Array of public URLs
 */
export async function uploadChapterImagesToR2(
  files: File[],
  komikId: string,
  chapterId: string,
  chapterNumber: number,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  try {
    // Validate files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        throw new Error(`${file.name} bukan file gambar`);
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new Error(`${file.name} melebihi batas 20MB`);
      }
    }

    const urls: string[] = [];
    let completed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${String(i + 1).padStart(3, '0')}.${fileExt}`;
      const filePath = `chapter-cache/${komikId}/${chapterNumber}/${fileName}`;

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to R2
      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_CONFIG.bucketName,
          Key: filePath,
          Body: buffer,
          ContentType: file.type,
          CacheControl: 'public, max-age=86400', // 24 hours
        })
      );

      // Get public URL
      const publicUrl = `${R2_CONFIG.publicUrl}/${filePath}`;
      urls.push(publicUrl);

      completed++;
      if (onProgress) {
        onProgress(completed, files.length);
      }
    }

    return urls;
  } catch (error) {
    console.error('Error uploading chapter images to R2:', error);
    throw error;
  }
}

/**
 * Upload ad image to R2
 * @param file - Image file
 * @returns Public URL of uploaded image
 */
export async function uploadAdImageToR2(file: File): Promise<string> {
  try {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    if (file.size > 15 * 1024 * 1024) {
      throw new Error('File size must be less than 15MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `ads/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000',
      })
    );

    return `${R2_CONFIG.publicUrl}/${filePath}`;
  } catch (error) {
    console.error('Error uploading ad image to R2:', error);
    throw error;
  }
}

/**
 * Upload country flag to R2
 * @param file - Flag image file
 * @returns Public URL of uploaded flag
 */
export async function uploadCountryFlagToR2(file: File): Promise<string> {
  try {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('File size must be less than 5MB');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `flags/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000',
      })
    );

    return `${R2_CONFIG.publicUrl}/${filePath}`;
  } catch (error) {
    console.error('Error uploading flag to R2:', error);
    throw error;
  }
}

// ============================================
// FETCH/GET FUNCTIONS
// ============================================

/**
 * Get signed URL for private R2 objects (if needed)
 * @param filePath - Path in R2 bucket
 * @param expiresIn - URL expiration in seconds (default: 3600)
 * @returns Signed URL
 */
export async function getSignedR2Url(
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: filePath,
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error('Error getting signed R2 URL:', error);
    throw error;
  }
}

/**
 * Get public URL for R2 object
 * @param filePath - Path in R2 bucket
 * @returns Public URL
 */
export function getPublicR2Url(filePath: string): string {
  return `${R2_CONFIG.publicUrl}/${filePath}`;
}

// ============================================
// DELETE FUNCTIONS
// ============================================

/**
 * Delete file from R2
 * @param filePath - Path in R2 bucket
 */
export async function deleteFromR2(filePath: string): Promise<void> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: filePath,
      })
    );
  } catch (error) {
    console.error('Error deleting from R2:', error);
    throw error;
  }
}

/**
 * Delete multiple files from R2
 * @param filePaths - Array of paths in R2 bucket
 */
export async function deleteMultipleFromR2(filePaths: string[]): Promise<void> {
  try {
    await Promise.all(
      filePaths.map(filePath => deleteFromR2(filePath))
    );
  } catch (error) {
    console.error('Error deleting multiple files from R2:', error);
    throw error;
  }
}

/**
 * Delete expired chapter cache (used by cleanup-cache edge function)
 * @param komikId - Comic ID
 * @param chapterNumber - Chapter number
 */
export async function deleteChapterCacheFromR2(
  komikId: string,
  chapterNumber: number
): Promise<void> {
  try {
    const prefix = `chapter-cache/${komikId}/${chapterNumber}/`;

    // List all objects with prefix
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_CONFIG.bucketName,
      Prefix: prefix,
    });

    const listResult = await r2Client.send(listCommand);

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return;
    }

    // Delete all objects
    const deletePromises = listResult.Contents.map(obj => {
      if (obj.Key) {
        return deleteFromR2(obj.Key);
      }
    });

    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting chapter cache from R2:', error);
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Extract file path from R2 public URL
 * @param url - Public URL
 * @returns File path
 */
export function extractR2PathFromUrl(url: string): string {
  if (url.startsWith(R2_CONFIG.publicUrl)) {
    return url.replace(`${R2_CONFIG.publicUrl}/`, '');
  }
  return url;
}

/**
 * Check if R2 is configured
 * @returns true if configured
 */
export function isR2Configured(): boolean {
  return !!(
    R2_CONFIG.accountId &&
    R2_CONFIG.accessKeyId &&
    R2_CONFIG.secretAccessKey &&
    R2_CONFIG.bucketName &&
    R2_CONFIG.publicUrl
  );
}

/**
 * Upload from URL (for scraper)
 * Downloads image from external URL and uploads to R2
 * @param sourceUrl - External image URL
 * @param destinationPath - R2 destination path
 * @returns Public URL
 */
export async function uploadFromUrlToR2(
  sourceUrl: string,
  destinationPath: string
): Promise<string> {
  try {
    // Fetch image from source
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Upload to R2
    await r2Client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: destinationPath,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
        CacheControl: 'public, max-age=86400', // 24 hours for cache
      })
    );

    return getPublicR2Url(destinationPath);
  } catch (error) {
    console.error('Error uploading from URL to R2:', error);
    throw error;
  }
}
