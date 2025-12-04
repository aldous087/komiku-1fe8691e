import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Secure cover upload via edge function
 * Enforces: admin auth, rate limiting, audit logging
 */
export async function secureUploadCover(
  file: File,
  komikId: string
): Promise<string> {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Authentication required");
  }

  // Request signed upload URL from edge function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/secure-upload-cover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      komikId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get upload URL");
  }

  const { derivativeUploadUrl, derivativePath } = await response.json();

  // Upload file to the signed URL
  const uploadResponse = await fetch(derivativeUploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file");
  }

  // Return the public URL
  const { data } = supabase.storage.from("covers").getPublicUrl(derivativePath);
  return data.publicUrl;
}

/**
 * Secure chapter images upload via edge function
 * Enforces: admin auth, rate limiting, audit logging
 */
export async function secureUploadChapterImages(
  files: File[],
  komikId: string,
  chapterId: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Authentication required");
  }

  // Prepare file metadata
  const filesMetadata = files.map((file, index) => ({
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
    index: index + 1,
  }));

  // Request signed upload URLs from edge function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/secure-upload-chapter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      komikId,
      chapterId,
      files: filesMetadata,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get upload URLs");
  }

  const { uploadUrls } = await response.json();

  // Upload files in parallel with progress tracking
  const uploadedUrls: string[] = [];
  let completed = 0;

  const uploadPromises = uploadUrls.map(async (urlInfo: {
    index: number;
    derivativeUploadUrl: string;
    derivativePath: string;
  }, idx: number) => {
    const file = files[idx];
    
    const uploadResponse = await fetch(urlInfo.derivativeUploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload ${file.name}`);
    }

    completed++;
    onProgress?.(completed, files.length);

    const { data } = supabase.storage.from("chapters").getPublicUrl(urlInfo.derivativePath);
    return { index: urlInfo.index, url: data.publicUrl };
  });

  const results = await Promise.all(uploadPromises);
  
  // Sort by index and return URLs
  results.sort((a, b) => a.index - b.index);
  return results.map(r => r.url);
}

/**
 * Secure ad media upload via edge function
 * Enforces: admin auth, rate limiting, audit logging
 */
export async function secureUploadAdMedia(
  file: File,
  mediaType: "image" | "video"
): Promise<string> {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Authentication required");
  }

  // Request signed upload URL from edge function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/secure-upload-ad`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      mediaType,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl } = await response.json();

  // Upload file to the signed URL
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file");
  }

  return publicUrl;
}

/**
 * Secure flag upload via edge function
 * Enforces: admin auth, rate limiting, audit logging
 */
export async function secureUploadFlag(file: File): Promise<string> {
  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Authentication required");
  }

  // Request signed upload URL from edge function
  const response = await fetch(`${SUPABASE_URL}/functions/v1/secure-upload-flag`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get upload URL");
  }

  const { uploadUrl, publicUrl } = await response.json();

  // Upload file to the signed URL
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Failed to upload file");
  }

  return publicUrl;
}
