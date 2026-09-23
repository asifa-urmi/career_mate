import type { ApplicationStage } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { averageDays, bucketByDay, buildFunnel, conversionRate } from '@/lib/analytics/compute'
import { PIPELINE_STAGES, stageLabel } from '@/config/constants'
import { relativeTime } from '@/lib/utils/format'
import type { DayBucket, FunnelStage, StageCounts } from '@/lib/analytics/compute'

const EMPTY_COUNTS: StageCounts = {
  APPLIED: 0,
  SCREENING: 0,
  INTERVIEW: 0,
  ASSESSMENT: 0,
  OFFER: 0,
  REJECTED: 0,
  WITHDRAWN: 0,
}

export type HiringAnalytics = {
  funnel: FunnelStage[]
  offerRate: number
  interviewRate: number
  applicationsPerDay: DayBucket[]
  daysToFirstResponse: number | null
  daysToOffer: number | null
  totalApplications: number
  liveJobs: number
}

/**
 * Everything the analytics page shows, scoped to one company.
 *
 * All four queries filter on `job: { companyId }`, so there is no cross-company
 * data to aggregate in the first place — the scoping is in the query, not in a
 * filter applied to a wider result.
 */
export async function hiringAnalytics(companyId: string, days = 30): Promise<HiringAnalytics> {
  const since = new Date(Date.now() - days * 86_400_000)
  const ownJobs = { job: { companyId } }

  const [grouped, recent, responded, offered, liveJobs] = await Promise.all([
    prisma.application.groupBy({
      by: ['stage'],
      where: ownJobs,
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: { ...ownJobs, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    // The first event that is not the application's own APPLIED entry — that is
    // when a human actually looked at it.
    prisma.application.findMany({
      where: { ...ownJobs, events: { some: { toStage: { not: 'APPLIED' } } } },
      select: {
        createdAt: true,
        events: {
          where: { toStage: { not: 'APPLIED' } },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.application.findMany({
      where: { ...ownJobs, stage: 'OFFER' },
      select: {
        createdAt: true,
        events: {
          where: { toStage: 'OFFER' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    }),
    prisma.job.count({
      where: { companyId, status: 'PUBLISHED', moderation: 'APPROVED' },
    }),
  ])

  const counts: StageCounts = { ...EMPTY_COUNTS }
  for (const row of grouped) counts[row.stage as ApplicationStage] = row._count._all

  const funnel = buildFunnel(counts)
  const total = funnel[0]?.count ?? 0

  const pairs = (rows: { createdAt: Date; events: { createdAt: Date }[] }[]) =>
    rows.flatMap((r) =>
      r.events[0] ? [[r.createdAt, r.events[0].createdAt] as [Date, Date]] : [],
    )

  return {
    funnel,
    offerRate: conversionRate(counts.OFFER, total),
    interviewRate: conversionRate(
      funnel.find((s) => s.key === 'INTERVIEW')?.count ?? 0,
      total,
    ),
    applicationsPerDay: bucketByDay(recent.map((r) => r.createdAt), days),
    daysToFirstResponse: averageDays(pairs(responded)),
    daysToOffer: averageDays(pairs(offered)),
    totalApplications: total,
    liveJobs,
  }
}

export type PipelineColumn = {
  stage: ApplicationStage
  label: string
  applications: {
    id: string
    candidateName: string
    headline: string | null
    jobTitle: string
    appliedLabel: string
  }[]
}

/**
 * The pipeline board, grouped by stage.
 *
 * Only the five progressing stages: rejected and withdrawn applications are not
 * "in the pipeline", and two dead columns would take up half the board.
 */
export async function pipelineForCompany(
  companyId: string,
  jobId?: string,
): Promise<PipelineColumn[]> {
  const rows = await prisma.application.findMany({
    where: {
      job: { companyId },
      ...(jobId ? { jobId } : {}),
      stage: { in: ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER'] },
    },
    orderBy: { updatedAt: 'desc' },
    take: 300,
    select: {
      id: true,
      stage: true,
      createdAt: true,
      job: { select: { title: true } },
      candidateProfile: {
        select: { headline: true, user: { select: { name: true } } },
      },
    },
  })

  const now = new Date()

  return PIPELINE_STAGES.map((stage) => ({
    stage,
    label: stageLabel(stage),
    applications: rows
      .filter((r) => r.stage === stage)
      .map((r) => ({
        id: r.id,
        candidateName: r.candidateProfile.user.name,
        headline: r.candidateProfile.headline,
        jobTitle: r.job.title,
        appliedLabel: relativeTime(r.createdAt, now),
      })),
  }))
}
