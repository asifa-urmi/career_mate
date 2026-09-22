import type { JobCategory, JobType, Prisma, WorkMode } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { formatTaka, relativeTime } from '@/lib/utils/format'

/**
 * What a job card needs, and nothing else.
 *
 * Salary and posted-date are already formatted here rather than in the component,
 * so a job card cannot accidentally render `৳0` or a raw timestamp — the rules
 * live in one tested place. `score` is optional because the matcher arrives in a
 * later phase; the field exists now so the card's shape does not change then.
 */
export type JobCardModel = {
  id: string
  title: string
  companyName: string
  logoInitials: string
  category: JobCategory
  location: string
  workMode: WorkMode
  jobType: JobType
  salaryLabel: string
  skills: string[]
  postedLabel: string
  applicantCount: number
  score?: number
}

export type JobFilter = {
  category?: JobCategory | undefined
  workMode?: WorkMode | undefined
  jobType?: JobType | undefined
  search?: string | undefined
  minSalaryBdt?: number | undefined
  take?: number | undefined
}

const CARD_SELECT = {
  id: true,
  title: true,
  category: true,
  location: true,
  workMode: true,
  jobType: true,
  salaryMinBdt: true,
  salaryMaxBdt: true,
  salaryNote: true,
  requiredSkills: true,
  publishedAt: true,
  createdAt: true,
  company: { select: { name: true, logoInitials: true } },
  _count: { select: { applications: true } },
} satisfies Prisma.JobSelect

type JobCardRow = Prisma.JobGetPayload<{ select: typeof CARD_SELECT }>

function toCardModel(job: JobCardRow, now = new Date()): JobCardModel {
  return {
    id: job.id,
    title: job.title,
    companyName: job.company.name,
    logoInitials: job.company.logoInitials,
    category: job.category,
    location: job.location,
    workMode: job.workMode,
    jobType: job.jobType,
    salaryLabel: formatTaka(job.salaryMinBdt, job.salaryMaxBdt, job.salaryNote),
    skills: job.requiredSkills.slice(0, 3),
    postedLabel: relativeTime(job.publishedAt ?? job.createdAt, now),
    applicantCount: job._count.applications,
  }
}

/**
 * Only PUBLISHED and APPROVED jobs. A job awaiting moderation must not be
 * reachable from a public listing, so that pair of conditions is applied here
 * rather than left to each caller to remember.
 */
function publishedWhere(filter: JobFilter): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = {
    status: 'PUBLISHED',
    moderation: 'APPROVED',
  }

  if (filter.category) where.category = filter.category
  if (filter.workMode && filter.workMode !== 'ANY') where.workMode = filter.workMode
  if (filter.jobType) where.jobType = filter.jobType
  if (filter.minSalaryBdt !== undefined) {
    where.OR = [
      { salaryMaxBdt: { gte: filter.minSalaryBdt } },
      { salaryMaxBdt: null, salaryMinBdt: { gte: filter.minSalaryBdt } },
    ]
  }

  if (filter.search) {
    const search = filter.search.trim()
    if (search) {
      where.AND = [
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { summary: { contains: search, mode: 'insensitive' } },
            { company: { name: { contains: search, mode: 'insensitive' } } },
            { requiredSkills: { has: search } },
          ],
        },
      ]
    }
  }

  return where
}

export async function listPublishedJobs(filter: JobFilter = {}): Promise<JobCardModel[]> {
  const jobs = await prisma.job.findMany({
    where: publishedWhere(filter),
    select: CARD_SELECT,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: filter.take ?? 50,
  })

  const now = new Date()
  return jobs.map((job) => toCardModel(job, now))
}

export async function countPublishedJobs(filter: JobFilter = {}): Promise<number> {
  return prisma.job.count({ where: publishedWhere(filter) })
}

/** Live counts per sector, for the landing page's sector grid. */
export async function countJobsByCategory(): Promise<Partial<Record<JobCategory, number>>> {
  const rows = await prisma.job.groupBy({
    by: ['category'],
    where: { status: 'PUBLISHED', moderation: 'APPROVED' },
    _count: { _all: true },
  })

  return Object.fromEntries(rows.map((r) => [r.category, r._count._all]))
}
