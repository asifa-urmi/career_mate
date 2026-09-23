import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'

/**
 * Saving and un-saving are the same action, resolved by what is already there.
 *
 * The whole thing runs as one transaction that deletes first and creates only
 * if the delete removed nothing. Reading and then branching would let two
 * clicks arriving together both see "not saved" and both insert — which the
 * unique constraint would then turn into a 500.
 */
export async function toggleSavedJob(
  user: SessionUser,
  jobId: string,
): Promise<Result<{ saved: boolean }>> {
  if (user.role !== 'CANDIDATE') {
    return err(appError('FORBIDDEN', 'Only a job seeker account can save jobs.'))
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const profile = await tx.candidateProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!profile) return 'no-profile' as const

      // Publish state is asserted inside the transaction: a job closed a moment
      // ago must not end up on someone's saved list rendering nothing. NOT_FOUND
      // rather than FORBIDDEN, so a draft job's id is not confirmed to exist.
      const job = await tx.job.findFirst({
        where: { id: jobId, status: 'PUBLISHED', moderation: 'APPROVED' },
        select: { id: true },
      })
      if (!job) return 'no-job' as const

      const removed = await tx.savedJob.deleteMany({
        where: { candidateProfileId: profile.id, jobId },
      })

      if (removed.count > 0) return 'unsaved' as const

      await tx.savedJob.create({ data: { candidateProfileId: profile.id, jobId } })
      return 'saved' as const
    })

    if (outcome === 'no-profile') {
      return err(appError('NOT_FOUND', 'Finish setting up your profile first.'))
    }
    if (outcome === 'no-job') {
      return err(appError('NOT_FOUND', 'That role is no longer available.'))
    }

    return ok({ saved: outcome === 'saved' })
  } catch {
    return err(appError('INTERNAL', 'We could not update your saved jobs. Please try again.'))
  }
}
