'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/guards'
import { toggleSavedJob } from '@/server/services/saved-job.service'

export type ToggleSavedResult = { saved: boolean } | { error: string }

/**
 * Role and ownership are checked in the service, not here — a server action is a
 * public endpoint and does not run the layout that guards its page.
 */
export async function toggleSavedJobAction(jobId: string): Promise<ToggleSavedResult> {
  const user = await requireUser()
  const result = await toggleSavedJob(user, jobId)

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/saved')
  revalidatePath('/jobs')
  return { saved: result.value.saved }
}
