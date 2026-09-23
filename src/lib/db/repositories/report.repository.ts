import type { ReportStatus, ReportTargetType } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { relativeTime } from '@/lib/utils/format'

export type ReportRow = {
  id: string
  targetType: ReportTargetType
  targetId: string
  /** What the report is about, or null when that thing no longer exists. */
  targetLabel: string | null
  targetHref: string | null
  reason: string
  detail: string | null
  status: ReportStatus
  reporterName: string
  filedLabel: string
  resolutionNote: string | null
  resolvedByName: string | null
}

/**
 * The safety queue.
 *
 * Reports have no foreign key to their target on purpose, so a report about a
 * job that was later removed still reads — the queue is a record of what was
 * raised, and a cascade would let the thing complained about take the complaint
 * with it. The label is resolved separately and comes back null when the target
 * is gone, which the page shows rather than crashing on.
 */
export async function listReports(status?: ReportStatus): Promise<ReportRow[]> {
  const reports = await prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 100,
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      detail: true,
      status: true,
      createdAt: true,
      resolutionNote: true,
      reporter: { select: { name: true } },
      resolvedBy: { select: { name: true } },
    },
  })

  const jobIds = reports.filter((r) => r.targetType === 'JOB').map((r) => r.targetId)
  const userIds = reports.filter((r) => r.targetType === 'USER').map((r) => r.targetId)

  const [jobs, users] = await Promise.all([
    jobIds.length
      ? prisma.job.findMany({
          where: { id: { in: jobIds } },
          select: { id: true, title: true, company: { select: { name: true } } },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [],
  ])

  const jobById = new Map(jobs.map((j) => [j.id, `${j.title} — ${j.company.name}`]))
  const userById = new Map(users.map((u) => [u.id, { label: `${u.name} (${u.email})`, email: u.email }]))

  const now = new Date()

  return reports.map((r) => {
    const job = r.targetType === 'JOB' ? jobById.get(r.targetId) : undefined
    const reported = r.targetType === 'USER' ? userById.get(r.targetId) : undefined
    const label = job ?? reported?.label

    return {
      id: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      targetLabel: label ?? null,
      // The email is carried through rather than picked back out of the label by
      // splitting on a bracket — a person named "Rafat (Rafi)" produced a search
      // for "Rafi", and the admin's link found nobody.
      targetHref: label
        ? r.targetType === 'JOB'
          ? `/jobs-public/${r.targetId}`
          : `/admin/users?q=${encodeURIComponent(reported?.email ?? '')}`
        : null,
      reason: r.reason,
      detail: r.detail,
      status: r.status,
      reporterName: r.reporter.name,
      filedLabel: relativeTime(r.createdAt, now),
      resolutionNote: r.resolutionNote,
      resolvedByName: r.resolvedBy?.name ?? null,
    }
  })
}

export async function reportCounts(): Promise<Record<ReportStatus, number>> {
  const rows = await prisma.report.groupBy({ by: ['status'], _count: { _all: true } })
  const counts: Record<ReportStatus, number> = {
    OPEN: 0,
    REVIEWING: 0,
    RESOLVED: 0,
    DISMISSED: 0,
  }
  for (const row of rows) counts[row.status] = row._count._all
  return counts
}
