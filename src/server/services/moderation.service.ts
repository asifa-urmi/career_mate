import 'server-only'

import type { ModerationStatus } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'

/**
 * The decisions a moderator can make.
 *
 * PENDING is absent: it is the state a job arrives in, not a decision anyone
 * takes. Allowing it would let a moderator un-decide a listing with no record of
 * why.
 */
const DECISIONS: readonly ModerationStatus[] = ['APPROVED', 'FLAGGED', 'REMOVED']

const OUTCOME_COPY: Record<string, { title: string; body: (title: string) => string }> = {
  APPROVED: {
    title: 'Job approved',
    body: (t) => `${t} passed moderation and is now visible to candidates.`,
  },
  FLAGGED: {
    title: 'Job flagged',
    body: (t) => `${t} was flagged during moderation and is not visible to candidates.`,
  },
  REMOVED: {
    title: 'Job removed',
    body: (t) => `${t} was removed during moderation and is not visible to candidates.`,
  },
}

type Outcome = { kind: 'ok' } | { kind: 'unchanged' } | { kind: 'not-found' }

/**
 * The gatekeeper the rest of the system assumed existed.
 *
 * `createJobPosting` forces `moderation: PENDING`, and every candidate-facing
 * read requires `APPROVED` — so without this, an employer's job could never
 * reach a candidate, and the whole apply loop only worked against the seeded
 * jobs, which are approved in the seed script. This is what makes an
 * employer-created role reachable.
 *
 * Restricted to ADMIN. An employer with this power would approve their own
 * listing, which is the one thing moderation exists to prevent.
 */
export async function moderateJob(
  user: SessionUser,
  jobId: string,
  decision: ModerationStatus,
  reason?: string,
): Promise<Result<void>> {
  if (user.role !== 'ADMIN') {
    return err(appError('FORBIDDEN', 'Only a platform administrator can moderate listings.'))
  }

  if (!DECISIONS.includes(decision)) {
    return err(appError('VALIDATION', 'That is not a moderation decision.'))
  }

  const note = reason?.trim().slice(0, 1000) || undefined

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const job = await tx.job.findFirst({
        where: { id: jobId },
        select: { id: true, title: true, moderation: true, postedById: true },
      })
      if (!job) return { kind: 'not-found' }
      // A double-clicked button must not send the employer a second notification
      // about a decision that did not change.
      if (job.moderation === decision) return { kind: 'unchanged' }

      await tx.job.updateMany({
        where: { id: job.id },
        data: { moderation: decision },
      })

      const copy = OUTCOME_COPY[decision]
      await tx.notification.create({
        data: {
          userId: job.postedById,
          type: 'SYSTEM',
          title: copy?.title ?? 'Moderation update',
          body: `${copy?.body(job.title) ?? job.title}${note ? ` Reason: ${note}` : ''}`,
          href: '/manage-jobs',
        },
      })

      return { kind: 'ok' }
    })

    if (outcome.kind === 'not-found') {
      return err(appError('NOT_FOUND', 'We could not find that job.'))
    }
    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not record that decision. Please try again.'))
  }
}
