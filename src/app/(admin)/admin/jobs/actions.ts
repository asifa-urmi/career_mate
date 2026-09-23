'use server'

import { revalidatePath } from 'next/cache'
import type { ModerationStatus } from '@prisma/client'
import { requireUser } from '@/lib/auth/guards'
import { moderateJob } from '@/server/services/moderation.service'

export async function moderateJobAction(
  jobId: string,
  decision: ModerationStatus,
  reason?: string,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await moderateJob(user, jobId, decision, reason)

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/admin/jobs')
  revalidatePath('/admin')
  // An approval makes the job visible, so the public reads change too.
  revalidatePath('/jobs')
  revalidatePath('/jobs-public')
  revalidatePath('/')
  return {}
}
