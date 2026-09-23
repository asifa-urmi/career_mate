'use server'

import { revalidatePath } from 'next/cache'
import type { ApplicationStage } from '@prisma/client'
import { requireUser } from '@/lib/auth/guards'
import { changeApplicationStage } from '@/server/services/hiring.service'

/**
 * Role and company ownership are checked inside the service, with the company
 * predicate in the query's where clause. This action passes the session user
 * through and does nothing else — a server action is a public endpoint and the
 * layout that guards its page never runs for it.
 */
export async function changeStageAction(
  applicationId: string,
  toStage: ApplicationStage,
  note?: string,
): Promise<{ error?: string }> {
  const user = await requireUser()
  const result = await changeApplicationStage(user, applicationId, toStage, note)

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/candidates')
  revalidatePath('/pipeline')
  return {}
}
