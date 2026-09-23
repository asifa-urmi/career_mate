import 'server-only'

import { createAdminSupabase } from './server'
import { AVATAR_BUCKET, RESUME_BUCKET } from '@/config/constants'

/**
 * CV files live in a private bucket.
 *
 * Writes and signed URLs go through the service-role client, because the
 * decision about who may read a file is made in a service — by checking whether
 * this employer has an application from this candidate — not by a storage
 * policy that has no idea what an application is.
 */
export async function uploadResumeFile(
  path: string,
  buffer: Uint8Array,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createAdminSupabase()
  const { error } = await supabase.storage
    .from(RESUME_BUCKET)
    .upload(path, buffer, { contentType, upsert: false })

  return error ? { ok: false, message: error.message } : { ok: true }
}

export async function deleteResumeFile(path: string): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase.storage.from(RESUME_BUCKET).remove([path])
}

/** Short-lived on purpose: a URL that leaks is only useful for a few minutes. */
export const SIGNED_URL_TTL_SECONDS = 120

export async function createSignedResumeUrl(
  path: string,
  fileName: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const supabase = createAdminSupabase()
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS, { download: fileName })

  if (error || !data?.signedUrl) {
    return { ok: false, message: error?.message ?? 'Could not create a download link' }
  }
  return { ok: true, url: data.signedUrl }
}

/**
 * Stores a profile photo and returns the URL to render.
 *
 * `upsert` is on: replacing a photo overwrites in place rather than leaving the
 * old object behind, and the path is already unique per upload.
 */
export async function uploadAvatarFile(
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const supabase = createAdminSupabase()

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, bytes, { contentType, upsert: true })

  if (error) return { ok: false, message: error.message }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl }
}

export async function deleteAvatarFile(path: string): Promise<void> {
  const supabase = createAdminSupabase()
  await supabase.storage.from(AVATAR_BUCKET).remove([path])
}
