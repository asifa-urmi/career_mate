import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import { ACCEPTED_RESUME_MIME, MAX_RESUME_BYTES } from '@/config/constants'
import { validateUpload } from '@/lib/validation/file'
import { looksLikeDeclaredType } from '@/lib/resume/sniff'
import { extractText } from '@/lib/resume/extract'
import { deleteResumeFile, uploadResumeFile } from '@/lib/supabase/storage'

/**
 * Uploads land under the owning profile, so a path alone cannot cross accounts.
 *
 * The name is reduced to a safe set and runs of dots are collapsed. Stripping
 * separators alone already prevents traversal, but a stored name containing
 * `..` is never legitimate and would be one careless `path.join` away from
 * mattering.
 */
function storagePath(profileId: string, resumeId: string, fileName: string): string {
  const safeName =
    fileName
      .replace(/[^a-z0-9._-]/gi, '_')
      .replace(/\.{2,}/g, '.')
      .replace(/^[._-]+/, '')
      .slice(-80) || 'cv'

  return `${profileId}/${resumeId}/${safeName}`
}

async function profileIdFor(userId: string): Promise<string | null> {
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  return profile?.id ?? null
}

function requireCandidate(user: SessionUser): Result<void> {
  if (user.role !== 'CANDIDATE') {
    return err(appError('FORBIDDEN', 'Only a job seeker account can manage CVs.'))
  }
  return ok(undefined)
}

export type UploadInput = {
  fileName: string
  mimeType: string
  bytes: Uint8Array
  label?: string
}

/**
 * Stores a CV.
 *
 * Validation happens here and not only in the browser, because the browser's
 * copy never sees a crafted request. Size and declared type are checked, and
 * then the file's own first bytes are checked against that declared type — a
 * renamed executable arrives claiming to be a PDF, and would otherwise be stored
 * and later handed to an employer as someone's CV.
 *
 * The row is written first so the id can name the storage path; if the upload
 * then fails the row is removed, rather than leaving a CV that points at
 * nothing.
 */
export async function uploadResume(
  user: SessionUser,
  input: UploadInput,
): Promise<Result<{ resumeId: string }>> {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  const profileId = await profileIdFor(user.id)
  if (!profileId) return err(appError('NOT_FOUND', 'Finish setting up your profile first.'))

  const rejection = validateUpload(
    { type: input.mimeType, size: input.bytes.byteLength, name: input.fileName },
    ACCEPTED_RESUME_MIME,
    MAX_RESUME_BYTES,
  )
  if (rejection) {
    return err(
      appError(
        rejection.reason === 'size' ? 'UPLOAD_TOO_LARGE' : 'UNSUPPORTED_FILE_TYPE',
        rejection.message,
      ),
    )
  }

  if (!looksLikeDeclaredType(input.bytes, input.mimeType)) {
    return err(
      appError(
        'UNSUPPORTED_FILE_TYPE',
        'That file is not a PDF or DOCX, whatever it is named.',
      ),
    )
  }

  try {
    const count = await prisma.resume.count({ where: { candidateProfileId: profileId } })
    if (count >= 10) {
      return err(appError('CONFLICT', 'You can keep up to ten CVs. Remove one first.'))
    }

    const label = input.label?.trim() || input.fileName.replace(/\.[^.]+$/, '').slice(0, 80)

    const resume = await prisma.resume.create({
      data: {
        candidateProfileId: profileId,
        label,
        // Placeholder: the real path needs the row's id, set immediately below.
        storagePath: `pending/${crypto.randomUUID()}`,
        fileName: input.fileName.slice(-120),
        mimeType: input.mimeType,
        sizeBytes: input.bytes.byteLength,
        // The first CV is the primary one; there is nothing to choose between.
        isPrimary: count === 0,
        version: count + 1,
      },
      select: { id: true },
    })

    const path = storagePath(profileId, resume.id, input.fileName)
    const uploaded = await uploadResumeFile(path, input.bytes, input.mimeType)

    if (!uploaded.ok) {
      await prisma.resume.delete({ where: { id: resume.id } })
      return err(appError('INTERNAL', 'We could not store that file. Please try again.'))
    }

    // Extraction is best effort and must never fail the upload.
    const text = await extractText(input.bytes, input.mimeType)

    await prisma.resume.update({
      where: { id: resume.id },
      data: { storagePath: path, extractedText: text || null },
    })

    return ok({ resumeId: resume.id })
  } catch {
    return err(appError('INTERNAL', 'We could not save that CV. Please try again.'))
  }
}

/**
 * Exactly one CV is primary. Done in a transaction because a moment with two
 * primaries — or none — would make the apply form's default arbitrary.
 */
export async function setPrimaryResume(
  user: SessionUser,
  resumeId: string,
): Promise<Result<void>> {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  const profileId = await profileIdFor(user.id)
  if (!profileId) return err(appError('NOT_FOUND', 'Finish setting up your profile first.'))

  try {
    const owned = await prisma.resume.findFirst({
      where: { id: resumeId, candidateProfileId: profileId },
      select: { id: true },
    })
    if (!owned) return err(appError('NOT_FOUND', 'We could not find that CV.'))

    await prisma.$transaction([
      prisma.resume.updateMany({
        where: { candidateProfileId: profileId },
        data: { isPrimary: false },
      }),
      prisma.resume.update({ where: { id: owned.id }, data: { isPrimary: true } }),
    ])

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not update your CVs. Please try again.'))
  }
}

export async function renameResume(
  user: SessionUser,
  resumeId: string,
  label: string,
): Promise<Result<void>> {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  const trimmed = label.trim().slice(0, 80)
  if (!trimmed) return err(appError('VALIDATION', 'Give the CV a name.'))

  const profileId = await profileIdFor(user.id)
  if (!profileId) return err(appError('NOT_FOUND', 'Finish setting up your profile first.'))

  try {
    const result = await prisma.resume.updateMany({
      where: { id: resumeId, candidateProfileId: profileId },
      data: { label: trimmed },
    })
    if (result.count === 0) return err(appError('NOT_FOUND', 'We could not find that CV.'))
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not rename that CV. Please try again.'))
  }
}

/**
 * Removes a CV.
 *
 * Applications keep a reference to the CV they were sent with; the schema sets
 * that to null on delete rather than cascading, because deleting a CV must not
 * delete the applications it was attached to. The employer keeps the
 * application and simply no longer has the file.
 */
export async function deleteResume(user: SessionUser, resumeId: string): Promise<Result<void>> {
  const allowed = requireCandidate(user)
  if (!allowed.ok) return allowed

  const profileId = await profileIdFor(user.id)
  if (!profileId) return err(appError('NOT_FOUND', 'Finish setting up your profile first.'))

  try {
    const resume = await prisma.resume.findFirst({
      where: { id: resumeId, candidateProfileId: profileId },
      select: { id: true, storagePath: true, isPrimary: true },
    })
    if (!resume) return err(appError('NOT_FOUND', 'We could not find that CV.'))

    await prisma.resume.delete({ where: { id: resume.id } })

    // Outside the failure path above. The row is already gone, so reporting "we
    // could not remove that CV. Please try again" because the object failed to
    // delete would be false, and the retry would find nothing to remove.
    try {
      await deleteResumeFile(resume.storagePath)
    } catch {
      // An orphaned object in the bucket. Not worth telling the person their
      // deletion failed when it did not.
    }

    // Something has to be primary if anything is left, or the apply form has no
    // default and silently attaches nothing.
    if (resume.isPrimary) {
      const next = await prisma.resume.findFirst({
        where: { candidateProfileId: profileId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      })
      if (next) {
        await prisma.resume.update({ where: { id: next.id }, data: { isPrimary: true } })
      }
    }

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not remove that CV. Please try again.'))
  }
}
