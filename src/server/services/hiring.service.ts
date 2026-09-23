import 'server-only'

import type { ApplicationStage } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import { stageLabel } from '@/config/constants'

/**
 * The stages an employer may set.
 *
 * WITHDRAWN is absent: withdrawing is the candidate's act, and an employer
 * marking someone as having withdrawn would falsify the record that the
 * candidate walked away rather than being passed over.
 */
const EMPLOYER_SETTABLE: readonly ApplicationStage[] = [
  'APPLIED',
  'SCREENING',
  'INTERVIEW',
  'ASSESSMENT',
  'OFFER',
  'REJECTED',
]

/** Stages that end an application. Reopening one would rewrite its outcome. */
const TERMINAL: readonly ApplicationStage[] = ['WITHDRAWN']

type Outcome =
  | { kind: 'ok' }
  | { kind: 'unchanged' }
  | { kind: 'not-found' }
  | { kind: 'terminal' }

/**
 * Moves one application to a new stage.
 *
 * The company predicate lives in the `where`, so an application belonging to
 * another company is never fetched — it simply does not exist for this caller.
 * The update, the event and the candidate's notification are one transaction:
 * a stage that moved without its event has no history to show, and a
 * notification about a change that rolled back is a lie.
 */
export async function changeApplicationStage(
  user: SessionUser,
  applicationId: string,
  toStage: ApplicationStage,
  note?: string,
): Promise<Result<void>> {
  if (user.role !== 'EMPLOYER') {
    return err(appError('FORBIDDEN', 'Only an employer can move an application.'))
  }

  if (!EMPLOYER_SETTABLE.includes(toStage)) {
    if (toStage === 'WITHDRAWN') {
      return err(
        appError('FORBIDDEN', 'Only the candidate can withdraw their own application.'),
      )
    }
    return err(appError('VALIDATION', 'That is not a stage an application can move to.'))
  }

  const employer = await prisma.employerProfile.findUnique({
    where: { userId: user.id },
    select: { companyId: true },
  })
  if (!employer) return err(appError('NOT_FOUND', 'We could not find your company.'))

  try {
    const outcome = await prisma.$transaction(async (tx): Promise<Outcome> => {
      const application = await tx.application.findFirst({
        where: { id: applicationId, job: { companyId: employer.companyId } },
        select: {
          id: true,
          stage: true,
          candidateProfile: { select: { userId: true } },
          job: { select: { id: true, title: true, company: { select: { name: true } } } },
        },
      })

      if (!application) return { kind: 'not-found' }
      if (TERMINAL.includes(application.stage)) return { kind: 'terminal' }
      // A double-clicked button must not litter the history with identical
      // entries or send the candidate the same notification twice.
      if (application.stage === toStage) return { kind: 'unchanged' }

      await tx.application.update({
        where: { id: application.id },
        data: { stage: toStage },
      })

      await tx.applicationEvent.create({
        data: {
          applicationId: application.id,
          fromStage: application.stage,
          toStage,
          note: note?.trim() || null,
          actorId: user.id,
        },
      })

      await tx.notification.create({
        data: {
          userId: application.candidateProfile.userId,
          type: 'APPLICATION_UPDATE',
          title: `${stageLabel(toStage)}: ${application.job.title}`,
          body: `${application.job.company.name} moved your application for ${application.job.title} to ${stageLabel(toStage).toLowerCase()}.`,
          href: '/tracker',
        },
      })

      return { kind: 'ok' }
    })

    switch (outcome.kind) {
      case 'not-found':
        return err(appError('NOT_FOUND', 'We could not find that application.'))
      case 'terminal':
        return err(
          appError('CONFLICT', 'That application was withdrawn and cannot be reopened.'),
        )
      case 'unchanged':
      case 'ok':
        return ok(undefined)
    }
  } catch {
    return err(appError('INTERNAL', 'We could not update that application. Please try again.'))
  }
}
