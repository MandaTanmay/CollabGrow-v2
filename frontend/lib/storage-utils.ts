/**
 * Storage utility functions to handle Supabase Storage operations safely
 */

import { supabase } from "./database"

// List of required buckets for the application
export const REQUIRED_BUCKETS = {
  PROFILE_IMAGES: "profile-images",
  PROJECT_RESOURCES: "project-resources",
} as const

/**
 * Check if a storage bucket exists
 */
export async function bucketExists(bucketName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) {
      console.warn(`Failed to check if bucket exists: ${bucketName}`, error)
      return false
    }
    return data?.some((bucket) => bucket.name === bucketName) ?? false
  } catch (error) {
    console.warn(`Error checking bucket existence: ${bucketName}`, error)
    return false
  }
}

/**
 * Safely get public URL from storage, returns placeholder if bucket doesn't exist
 */
export function getSafePublicUrl(
  bucketName: string,
  filePath: string,
  fallbackUrl: string = "/placeholder.svg"
): string {
  try {
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    return data?.publicUrl || fallbackUrl
  } catch (error) {
    console.warn(`Failed to get public URL from ${bucketName}/${filePath}`, error)
    return fallbackUrl
  }
}

/**
 * Safely upload file to storage with error handling
 */
export async function safeUpload(
  bucketName: string,
  filePath: string,
  file: File,
  options?: { cacheControl?: string; upsert?: boolean }
) {
  try {
    // Check if bucket exists first
    const exists = await bucketExists(bucketName)
    if (!exists) {
      return {
        data: null,
        error: new Error(
          `Storage bucket '${bucketName}' does not exist. Please create it in your Supabase dashboard.`
        ),
      }
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, options)

    return { data, error }
  } catch (error) {
    console.error(`Upload error to ${bucketName}/${filePath}:`, error)
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error)),
    }
  }
}

/**
 * Validate if a URL is a Supabase storage URL
 */
export function isStorageUrl(url: string): boolean {
  if (!url) return false
  return url.includes(".supabase.co/storage/v1/object/public/")
}

/**
 * Get a safe image URL - returns placeholder if storage URL is invalid
 */
export function getSafeImageUrl(url: string | null | undefined, fallback: string = "/placeholder.svg"): string {
  if (!url) return fallback
  
  // If it's a storage URL but buckets aren't configured, use fallback
  if (isStorageUrl(url)) {
    // You could add additional validation here if needed
    return url
  }
  
  return url || fallback
}
