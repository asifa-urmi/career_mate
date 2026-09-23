import 'server-only'

import { randomUUID } from 'node:crypto'
import {
  ACCEPTED_AVATAR_MIME,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
} from '@/config/constants'
import { prisma } from '@/lib/db/prisma'
import { looksLikeImage } from '@/lib/resume/sniff'
import { deleteAvatarFile, uploadAvatarFile } from '@/lib/supabase/storage'
import { validateUpload } from '@/lib/validation/file'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'

/**
 * The profile photo.
 *
 * Acts on the caller and takes no user id, so there is nothing in the request to
 * tamper with: you cannot change a photo on an account you are not signed in as,
 * because the target is never in the request.
 *
 * Unlike a CV, this is stored in a public bucket — it is meant to be seen, and
 * signing every one of them would mean a round trip per face in a list, with
 * links that expire while the page is open. Two things follow from that, and
 * both are enforced below: the path must not be guessable from a user id, and
 * the bytes must actually be an image, because every visitor's browser will
 * load whatever is there.
 */

type AvatarInput = {
  fileName: string
  mimeType: string
  bytes: Uint8Array
}

export async function updateAvatar(
  user: SessionUser,
  input: AvatarInput,
): Promise<Result<{ url: string }>> {
  const rejection = validateUpload(
    { type: input.mimeType, size: input.bytes.byteLength, name: input.fileName },
    ACCEPTED_AVATAR_MIME,
    MAX_AVATAR_BYTES,
  )
  if (rejection) {
    return err(
      appError(
        rejection.reason === 'size' ? 'UPLOAD_TOO_LARGE' : 'UNSUPPORTED_FILE_TYPE',
        rejection.message,
      ),
    )
  }

  // The declared type is whatever the client sent. This file is served from a
  // URL every visitor's browser loads, so what it actually is matters.
  if (!looksLikeImage(input.bytes, input.mimeType)) {
    return err(
      appError('UNSUPPORTED_FILE_TYPE', 'That file is not a PNG, JPEG or WebP image.'),
    )
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    })

    // A random component, because the bucket is public: a path derived from the
    // user id alone could be walked to collect every face on the platform.
    const path = `${user.id}/${randomUUID()}.${extensionFor(input.mimeType)}`

    const stored = await uploadAvatarFile(path, input.bytes, input.mimeType)
    if (!stored.ok) {
      return err(appError('INTERNAL', 'We could not save that photo. Please try again.'))
    }

    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: stored.url } })

    // After the row points at the new one, so a failure here leaves an unused
    // object rather than a profile pointing at a file that is gone.
    await removeStored(existing?.avatarUrl ?? null)

    return ok({ url: stored.url })
  } catch {
    return err(appError('INTERNAL', 'We could not save that photo. Please try again.'))
  }
}

export async function removeAvatar(user: SessionUser): Promise<Result<void>> {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: user.id },
      select: { avatarUrl: true },
    })
    if (!existing?.avatarUrl) return ok(undefined)

    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: null } })
    await removeStored(existing.avatarUrl)

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not remove that photo. Please try again.'))
  }
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

/**
 * Deletes a stored object from the public URL we saved.
 *
 * Only a path inside our own bucket is acted on. The column holds a URL rather
 * than a path, and a URL pointing anywhere else is not ours to delete.
 */
async function removeStored(url: string | null): Promise<void> {
  if (!url) return

  const marker = `/${AVATAR_BUCKET}/`
  const at = url.indexOf(marker)
  if (at === -1) return

  const path = url.slice(at + marker.length)
  if (!path) return

  try {
    await deleteAvatarFile(path)
  } catch {
    // An orphaned object. Not worth failing a change the person asked for.
  }
}
