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
/**
 * How many rows the timing averages are computed from.
 *
 * These are averages, not totals: the funnel counts come from a `groupBy` that
 * aggregates in the database and is not bounded by this. A mean over the most
 * recent thousand applications in the window is the same number as a mean over
 * ten thousand, for a fraction of the read.
 */
const SAMPLE_LIMIT = 1000

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
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_LIMIT,
      select: { createdAt: true },
    }),
    // The first event that is not the application's own APPLIED entry — that is
    // when a human actually looked at it.
    //
    // Bounded to the window and to a sample size, because this is a per-row read
    // with a nested event and the page renders it on every visit. Unbounded, a
    // company with years of hiring behind it read every application it had ever
    // received to produce one average.
    prisma.application.findMany({
      where: {
        ...ownJobs,
        createdAt: { gte: since },
        events: { some: { toStage: { not: 'APPLIED' } } },
      },
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_LIMIT,
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
      where: { ...ownJobs, stage: 'OFFER', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: SAMPLE_LIMIT,
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
/**
 * How many cards the board holds.
 *
 * A drag-and-drop board of several thousand cards is not usable, and the read
 * has to stop somewhere. What matters is that the page says so — see
 * `describePipeline`.
 */
export const PIPELINE_LIMIT = 300

/**
 * What the board says about its own completeness.
 *
 * The page used to report the number of cards it had received as the number of
 * candidates in progress. Past the limit that number was simply wrong, and the
 * missing candidates were invisible. An employer checking whether they have
 * replied to everyone needs to know where the board stops.
 */
export function describePipeline(shown: number, total: number): string {
  if (total === 0) return 'Candidates appear here as they apply.'

  const noun = total === 1 ? 'candidate' : 'candidates'
  if (shown >= total) return `${total} ${noun} in progress.`

  return `${total} ${noun} in progress — showing the ${shown} most recent.`
}

/** How many applications are actually in progress, whatever the board holds. */
export async function countPipeline(companyId: string, jobId?: string): Promise<number> {
  return prisma.application.count({
    where: {
      job: { companyId },
      ...(jobId ? { jobId } : {}),
      stage: { in: ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER'] },
    },
  })
}

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
    take: PIPELINE_LIMIT,
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
