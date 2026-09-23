'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { MAX_RESUME_BYTES } from '@/config/constants'
import {
  deleteResume,
  renameResume,
  setPrimaryResume,
  uploadResume,
} from '@/server/services/resume.service'
import { signedResumeUrl } from '@/server/services/resume-access.service'
import { reviewCv } from '@/server/services/ai.service'
import { candidateFacts, targetRoleFor } from '@/lib/ai/facts'
import { candidateProfileIdFor } from '@/lib/db/repositories/saved-job.repository'
import type { CvReview } from '@/lib/ai/schemas'

export type UploadState = { error?: string; uploaded?: boolean }

/**
 * Role and ownership are checked in the services. This reads the file off the
 * request and hands the bytes over — a server action is a public endpoint and
 * the layout that guards its page never runs for it.
 */
export async function uploadResumeAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const user = await requireUser()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a file first.' }
  }

  // Checked before reading the whole thing into memory, so an oversized upload
  // is refused rather than buffered.
  if (file.size > MAX_RESUME_BYTES) {
    return { error: `That file is larger than ${Math.round(MAX_RESUME_BYTES / 1024 / 1024)} MB.` }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const label = String(formData.get('label') ?? '').trim()

  const result = await uploadResume(user, {
    fileName: file.name,
    mimeType: file.type,
    bytes,
    ...(label ? { label } : {}),
  })

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/resume')
  revalidatePath('/dashboard')
  revalidatePath('/profile')
  return { uploaded: true }
}

export async function setPrimaryAction(resumeId: string): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await setPrimaryResume(user, resumeId)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/resume')
  return {}
}

export async function renameResumeAction(
  resumeId: string,
  label: string,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await renameResume(user, resumeId, label)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/resume')
  return {}
}

export async function deleteResumeAction(resumeId: string): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await deleteResume(user, resumeId)
  if (!result.ok) return { error: result.error.message }

  revalidatePath('/resume')
  revalidatePath('/dashboard')
  return {}
}

export async function downloadResumeAction(
  resumeId: string,
): Promise<{ url?: string; error?: string }> {
  const user = await requireUser()
  const result = await signedResumeUrl(user, resumeId)
  if (!result.ok) return { error: result.error.message }

  return { url: result.value.url }
}

export type ReviewState = {
  review?: CvReview
  providerLabel?: string
  usedFallback?: boolean
  /** Only meaningful when `usedFallback`: no key anywhere, or every key spent. */
  fallbackReason?: 'unconfigured' | 'exhausted'
  error?: string
}

export async function reviewCvAction(): Promise<ReviewState> {
  const user = await requireUser()

  const profileId = await candidateProfileIdFor(user.id)
  if (!profileId) return { error: 'Finish setting up your profile first.' }

  const facts = await candidateFacts(profileId)
  if (!facts) return { error: 'Finish setting up your profile first.' }

  const targetRole = await targetRoleFor(profileId)
  const result = await reviewCv(user, facts, targetRole)

  if (!result.ok) return { error: result.error.message }

  return {
    review: result.value.data,
    providerLabel: result.value.providerLabel,
    usedFallback: result.value.usedFallback,
    fallbackReason: result.value.fallbackReason,
  }
}
