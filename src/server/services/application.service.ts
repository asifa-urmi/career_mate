import 'server-only'

import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import type { ApplicationInput } from '@/lib/validation/application.schema'

/** Prisma's unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}

type ApplyOutcome =
  | { kind: 'ok'; applicationId: string }
  | { kind: 'no-profile' }
  | { kind: 'no-job' }
  | { kind: 'no-resume' }

/**
 * Submits an application.
 *
 * Everything happens in one transaction, and the conditions are asserted inside
 * it rather than before it: a job that closes between the page rendering and the
 * submit arriving must not leave an application attached to a role nobody is
 * hiring for.
 *
 * Applying twice is prevented by the database's unique constraint on
 * (candidateProfileId, jobId), not by reading first. Two submissions arriving
 * together would both pass a read check; only one can win the constraint. The
 * loser is translated to CONFLICT here rather than surfacing as a 500.
 */
export async function applyToJob(
  user: SessionUser,
  input: ApplicationInput,
): Promise<Result<{ applicationId: string }>> {
  if (user.role !== 'CANDIDATE') {
    return err(appError('FORBIDDEN', 'Only a job seeker account can apply to roles.'))
  }

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<ApplyOutcome> => {
      const profile = await tx.candidateProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!profile) return { kind: 'no-profile' }

      const job = await tx.job.findFirst({
        where: { id: input.jobId, status: 'PUBLISHED', moderation: 'APPROVED' },
        select: { id: true, screeningQuestions: true },
      })
      if (!job) return { kind: 'no-job' }

      // A resume id from the form is not trusted: the ownership predicate is in
      // the where clause, so another candidate's CV is simply not found rather
      // than fetched and then rejected.
      if (input.resumeId) {
        const resume = await tx.resume.findFirst({
          where: { id: input.resumeId, candidateProfileId: profile.id },
          select: { id: true },
        })
        if (!resume) return { kind: 'no-resume' }
      }

      const application = await tx.application.create({
        data: {
          candidateProfileId: profile.id,
          jobId: job.id,
          resumeId: input.resumeId ?? null,
          coverLetter: input.coverLetter ?? null,
          screeningAnswers: input.screeningAnswers,
          // Stamped here, from the server's clock. The client sends a boolean
          // saying they ticked the box; when that happened is ours to record.
          consentedAt: new Date(),
        },
        select: { id: true },
      })

      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          fromStage: null,
          toStage: 'APPLIED',
          actorId: user.id,
        },
      })

      return { kind: 'ok', applicationId: application.id }
    })

    switch (outcome.kind) {
      case 'no-profile':
        return err(appError('NOT_FOUND', 'Finish setting up your profile before applying.'))
      case 'no-job':
        return err(appError('NOT_FOUND', 'That role is no longer accepting applications.'))
      case 'no-resume':
        return err(appError('NOT_FOUND', 'We could not find that CV on your account.'))
      case 'ok':
        return ok({ applicationId: outcome.applicationId })
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return err(appError('CONFLICT', 'You have already applied to this role.'))
    }
    return err(appError('INTERNAL', 'We could not submit your application. Please try again.'))
  }
}

type WithdrawOutcome = { kind: 'ok' } | { kind: 'no-profile' } | { kind: 'not-found' } | { kind: 'already' }

export async function withdrawApplication(
  user: SessionUser,
  applicationId: string,
): Promise<Result<void>> {
  if (user.role !== 'CANDIDATE') {
    return err(appError('FORBIDDEN', 'Only the applicant can withdraw an application.'))
  }

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<WithdrawOutcome> => {
      const profile = await tx.candidateProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!profile) return { kind: 'no-profile' }

      const application = await tx.application.findFirst({
        where: { id: applicationId, candidateProfileId: profile.id },
        select: { id: true, stage: true },
      })
      // Not found rather than forbidden: a distinguishable "exists but not
      // yours" tells someone which ids are real.
      if (!application) return { kind: 'not-found' }
      if (application.stage === 'WITHDRAWN') return { kind: 'already' }

      await tx.application.update({
        where: { id: application.id },
        data: { stage: 'WITHDRAWN' },
      })

      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          fromStage: application.stage,
          toStage: 'WITHDRAWN',
          actorId: user.id,
        },
      })

      return { kind: 'ok' }
    })

    switch (outcome.kind) {
      case 'no-profile':
      case 'not-found':
        return err(appError('NOT_FOUND', 'We could not find that application.'))
      case 'already':
        return err(appError('CONFLICT', 'That application is already withdrawn.'))
      case 'ok':
        return ok(undefined)
    }
  } catch {
    return err(appError('INTERNAL', 'We could not withdraw that application. Please try again.'))
  }
}
