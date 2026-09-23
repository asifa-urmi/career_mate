'use server'

import { revalidatePath } from 'next/cache'
import type { ApplicationStage } from '@prisma/client'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/guards'
import { changeApplicationStage } from '@/server/services/hiring.service'

/**
 * A server action's arguments are attacker-controlled like any request body.
 * Every other free-text field in the app is bounded; `note` went straight into
 * an unbounded TEXT column with only a trim, and it is re-read on every render
 * of the candidate screen.
 */
const stageChangeSchema = z.object({
  applicationId: z.string().trim().min(1).max(40),
  toStage: z.enum([
    'APPLIED',
    'SCREENING',
    'INTERVIEW',
    'ASSESSMENT',
    'OFFER',
    'REJECTED',
    'WITHDRAWN',
  ]),
  note: z.string().trim().max(1000, 'Keep the note under 1000 characters').optional(),
})

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

  const parsed = stageChangeSchema.safeParse({ applicationId, toStage, note })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That change is not valid.' }
  }

  const result = await changeApplicationStage(
    user,
    parsed.data.applicationId,
    parsed.data.toStage,
    parsed.data.note,
  )

  if (!result.ok) return { error: result.error.message }

  revalidatePath('/candidates')
  revalidatePath('/pipeline')
  return {}
}
