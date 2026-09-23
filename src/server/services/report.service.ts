import 'server-only'

import type { ReportStatus, ReportTargetType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { appError } from '@/lib/utils/errors'
import { err, ok, type Result } from '@/lib/utils/result'
import type { SessionUser } from '@/lib/auth/session'
import { REPORT_REASONS } from '@/lib/reports/reasons'

/**
 * Anyone signed in can report; only an admin resolves.
 *
 * Reports are kept loosely coupled to their target — `targetType` plus a plain
 * id, with no foreign key. A report about a job that is later deleted must
 * still be readable: the queue is a record of what was raised, and a cascade
 * would let the thing complained about take the complaint with it.
 */
export async function fileReport(
  user: SessionUser,
  input: {
    targetType: ReportTargetType
    targetId: string
    reason: string
    detail?: string
  },
): Promise<Result<void>> {
  const reason = input.reason.trim()
  if (!reason) return err(appError('VALIDATION', 'Choose a reason.'))

  // The reason is a closed set, checked here and not only in the select. This
  // action is a public endpoint, and a hand-made request would otherwise write
  // whatever it liked straight into what a moderator reads first.
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
    return err(appError('VALIDATION', 'Choose one of the listed reasons.'))
  }

  if (!input.targetId.trim()) return err(appError('VALIDATION', 'Nothing to report.'))

  try {
    // Reporting the same thing twice is almost always a double-click, and a
    // duplicate row would make the queue look busier than it is.
    const existing = await prisma.report.findFirst({
      where: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        status: { in: ['OPEN', 'REVIEWING'] },
      },
      select: { id: true },
    })
    if (existing) return ok(undefined)

    await prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId: input.targetId,
        reason,
        detail: input.detail?.trim().slice(0, 2000) || null,
      },
    })

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not file that report. Please try again.'))
  }
}

export async function resolveReport(
  admin: SessionUser,
  reportId: string,
  status: ReportStatus,
  note?: string,
): Promise<Result<void>> {
  if (admin.role !== 'ADMIN') {
    return err(appError('FORBIDDEN', 'Only a platform administrator can resolve reports.'))
  }

  if (status === 'OPEN') {
    return err(appError('VALIDATION', 'Reopening a report is not a resolution.'))
  }

  const trimmed = note?.trim().slice(0, 1000)

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const report = await tx.report.findFirst({
        where: { id: reportId },
        select: { id: true, reporterId: true, status: true, reason: true },
      })
      if (!report) return { kind: 'not-found' as const }
      if (report.status === status) return { kind: 'unchanged' as const }

      await tx.report.update({
        where: { id: report.id },
        data: {
          status,
          resolvedById: admin.id,
          resolutionNote: trimmed ?? null,
        },
      })

      // Someone who takes the trouble to report something deserves to hear what
      // happened. A queue that swallows reports silently stops receiving them.
      if (status === 'RESOLVED' || status === 'DISMISSED') {
        await tx.notification.create({
          data: {
            userId: report.reporterId,
            type: 'SYSTEM',
            title: status === 'RESOLVED' ? 'Your report was acted on' : 'Your report was reviewed',
            body:
              status === 'RESOLVED'
                ? `Thank you — we looked into "${report.reason}" and took action.${trimmed ? ` ${trimmed}` : ''}`
                : `We looked into "${report.reason}" and did not find a breach of our rules.${trimmed ? ` ${trimmed}` : ''}`,
            href: '/notifications',
          },
        })
      }

      return { kind: 'ok' as const }
    })

    if (outcome.kind === 'not-found') {
      return err(appError('NOT_FOUND', 'We could not find that report.'))
    }

    return ok(undefined)
  } catch {
    return err(appError('INTERNAL', 'We could not update that report. Please try again.'))
  }
}
